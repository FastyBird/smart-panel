import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { ChannelCategory } from '../../../modules/devices/devices.constants';
import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { PropertyValueState } from '../../../modules/devices/models/property-value-state.model';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { DEVICES_HOMEY_PLUGIN_NAME, DEVICES_HOMEY_TYPE } from '../devices-homey.constants';
import { HomeyAdoptDeviceDto } from '../dto/adoption.dto';
import { CreateHomeyChannelDto } from '../dto/create-channel.dto';
import { CreateHomeyDeviceChannelPropertyDto } from '../dto/create-device-channel-property.dto';
import { CreateHomeyDeviceChannelDto } from '../dto/create-device-channel.dto';
import { CreateHomeyDeviceDto } from '../dto/create-device.dto';
import { HomeyChannelEntity, HomeyChannelPropertyEntity, HomeyDeviceEntity } from '../entities/devices-homey.entity';
import {
	HomeyMappingPreviewDeviceNotFoundError,
	HomeyMappingPreviewUnavailableError,
} from '../errors/homey-mapping-preview.error';
import { HomeyAdoptionFailureCode, HomeyAdoptionResultModel, HomeyAdoptionStatus } from '../models/adoption.model';
import {
	HomeyMappingPreviewChannelModel,
	HomeyMappingPreviewModel,
	HomeyMappingPreviewPropertyModel,
} from '../models/mapping-preview.model';

import { HomeyMappingPreviewService } from './homey-mapping-preview.service';

type UndoOperation = () => Promise<void>;

interface PropertySnapshot {
	readonly entity: HomeyChannelPropertyEntity;
	readonly createDto: CreateHomeyDeviceChannelPropertyDto;
	readonly value: PropertyValueState | null;
}

interface ChannelSnapshot {
	readonly entity: HomeyChannelEntity;
	readonly properties: readonly PropertySnapshot[];
}

interface ExistingHierarchySnapshot {
	readonly channels: readonly ChannelSnapshot[];
	readonly propertiesById: ReadonlyMap<string, PropertySnapshot>;
}

interface PendingValueWrite {
	readonly property: HomeyChannelPropertyEntity;
	readonly value: string | number | boolean;
	readonly previous: PropertyValueState | null;
	readonly restorePrevious: boolean;
}

@Injectable()
export class HomeyDeviceAdoptionService {
	private readonly logger = createExtensionLogger(DEVICES_HOMEY_PLUGIN_NAME, 'HomeyDeviceAdoptionService');
	private readonly deviceTails = new Map<string, Promise<void>>();

	constructor(
		private readonly mappingPreviewService: HomeyMappingPreviewService,
		private readonly devicesService: DevicesService,
		private readonly channelsService: ChannelsService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly propertyValueService: PropertyValueService,
		private readonly structureLock: DeviceStructureLockService,
	) {}

	async adoptOne(selection: HomeyAdoptDeviceDto): Promise<HomeyAdoptionResultModel> {
		return this.withDeviceLock(selection.deviceId, async () => {
			let preview: HomeyMappingPreviewModel;

			try {
				preview = await this.mappingPreviewService.generatePreview({
					deviceId: selection.deviceId,
					deviceCategory: selection.deviceCategory,
				});
			} catch (error) {
				if (error instanceof HomeyMappingPreviewDeviceNotFoundError) {
					return this.failure(selection.deviceId, HomeyAdoptionFailureCode.DEVICE_NOT_FOUND);
				}
				if (error instanceof HomeyMappingPreviewUnavailableError) {
					return this.failure(selection.deviceId, HomeyAdoptionFailureCode.UNAVAILABLE);
				}

				return this.failure(selection.deviceId, HomeyAdoptionFailureCode.UNAVAILABLE);
			}

			if (!preview.readyToAdopt || preview.selectedCategory === null) {
				return this.failure(selection.deviceId, HomeyAdoptionFailureCode.UNSUPPORTED_MAPPING);
			}

			try {
				return await this.structureLock.runExclusive(() => this.persist(selection, preview));
			} catch {
				this.logger.warn('Homey adoption persistence failed before reconciliation completed');

				return this.failure(selection.deviceId, HomeyAdoptionFailureCode.PERSISTENCE_FAILED);
			}
		});
	}

	async adoptBatch(selections: readonly HomeyAdoptDeviceDto[]): Promise<HomeyAdoptionResultModel[]> {
		const results: HomeyAdoptionResultModel[] = [];

		for (const selection of selections) {
			results.push(await this.adoptOne(selection));
		}

		return results;
	}

	private async persist(
		selection: HomeyAdoptDeviceDto,
		preview: HomeyMappingPreviewModel,
	): Promise<HomeyAdoptionResultModel> {
		let existing = await this.devicesService.findOneBy<HomeyDeviceEntity>(
			'identifier',
			preview.device.id,
			DEVICES_HOMEY_TYPE,
		);

		if (existing === null) {
			try {
				const created = await this.devicesService.create<HomeyDeviceEntity, CreateHomeyDeviceDto>(
					this.createDeviceDto(selection, preview, true),
				);

				return this.success(preview.device.id, HomeyAdoptionStatus.CREATED, created.id);
			} catch {
				// A different process may have won the provider-scoped unique insert. Re-read and reconcile
				// that row; every other failure remains a fixed, secret-safe persistence result.
				existing = await this.devicesService.findOneBy<HomeyDeviceEntity>(
					'identifier',
					preview.device.id,
					DEVICES_HOMEY_TYPE,
				);

				if (existing === null) {
					this.logger.warn('Homey device creation failed and no concurrent adoption was found');

					return this.failure(preview.device.id, HomeyAdoptionFailureCode.PERSISTENCE_FAILED);
				}
			}
		}

		return this.reconcileExisting(selection, preview, existing);
	}

	private async reconcileExisting(
		selection: HomeyAdoptDeviceDto,
		preview: HomeyMappingPreviewModel,
		device: HomeyDeviceEntity,
	): Promise<HomeyAdoptionResultModel> {
		const journal: UndoOperation[] = [];

		try {
			// All value state is captured before the first mutation. A later failure can therefore restore
			// both the relational hierarchy and every initial value it has already replaced.
			const snapshot = await this.snapshotHierarchy(device.id);
			const pendingValues: PendingValueWrite[] = [];
			let changed = false;

			for (const desiredChannel of preview.channels) {
				changed = (await this.reconcileChannel(device.id, desiredChannel, snapshot, pendingValues, journal)) || changed;
			}

			changed = (await this.removeStaleChannels(device.id, preview.channels, snapshot, journal)) || changed;

			const desiredName = selection.name ?? preview.device.name;
			const desiredCategory = preview.selectedCategory;
			if (
				device.name !== desiredName ||
				device.category !== desiredCategory ||
				device.identifier !== preview.device.id
			) {
				const previous = {
					type: DEVICES_HOMEY_TYPE,
					name: device.name,
					category: device.category,
					identifier: device.identifier,
				};

				await this.devicesService.update(device.id, {
					type: DEVICES_HOMEY_TYPE,
					name: desiredName,
					category: desiredCategory,
					identifier: preview.device.id,
				});
				journal.push(async () => {
					await this.devicesService.update(device.id, previous);
				});
				changed = true;
			}

			for (const pending of pendingValues) {
				if (pending.previous?.value !== pending.value) {
					changed = true;
				}

				await this.channelsPropertiesService.update(pending.property.id, {
					type: DEVICES_HOMEY_TYPE,
					value: pending.value,
				});

				if (pending.restorePrevious) {
					journal.push(() => this.restoreValue(pending.property, pending.previous));
				}
			}

			return this.success(
				preview.device.id,
				changed ? HomeyAdoptionStatus.UPDATED : HomeyAdoptionStatus.SKIPPED,
				device.id,
			);
		} catch {
			const rolledBack = await this.rollback(journal);
			this.logger.warn(rolledBack ? 'Homey adoption failed and was rolled back' : 'Homey adoption rollback failed');

			return this.failure(
				preview.device.id,
				rolledBack ? HomeyAdoptionFailureCode.PERSISTENCE_FAILED : HomeyAdoptionFailureCode.ROLLBACK_FAILED,
			);
		}
	}

	private async reconcileChannel(
		deviceId: string,
		desired: HomeyMappingPreviewChannelModel,
		snapshot: ExistingHierarchySnapshot,
		pendingValues: PendingValueWrite[],
		journal: UndoOperation[],
	): Promise<boolean> {
		let changed = false;
		let channel = await this.channelsService.findOneBy<HomeyChannelEntity>(
			'identifier',
			desired.identifier,
			deviceId,
			DEVICES_HOMEY_TYPE,
		);

		if (channel && channel.category !== desired.category) {
			const old = snapshot.channels.find((candidate) => candidate.entity.id === channel?.id);
			if (!old) {
				throw new Error('Homey channel snapshot is unavailable');
			}

			await this.channelsService.remove(channel.id);
			journal.push(() => this.restoreChannel(deviceId, old));
			channel = null;
			changed = true;
		}

		if (channel === null) {
			channel = await this.channelsService.create<HomeyChannelEntity, CreateHomeyChannelDto>({
				...this.createChannelDto(desired, false),
				device: deviceId,
			} as CreateHomeyChannelDto);
			const createdChannelId = channel.id;
			journal.push(async () => {
				await this.channelsService.remove(createdChannelId);
			});
			changed = true;
		} else if (channel.name !== desired.name || channel.identifier !== desired.identifier) {
			const previous = {
				type: DEVICES_HOMEY_TYPE,
				name: channel.name,
				identifier: channel.identifier,
			};

			await this.channelsService.update(channel.id, {
				type: DEVICES_HOMEY_TYPE,
				name: desired.name,
				identifier: desired.identifier,
			});
			const updatedChannelId = channel.id;
			journal.push(async () => {
				await this.channelsService.update(updatedChannelId, previous);
			});
			changed = true;
		}

		changed =
			(await this.reconcileProperties(channel, desired.properties, snapshot, pendingValues, journal)) || changed;

		return changed;
	}

	private async reconcileProperties(
		channel: HomeyChannelEntity,
		desiredProperties: readonly HomeyMappingPreviewPropertyModel[],
		snapshot: ExistingHierarchySnapshot,
		pendingValues: PendingValueWrite[],
		journal: UndoOperation[],
	): Promise<boolean> {
		let changed = false;
		const desiredIdentifiers = new Set<string>();

		for (const desired of desiredProperties) {
			const identifier = this.propertyIdentifier(desired);
			desiredIdentifiers.add(identifier);
			let property = await this.channelsPropertiesService.findOneBy<HomeyChannelPropertyEntity>(
				'identifier',
				identifier,
				channel.id,
				DEVICES_HOMEY_TYPE,
			);

			if (property && property.category !== desired.category) {
				const old = snapshot.propertiesById.get(property.id);
				if (!old) {
					throw new Error('Homey property snapshot is unavailable');
				}

				await this.channelsPropertiesService.remove(property.id);
				journal.push(() => this.restoreProperty(channel.id, old));
				property = null;
				changed = true;
			}

			const desiredDto = this.createPropertyDto(desired, false);
			if (property === null) {
				property = await this.channelsPropertiesService.create(channel.id, desiredDto);
				const createdPropertyId = property.id;
				journal.push(async () => {
					await this.channelsPropertiesService.remove(createdPropertyId);
				});
				changed = true;
			} else if (this.propertyMetadataChanged(property, desiredDto)) {
				const previous = snapshot.propertiesById.get(property.id);
				if (!previous) {
					throw new Error('Homey property snapshot is unavailable');
				}

				await this.channelsPropertiesService.update(property.id, {
					type: DEVICES_HOMEY_TYPE,
					identifier: desiredDto.identifier,
					name: desiredDto.name,
					permissions: desiredDto.permissions,
					data_type: desiredDto.data_type,
					format: desiredDto.format,
					invalid: desiredDto.invalid,
					step: desiredDto.step,
					homeyCapabilityId: desiredDto.homeyCapabilityId,
					homeyMappingName: desiredDto.homeyMappingName,
				});
				journal.push(() => this.restorePropertyMetadata(previous));
				property = await this.channelsPropertiesService.findOne<HomeyChannelPropertyEntity>(
					property.id,
					channel.id,
					DEVICES_HOMEY_TYPE,
				);
				if (property === null) {
					throw new Error('Updated Homey property is unavailable');
				}
				changed = true;
			}

			if (desired.valueAvailable && desired.currentValue !== null) {
				const previous = snapshot.propertiesById.get(property.id)?.value ?? null;
				pendingValues.push({
					property,
					value: desired.currentValue,
					previous,
					restorePrevious: snapshot.propertiesById.has(property.id),
				});
			}
		}

		const currentProperties = await this.channelsPropertiesService.findAll(channel.id);
		for (const candidate of currentProperties) {
			const homeyCandidate = candidate as HomeyChannelPropertyEntity;
			if (
				candidate.type !== DEVICES_HOMEY_TYPE ||
				candidate.identifier === null ||
				typeof homeyCandidate.homeyCapabilityId !== 'string' ||
				typeof homeyCandidate.homeyMappingName !== 'string'
			) {
				continue;
			}
			if (desiredIdentifiers.has(candidate.identifier)) {
				continue;
			}

			const old = snapshot.propertiesById.get(candidate.id);
			if (!old) {
				throw new Error('Homey stale property snapshot is unavailable');
			}

			await this.channelsPropertiesService.remove(candidate.id);
			journal.push(() => this.restoreProperty(channel.id, old));
			changed = true;
		}

		return changed;
	}

	private async removeStaleChannels(
		deviceId: string,
		desiredChannels: readonly HomeyMappingPreviewChannelModel[],
		snapshot: ExistingHierarchySnapshot,
		journal: UndoOperation[],
	): Promise<boolean> {
		const desiredIdentifiers = new Set(desiredChannels.map((channel) => channel.identifier));
		const current = await this.channelsService.findAll(deviceId);
		let changed = false;

		for (const candidate of current) {
			if (
				candidate.type !== DEVICES_HOMEY_TYPE ||
				candidate.category === ChannelCategory.DEVICE_INFORMATION ||
				candidate.identifier === null ||
				desiredIdentifiers.has(candidate.identifier)
			) {
				continue;
			}

			const old = snapshot.channels.find((channel) => channel.entity.id === candidate.id);
			if (!old) {
				throw new Error('Homey stale channel snapshot is unavailable');
			}

			await this.channelsService.remove(candidate.id);
			journal.push(() => this.restoreChannel(deviceId, old));
			changed = true;
		}

		return changed;
	}

	private async snapshotHierarchy(deviceId: string): Promise<ExistingHierarchySnapshot> {
		const channels = (await this.channelsService.findAll(deviceId)).filter(
			(channel): channel is HomeyChannelEntity => channel.type === DEVICES_HOMEY_TYPE,
		);
		const snapshots: ChannelSnapshot[] = [];
		const propertiesById = new Map<string, PropertySnapshot>();

		for (const channel of channels) {
			const properties = (await this.channelsPropertiesService.findAll(channel.id)).filter(
				(property): property is HomeyChannelPropertyEntity => property.type === DEVICES_HOMEY_TYPE,
			);
			const propertySnapshots: PropertySnapshot[] = [];

			for (const property of properties) {
				const value = await this.propertyValueService.readLatest(property);
				const propertySnapshot: PropertySnapshot = {
					entity: property,
					createDto: this.snapshotPropertyDto(property, value),
					value,
				};
				propertySnapshots.push(propertySnapshot);
				propertiesById.set(property.id, propertySnapshot);
			}

			snapshots.push({ entity: channel, properties: propertySnapshots });
		}

		return { channels: snapshots, propertiesById };
	}

	private createDeviceDto(
		selection: HomeyAdoptDeviceDto,
		preview: HomeyMappingPreviewModel,
		includeValues: boolean,
	): CreateHomeyDeviceDto {
		return {
			type: DEVICES_HOMEY_TYPE,
			identifier: preview.device.id,
			name: selection.name ?? preview.device.name,
			category: preview.selectedCategory,
			channels: preview.channels.map((channel) => this.createChannelDto(channel, includeValues)),
		} as CreateHomeyDeviceDto;
	}

	private createChannelDto(
		channel: HomeyMappingPreviewChannelModel,
		includeValues: boolean,
	): CreateHomeyDeviceChannelDto {
		return {
			type: DEVICES_HOMEY_TYPE,
			identifier: channel.identifier,
			name: channel.name,
			category: channel.category,
			properties: channel.properties.map((property) => this.createPropertyDto(property, includeValues)),
		} as CreateHomeyDeviceChannelDto;
	}

	private createPropertyDto(
		property: HomeyMappingPreviewPropertyModel,
		includeValue: boolean,
	): CreateHomeyDeviceChannelPropertyDto {
		const format =
			property.enumValues.length > 0
				? [...property.enumValues]
				: property.range !== null && property.range.minimum !== null && property.range.maximum !== null
					? [property.range.minimum, property.range.maximum]
					: null;

		return {
			type: DEVICES_HOMEY_TYPE,
			identifier: this.propertyIdentifier(property),
			homeyCapabilityId: property.capabilityId,
			homeyMappingName: property.mappingName,
			category: property.category,
			name: this.humanize(property.mappingName),
			permissions: [...property.permissions],
			data_type: property.dataType,
			format,
			invalid: null,
			step: property.range?.step ?? null,
			...(includeValue && property.valueAvailable && property.currentValue !== null
				? { value: property.currentValue }
				: {}),
		} as CreateHomeyDeviceChannelPropertyDto;
	}

	private snapshotPropertyDto(
		property: HomeyChannelPropertyEntity,
		value: PropertyValueState | null,
	): CreateHomeyDeviceChannelPropertyDto {
		return {
			id: property.id,
			type: DEVICES_HOMEY_TYPE,
			identifier: property.identifier,
			...(property.homeyCapabilityId === null ? {} : { homeyCapabilityId: property.homeyCapabilityId }),
			...(property.homeyMappingName === null ? {} : { homeyMappingName: property.homeyMappingName }),
			category: property.category,
			name: property.name,
			permissions: [...property.permissions],
			data_type: property.dataType,
			format: property.format === null ? null : [...property.format],
			invalid: property.invalid,
			step: property.step,
			...(value === null ? {} : { value: value.value }),
		} as CreateHomeyDeviceChannelPropertyDto;
	}

	private async restoreChannel(deviceId: string, snapshot: ChannelSnapshot): Promise<void> {
		await this.channelsService.create({
			id: snapshot.entity.id,
			type: DEVICES_HOMEY_TYPE,
			identifier: snapshot.entity.identifier,
			name: snapshot.entity.name,
			category: snapshot.entity.category,
			description: snapshot.entity.description,
			device: deviceId,
			properties: snapshot.properties.map((property) => property.createDto),
		});
	}

	private async restoreProperty(channelId: string, snapshot: PropertySnapshot): Promise<void> {
		await this.channelsPropertiesService.create(channelId, snapshot.createDto);
	}

	private async restorePropertyMetadata(snapshot: PropertySnapshot): Promise<void> {
		await this.channelsPropertiesService.update(snapshot.entity.id, {
			type: DEVICES_HOMEY_TYPE,
			identifier: snapshot.createDto.identifier,
			name: snapshot.createDto.name,
			permissions: snapshot.createDto.permissions,
			data_type: snapshot.createDto.data_type,
			format: snapshot.createDto.format,
			invalid: snapshot.createDto.invalid,
			step: snapshot.createDto.step,
			homeyCapabilityId: snapshot.createDto.homeyCapabilityId,
			homeyMappingName: snapshot.createDto.homeyMappingName,
		});
	}

	private async restoreValue(property: ChannelPropertyEntity, previous: PropertyValueState | null): Promise<void> {
		if (previous === null) {
			await this.propertyValueService.delete(property);
			return;
		}

		await this.propertyValueService.write(property, previous.value);
	}

	private propertyMetadataChanged(
		property: HomeyChannelPropertyEntity,
		desired: CreateHomeyDeviceChannelPropertyDto,
	): boolean {
		return (
			property.identifier !== desired.identifier ||
			property.name !== desired.name ||
			property.dataType !== desired.data_type ||
			property.invalid !== desired.invalid ||
			property.step !== desired.step ||
			property.homeyCapabilityId !== desired.homeyCapabilityId ||
			property.homeyMappingName !== desired.homeyMappingName ||
			JSON.stringify(property.permissions) !== JSON.stringify(desired.permissions) ||
			JSON.stringify(property.format) !== JSON.stringify(desired.format)
		);
	}

	private propertyIdentifier(property: HomeyMappingPreviewPropertyModel): string {
		return `${property.capabilityId}::${property.mappingName}`;
	}

	private humanize(value: string): string {
		return value.replaceAll(/[-_.]+/g, ' ').replace(/^./, (character) => character.toUpperCase());
	}

	private async rollback(journal: readonly UndoOperation[]): Promise<boolean> {
		let succeeded = true;

		for (const undo of [...journal].reverse()) {
			try {
				await undo();
			} catch {
				succeeded = false;
			}
		}

		return succeeded;
	}

	private withDeviceLock<T>(deviceId: string, operation: () => Promise<T>): Promise<T> {
		const previous = this.deviceTails.get(deviceId) ?? Promise.resolve();
		let release: () => void = () => {};
		const ticket = new Promise<void>((resolve) => {
			release = resolve;
		});
		const tail = previous.then(
			() => ticket,
			() => ticket,
		);
		this.deviceTails.set(deviceId, tail);

		return previous.then(operation, operation).finally(() => {
			release();
			if (this.deviceTails.get(deviceId) === tail) {
				this.deviceTails.delete(deviceId);
			}
		});
	}

	private success(deviceId: string, status: HomeyAdoptionStatus, panelDeviceId: string): HomeyAdoptionResultModel {
		return Object.assign(new HomeyAdoptionResultModel(), {
			deviceId,
			status,
			panelDeviceId,
			failureCode: null,
			message: null,
		});
	}

	private failure(deviceId: string, code: HomeyAdoptionFailureCode): HomeyAdoptionResultModel {
		const messages: Record<HomeyAdoptionFailureCode, string> = {
			[HomeyAdoptionFailureCode.UNAVAILABLE]: 'Homey adoption is not currently available',
			[HomeyAdoptionFailureCode.DEVICE_NOT_FOUND]: 'The selected Homey device no longer exists',
			[HomeyAdoptionFailureCode.UNSUPPORTED_MAPPING]: 'The current Homey device mapping cannot be adopted',
			[HomeyAdoptionFailureCode.PERSISTENCE_FAILED]: 'The Homey device could not be adopted',
			[HomeyAdoptionFailureCode.ROLLBACK_FAILED]: 'Homey adoption failed and requires local cleanup',
		};

		return Object.assign(new HomeyAdoptionResultModel(), {
			deviceId,
			status: HomeyAdoptionStatus.FAILED,
			panelDeviceId: null,
			failureCode: code,
			message: messages[code],
		});
	}
}

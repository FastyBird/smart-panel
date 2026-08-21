import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { ChannelCategory, DataTypeType } from '../../../modules/devices/devices.constants';
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
import { UpdateHomeyChannelDto } from '../dto/update-channel.dto';
import { UpdateHomeyDeviceDto } from '../dto/update-device.dto';
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

import {
	HomeyAdoptionLease,
	HomeyAdoptionLockLostError,
	HomeyAdoptionLockService,
} from './homey-adoption-lock.service';
import { HomeyMappingPreviewService } from './homey-mapping-preview.service';

const CONCURRENT_CREATION_POLL_INTERVAL_MS = 50;
const CONCURRENT_CREATION_TIMEOUT_MS = 5_000;

type UndoOperation = () => Promise<void>;

interface PropertySnapshot {
	readonly entity: HomeyChannelPropertyEntity;
	readonly createDto: CreateHomeyDeviceChannelPropertyDto;
	readonly homeyCapabilityId: string | null;
	readonly homeyMappingName: string | null;
	readonly value: PropertyValueState | null;
}

interface ExistingHierarchySnapshot {
	readonly propertiesById: ReadonlyMap<string, PropertySnapshot>;
}

type DeferredRemoval =
	| { readonly kind: 'channel'; readonly id: string }
	| { readonly kind: 'property'; readonly id: string };

interface PendingValueWrite {
	readonly property: HomeyChannelPropertyEntity;
	readonly value: string | number | boolean;
	readonly previous: PropertyValueState | null;
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
		private readonly adoptionLock: HomeyAdoptionLockService,
	) {}

	async adoptOne(selection: HomeyAdoptDeviceDto): Promise<HomeyAdoptionResultModel> {
		return this.withDeviceLock(selection.deviceId, async () => {
			try {
				return await this.adoptionLock.runExclusive(selection.deviceId, (lease) => this.adoptLocked(selection, lease));
			} catch {
				this.logger.warn('Homey adoption persistence failed before reconciliation completed');

				return this.failure(selection.deviceId, HomeyAdoptionFailureCode.PERSISTENCE_FAILED);
			}
		});
	}

	private async adoptLocked(
		selection: HomeyAdoptDeviceDto,
		lease: HomeyAdoptionLease,
	): Promise<HomeyAdoptionResultModel> {
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
			await lease.assertOwned();

			return await this.persist(selection, preview, lease);
		} catch {
			this.logger.warn('Homey adoption persistence failed before reconciliation completed');

			return this.failure(selection.deviceId, HomeyAdoptionFailureCode.PERSISTENCE_FAILED);
		}
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
		lease: HomeyAdoptionLease,
	): Promise<HomeyAdoptionResultModel> {
		let existing = await this.devicesService.findOneBy<HomeyDeviceEntity>(
			'identifier',
			preview.device.id,
			DEVICES_HOMEY_TYPE,
		);

		if (existing === null) {
			const preallocatedDeviceId = randomUUID();
			try {
				await lease.assertOwned();
				const created = await this.devicesService.create<HomeyDeviceEntity, CreateHomeyDeviceDto>({
					...this.createDeviceDto(selection, preview),
					id: preallocatedDeviceId,
				});
				await lease.assertOwned();
				await this.applyCreatedValues(created, preview, lease);

				return this.success(preview.device.id, HomeyAdoptionStatus.CREATED, created.id);
			} catch (error) {
				if (error instanceof HomeyAdoptionLockLostError) {
					throw error;
				}
				await lease.assertOwned();
				let partial: HomeyDeviceEntity | null;

				try {
					partial = await this.devicesService.findOne<HomeyDeviceEntity>(preallocatedDeviceId, DEVICES_HOMEY_TYPE);
				} catch {
					this.logger.warn('Homey device partial-create ownership could not be verified');

					return this.failure(preview.device.id, HomeyAdoptionFailureCode.ROLLBACK_FAILED);
				}

				if (partial !== null && partial.identifier === preview.device.id) {
					try {
						await lease.assertOwned();
						await this.devicesService.rollbackUnannouncedCreate(preallocatedDeviceId);
					} catch (cleanupError) {
						if (cleanupError instanceof HomeyAdoptionLockLostError) {
							throw cleanupError;
						}
						this.logger.warn('Homey device partial-create rollback failed');

						return this.failure(preview.device.id, HomeyAdoptionFailureCode.ROLLBACK_FAILED);
					}

					return this.failure(preview.device.id, HomeyAdoptionFailureCode.PERSISTENCE_FAILED);
				}

				// A different process may have won the provider-scoped unique insert. Its parent row is
				// visible before DevicesService.create() finishes the nested channels, properties, and their
				// initial value writes, so an immediate reconciliation could mutate that half-built hierarchy
				// and make the winner roll the shared parent back or duplicate history. Only hand off after
				// every expected child and initial measurement are visible.
				const concurrent = await this.devicesService.findOneBy<HomeyDeviceEntity>(
					'identifier',
					preview.device.id,
					DEVICES_HOMEY_TYPE,
				);

				if (concurrent === null) {
					this.logger.warn('Homey device creation failed and no concurrent adoption was found');

					return this.failure(preview.device.id, HomeyAdoptionFailureCode.PERSISTENCE_FAILED);
				}

				existing = await this.waitForConcurrentCreation(concurrent, preview);

				if (existing === null) {
					this.logger.warn('Concurrent Homey device creation did not complete before adoption handoff');

					return this.failure(preview.device.id, HomeyAdoptionFailureCode.PERSISTENCE_FAILED);
				}
			}
		}

		return this.reconcileExisting(selection, preview, existing, lease);
	}

	private async waitForConcurrentCreation(
		initial: HomeyDeviceEntity,
		preview: HomeyMappingPreviewModel,
	): Promise<HomeyDeviceEntity | null> {
		const deadline = Date.now() + CONCURRENT_CREATION_TIMEOUT_MS;
		let candidate: HomeyDeviceEntity | null = initial;

		while (candidate !== null) {
			if (await this.isConcurrentCreationComplete(candidate, preview)) {
				return candidate;
			}
			if (Date.now() >= deadline) {
				return null;
			}

			await new Promise<void>((resolve) => setTimeout(resolve, CONCURRENT_CREATION_POLL_INTERVAL_MS));
			candidate = await this.devicesService.findOneBy<HomeyDeviceEntity>(
				'identifier',
				preview.device.id,
				DEVICES_HOMEY_TYPE,
			);
		}

		return null;
	}

	private async isConcurrentCreationComplete(
		device: HomeyDeviceEntity,
		preview: HomeyMappingPreviewModel,
	): Promise<boolean> {
		if (!this.hasExpectedHierarchy(device, preview)) {
			return false;
		}

		const channels = new Map(
			(device.channels ?? [])
				.filter(
					(channel): channel is HomeyChannelEntity =>
						channel.type === DEVICES_HOMEY_TYPE && channel.identifier !== null,
				)
				.map((channel) => [channel.identifier, channel]),
		);

		for (const desiredChannel of preview.channels) {
			const channel = channels.get(desiredChannel.identifier);

			for (const desiredProperty of desiredChannel.properties) {
				if (!desiredProperty.valueAvailable || desiredProperty.currentValue === null) {
					continue;
				}

				const property = (channel?.properties ?? []).find(
					(candidate): candidate is HomeyChannelPropertyEntity =>
						candidate.type === DEVICES_HOMEY_TYPE && candidate.identifier === this.propertyIdentifier(desiredProperty),
				);

				if (property === undefined) {
					return false;
				}

				try {
					if ((await this.propertyValueService.readLatest(property)) === null) {
						return false;
					}
				} catch {
					return false;
				}
			}
		}

		return true;
	}

	private hasExpectedHierarchy(device: HomeyDeviceEntity, preview: HomeyMappingPreviewModel): boolean {
		const channels = new Map(
			(device.channels ?? [])
				.filter(
					(channel): channel is HomeyChannelEntity =>
						channel.type === DEVICES_HOMEY_TYPE && channel.identifier !== null,
				)
				.map((channel) => [channel.identifier, channel]),
		);

		return preview.channels.every((desiredChannel) => {
			const channel = channels.get(desiredChannel.identifier);

			return (
				channel !== undefined &&
				desiredChannel.properties.every((desiredProperty) =>
					(channel.properties ?? []).some(
						(property) =>
							property.type === DEVICES_HOMEY_TYPE && property.identifier === this.propertyIdentifier(desiredProperty),
					),
				)
			);
		});
	}

	private async reconcileExisting(
		selection: HomeyAdoptDeviceDto,
		preview: HomeyMappingPreviewModel,
		device: HomeyDeviceEntity,
		lease: HomeyAdoptionLease,
	): Promise<HomeyAdoptionResultModel> {
		const journal: UndoOperation[] = [];
		const deferredRemovals: DeferredRemoval[] = [];
		const pendingValues: PendingValueWrite[] = [];
		let changed = false;
		// Storage snapshots can be slow and do not mutate the hierarchy, so collect them before taking the
		// process-global structure lock. Only the structural reconciliation and its rollback are serialized.
		const snapshot = await this.snapshotHierarchy(device.id);
		const structuralFailure = await this.structureLock.runExclusive(
			async (): Promise<HomeyAdoptionResultModel | null> => {
				try {
					const lockedDevice = await this.devicesService.findOne<HomeyDeviceEntity>(device.id, DEVICES_HOMEY_TYPE);
					if (lockedDevice === null) {
						throw new Error('Homey device is unavailable during reconciliation');
					}

					for (const desiredChannel of preview.channels) {
						changed =
							(await this.reconcileChannel(
								device.id,
								desiredChannel,
								snapshot,
								pendingValues,
								deferredRemovals,
								journal,
								lease,
							)) || changed;
					}

					changed = (await this.deferStaleChannels(device.id, preview.channels, deferredRemovals)) || changed;

					const desiredName = selection.name ?? preview.device.name;
					const desiredCategory = preview.selectedCategory;
					if (
						lockedDevice.name !== desiredName ||
						lockedDevice.category !== desiredCategory ||
						lockedDevice.identifier !== preview.device.id
					) {
						const previous: UpdateHomeyDeviceDto = {
							type: DEVICES_HOMEY_TYPE,
							name: lockedDevice.name,
							category: lockedDevice.category,
							identifier: lockedDevice.identifier,
						};

						const desiredDevice: UpdateHomeyDeviceDto = {
							type: DEVICES_HOMEY_TYPE,
							name: desiredName,
							category: desiredCategory,
							identifier: preview.device.id,
						};
						journal.push(() => this.restoreDeviceMetadata(device.id, desiredDevice, previous, lease));
						await lease.assertOwned();
						await this.devicesService.update(device.id, desiredDevice);
						changed = true;
					}

					for (const pending of pendingValues) {
						if (pending.previous?.value !== pending.value) {
							changed = true;
						}
					}

					return null;
				} catch (error) {
					if (error instanceof HomeyAdoptionLockLostError) {
						throw error;
					}
					await lease.assertOwned();
					const rolledBack = await this.rollback(journal, lease);
					this.logger.warn(rolledBack ? 'Homey adoption failed and was rolled back' : 'Homey adoption rollback failed');

					return this.failure(
						preview.device.id,
						rolledBack ? HomeyAdoptionFailureCode.PERSISTENCE_FAILED : HomeyAdoptionFailureCode.ROLLBACK_FAILED,
					);
				}
			},
		);

		if (structuralFailure !== null) {
			return structuralFailure;
		}

		// Value writes append measurements and stale removals erase complete value/status series. Commit
		// both terminal operations only after every mutation that can require rollback has succeeded.
		// Individual failures remain for the next idempotent adoption rather than corrupting history with
		// compensating points or turning an already-pruned series into a pretend rollback.
		await this.applyPendingValues(pendingValues, lease);
		await this.pruneStale(deferredRemovals, lease);

		return this.success(
			preview.device.id,
			changed ? HomeyAdoptionStatus.UPDATED : HomeyAdoptionStatus.SKIPPED,
			device.id,
		);
	}

	private async reconcileChannel(
		deviceId: string,
		desired: HomeyMappingPreviewChannelModel,
		snapshot: ExistingHierarchySnapshot,
		pendingValues: PendingValueWrite[],
		deferredRemovals: DeferredRemoval[],
		journal: UndoOperation[],
		lease: HomeyAdoptionLease,
	): Promise<boolean> {
		let changed = false;
		let channel = await this.channelsService.findOneBy<HomeyChannelEntity>(
			'identifier',
			desired.identifier,
			deviceId,
			DEVICES_HOMEY_TYPE,
		);

		if (channel === null) {
			const preallocatedChannelId: string = randomUUID();
			let createdChannel: HomeyChannelEntity | null = null;
			journal.push(async () => {
				if (createdChannel !== null) {
					await lease.assertOwned();
					await this.channelsService.remove(createdChannel.id);

					return;
				}

				await this.removeCreatedChannel(preallocatedChannelId, deviceId, desired.identifier, lease);
			});
			await lease.assertOwned();
			createdChannel = await this.channelsService.create<HomeyChannelEntity, CreateHomeyChannelDto>({
				...this.createChannelDto(desired),
				id: preallocatedChannelId,
				device: deviceId,
			} as CreateHomeyChannelDto);
			channel = createdChannel;
			changed = true;
		} else if (
			channel.name !== desired.name ||
			channel.identifier !== desired.identifier ||
			channel.category !== desired.category
		) {
			const previous: UpdateHomeyChannelDto = {
				type: DEVICES_HOMEY_TYPE,
				name: channel.name,
				identifier: channel.identifier,
				category: channel.category,
			};

			const desiredChannel: UpdateHomeyChannelDto = {
				type: DEVICES_HOMEY_TYPE,
				name: desired.name,
				identifier: desired.identifier,
				category: desired.category,
			};
			const updatedChannelId = channel.id;
			journal.push(() => this.restoreChannelMetadata(updatedChannelId, deviceId, desiredChannel, previous, lease));
			await lease.assertOwned();
			channel = await this.channelsService.update<HomeyChannelEntity, UpdateHomeyChannelDto>(
				channel.id,
				desiredChannel,
			);
			changed = true;
		}

		changed =
			(await this.reconcileProperties(
				channel,
				desired.properties,
				snapshot,
				pendingValues,
				deferredRemovals,
				journal,
				lease,
			)) || changed;

		return changed;
	}

	private async reconcileProperties(
		channel: HomeyChannelEntity,
		desiredProperties: readonly HomeyMappingPreviewPropertyModel[],
		snapshot: ExistingHierarchySnapshot,
		pendingValues: PendingValueWrite[],
		deferredRemovals: DeferredRemoval[],
		journal: UndoOperation[],
		lease: HomeyAdoptionLease,
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

			const desiredDto = this.createPropertyDto(desired);
			if (property === null) {
				const preallocatedPropertyId: string = randomUUID();
				let createdProperty: HomeyChannelPropertyEntity | null = null;
				journal.push(async () => {
					if (createdProperty !== null) {
						await lease.assertOwned();
						await this.channelsPropertiesService.remove(createdProperty.id);

						return;
					}

					await this.removeCreatedProperty(preallocatedPropertyId, channel.id, desiredDto, lease);
				});
				await lease.assertOwned();
				createdProperty = await this.channelsPropertiesService.create(channel.id, {
					...desiredDto,
					id: preallocatedPropertyId,
				});
				property = createdProperty;
				changed = true;
			} else if (this.propertyMetadataChanged(property, desiredDto)) {
				const persistedSnapshot = snapshot.propertiesById.get(property.id);
				if (!persistedSnapshot) {
					throw new Error('Homey property snapshot is unavailable');
				}
				// The persisted value was read before taking the global structure lock. Capture rollback metadata
				// from the row observed under the lock so an unrelated edit made during that slow read is never
				// replaced with stale metadata.
				const previous: PropertySnapshot = {
					entity: property,
					createDto: this.snapshotPropertyDto(property, persistedSnapshot.value),
					homeyCapabilityId: property.homeyCapabilityId,
					homeyMappingName: property.homeyMappingName,
					value: persistedSnapshot.value,
				};

				journal.push(() => this.restorePropertyMetadata(previous, desiredDto, channel.id, lease));
				await lease.assertOwned();
				await this.channelsPropertiesService.update(property.id, {
					type: DEVICES_HOMEY_TYPE,
					identifier: desiredDto.identifier,
					category: desiredDto.category,
					name: desiredDto.name,
					permissions: desiredDto.permissions,
					data_type: desiredDto.data_type,
					format: desiredDto.format,
					invalid: desiredDto.invalid,
					step: desiredDto.step,
					homeyCapabilityId: desiredDto.homeyCapabilityId,
					homeyMappingName: desiredDto.homeyMappingName,
				});
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

			deferredRemovals.push({ kind: 'property', id: candidate.id });
			changed = true;
		}

		return changed;
	}

	private async deferStaleChannels(
		deviceId: string,
		desiredChannels: readonly HomeyMappingPreviewChannelModel[],
		deferredRemovals: DeferredRemoval[],
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

			deferredRemovals.push({ kind: 'channel', id: candidate.id });
			changed = true;
		}

		return changed;
	}

	private async snapshotHierarchy(deviceId: string): Promise<ExistingHierarchySnapshot> {
		const channels = (await this.channelsService.findAll(deviceId)).filter(
			(channel): channel is HomeyChannelEntity => channel.type === DEVICES_HOMEY_TYPE,
		);
		const propertiesById = new Map<string, PropertySnapshot>();

		for (const channel of channels) {
			const properties = (await this.channelsPropertiesService.findAll(channel.id)).filter(
				(property): property is HomeyChannelPropertyEntity => property.type === DEVICES_HOMEY_TYPE,
			);
			for (const property of properties) {
				const value = await this.propertyValueService.readLatestPersisted(property);
				const propertySnapshot: PropertySnapshot = {
					entity: property,
					createDto: this.snapshotPropertyDto(property, value),
					homeyCapabilityId: property.homeyCapabilityId,
					homeyMappingName: property.homeyMappingName,
					value,
				};
				propertiesById.set(property.id, propertySnapshot);
			}
		}

		return { propertiesById };
	}

	private createDeviceDto(selection: HomeyAdoptDeviceDto, preview: HomeyMappingPreviewModel): CreateHomeyDeviceDto {
		return {
			type: DEVICES_HOMEY_TYPE,
			identifier: preview.device.id,
			name: selection.name ?? preview.device.name,
			category: preview.selectedCategory,
			channels: preview.channels.map((channel) => this.createChannelDto(channel)),
		} as CreateHomeyDeviceDto;
	}

	private createChannelDto(channel: HomeyMappingPreviewChannelModel): CreateHomeyDeviceChannelDto {
		return {
			type: DEVICES_HOMEY_TYPE,
			identifier: channel.identifier,
			name: channel.name,
			category: channel.category,
			properties: channel.properties.map((property) => this.createPropertyDto(property)),
		} as CreateHomeyDeviceChannelDto;
	}

	private createPropertyDto(property: HomeyMappingPreviewPropertyModel): CreateHomeyDeviceChannelPropertyDto {
		const panelEnumValues = property.panelEnumValues ?? [];
		const format =
			property.dataType === DataTypeType.ENUM && panelEnumValues.length > 0
				? [...panelEnumValues]
				: property.range !== null && (property.range.minimum !== null || property.range.maximum !== null)
					? ([property.range.minimum, property.range.maximum] as unknown as number[])
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
		} as CreateHomeyDeviceChannelPropertyDto;
	}

	private async applyCreatedValues(
		device: HomeyDeviceEntity,
		preview: HomeyMappingPreviewModel,
		lease: HomeyAdoptionLease,
	): Promise<void> {
		const channels = new Map(
			(device.channels ?? [])
				.filter(
					(channel): channel is HomeyChannelEntity =>
						channel.type === DEVICES_HOMEY_TYPE && channel.identifier !== null,
				)
				.map((channel) => [channel.identifier, channel]),
		);
		const pendingValues: PendingValueWrite[] = [];

		for (const desiredChannel of preview.channels) {
			const channel = channels.get(desiredChannel.identifier);

			for (const desiredProperty of desiredChannel.properties) {
				if (!desiredProperty.valueAvailable || desiredProperty.currentValue === null) {
					continue;
				}

				const property = (channel?.properties ?? []).find(
					(candidate): candidate is HomeyChannelPropertyEntity =>
						candidate.type === DEVICES_HOMEY_TYPE && candidate.identifier === this.propertyIdentifier(desiredProperty),
				);

				if (property !== undefined) {
					pendingValues.push({ property, value: desiredProperty.currentValue, previous: null });
				}
			}
		}

		await this.applyPendingValues(pendingValues, lease);
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

	private async restoreDeviceMetadata(
		deviceId: string,
		expected: UpdateHomeyDeviceDto,
		previous: UpdateHomeyDeviceDto,
		lease: HomeyAdoptionLease,
	): Promise<void> {
		const current = await this.devicesService.findOne<HomeyDeviceEntity>(deviceId, DEVICES_HOMEY_TYPE);

		if (
			current !== null &&
			current.identifier === expected.identifier &&
			current.name === expected.name &&
			current.category === expected.category
		) {
			await lease.assertOwned();
			await this.devicesService.update(deviceId, previous);
		}
	}

	private async restoreChannelMetadata(
		channelId: string,
		deviceId: string,
		expected: UpdateHomeyChannelDto,
		previous: UpdateHomeyChannelDto,
		lease: HomeyAdoptionLease,
	): Promise<void> {
		const current = await this.channelsService.findOne<HomeyChannelEntity>(channelId, deviceId, DEVICES_HOMEY_TYPE);

		if (
			current !== null &&
			current.identifier === expected.identifier &&
			current.name === expected.name &&
			current.category === expected.category
		) {
			await lease.assertOwned();
			await this.channelsService.update(channelId, previous);
		}
	}

	private async restorePropertyMetadata(
		snapshot: PropertySnapshot,
		expected: CreateHomeyDeviceChannelPropertyDto,
		channelId: string,
		lease: HomeyAdoptionLease,
	): Promise<void> {
		const current = await this.channelsPropertiesService.findOne<HomeyChannelPropertyEntity>(
			snapshot.entity.id,
			channelId,
			DEVICES_HOMEY_TYPE,
		);

		if (current === null || this.propertyMetadataChanged(current, expected)) {
			return;
		}

		await lease.assertOwned();
		await this.channelsPropertiesService.update(snapshot.entity.id, {
			type: DEVICES_HOMEY_TYPE,
			identifier: snapshot.createDto.identifier,
			category: snapshot.createDto.category,
			name: snapshot.createDto.name,
			permissions: snapshot.createDto.permissions,
			data_type: snapshot.createDto.data_type,
			format: snapshot.createDto.format,
			invalid: snapshot.createDto.invalid,
			step: snapshot.createDto.step,
			homeyCapabilityId: snapshot.homeyCapabilityId,
			homeyMappingName: snapshot.homeyMappingName,
		});
	}

	private async removeCreatedChannel(
		channelId: string,
		deviceId: string,
		desiredIdentifier: string,
		lease: HomeyAdoptionLease,
	): Promise<void> {
		const channel = await this.channelsService.findOne<HomeyChannelEntity>(channelId, deviceId, DEVICES_HOMEY_TYPE);

		if (channel !== null && channel.identifier === desiredIdentifier) {
			await lease.assertOwned();
			await this.channelsService.remove(channelId);
		}
	}

	private async removeCreatedProperty(
		propertyId: string,
		channelId: string,
		desired: CreateHomeyDeviceChannelPropertyDto,
		lease: HomeyAdoptionLease,
	): Promise<void> {
		const property = await this.channelsPropertiesService.findOne<HomeyChannelPropertyEntity>(
			propertyId,
			channelId,
			DEVICES_HOMEY_TYPE,
		);

		if (
			property !== null &&
			property.identifier === desired.identifier &&
			property.homeyCapabilityId === desired.homeyCapabilityId &&
			property.homeyMappingName === desired.homeyMappingName
		) {
			await lease.assertOwned();
			await this.channelsPropertiesService.remove(propertyId);
		}
	}

	private propertyMetadataChanged(
		property: HomeyChannelPropertyEntity,
		desired: CreateHomeyDeviceChannelPropertyDto,
	): boolean {
		return (
			property.identifier !== desired.identifier ||
			property.category !== desired.category ||
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

	private async applyPendingValues(writes: readonly PendingValueWrite[], lease: HomeyAdoptionLease): Promise<void> {
		for (const pending of writes) {
			await lease.assertOwned();
			try {
				// The hierarchy snapshot intentionally happens outside the global structure lock. Another normal
				// property writer may therefore have persisted after it; compare against the active backend again
				// at the terminal boundary so an already-current value is not appended twice or overwritten by
				// an older preview solely because pending.previous is stale.
				const latest = await this.propertyValueService.readLatestPersisted(pending.property);

				if (latest?.value === pending.value) {
					continue;
				}

				await lease.assertOwned();
				await this.channelsPropertiesService.update(
					pending.property.id,
					{
						type: DEVICES_HOMEY_TYPE,
						value: pending.value,
					},
					{ strictValuePersistence: true },
				);
			} catch {
				await lease.assertOwned();
				this.logger.warn('Homey current value persistence was deferred until the next adoption');
			}
		}

		await lease.assertOwned();
	}

	private async pruneStale(removals: readonly DeferredRemoval[], lease: HomeyAdoptionLease): Promise<void> {
		for (const removal of removals) {
			await lease.assertOwned();
			try {
				if (removal.kind === 'property') {
					await this.channelsPropertiesService.remove(removal.id);
				} else {
					await this.channelsService.remove(removal.id);
				}
			} catch {
				await lease.assertOwned();
				this.logger.warn('Homey stale structure pruning was deferred until the next adoption');
			}
		}

		await lease.assertOwned();
	}

	private propertyIdentifier(property: HomeyMappingPreviewPropertyModel): string {
		return `${property.capabilityId}::${property.mappingName}`;
	}

	private humanize(value: string): string {
		return value.replaceAll(/[-_.]+/g, ' ').replace(/^./, (character) => character.toUpperCase());
	}

	private async rollback(journal: readonly UndoOperation[], lease: HomeyAdoptionLease): Promise<boolean> {
		let succeeded = true;

		for (const undo of [...journal].reverse()) {
			await lease.assertOwned();
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

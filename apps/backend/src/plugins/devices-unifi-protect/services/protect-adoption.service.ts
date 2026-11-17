import { DataSource } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { ConfigService } from '../../../modules/config/services/config.service';
import { ChannelCategory, ConnectionState } from '../../../modules/devices/devices.constants';
import { PropertyValueState } from '../../../modules/devices/models/property-value-state.model';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DeviceCreationContext } from '../../../modules/devices/services/device-creation-context';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import {
	DEVICES_UNIFI_PROTECT_PLUGIN_NAME,
	DEVICES_UNIFI_PROTECT_TYPE,
	PROTECT_RTSPS_QUALITIES,
	ProtectStreamQuality,
} from '../devices-unifi-protect.constants';
import { CreateProtectChannelDto } from '../dto/create-channel.dto';
import { CreateProtectDeviceChannelPropertyDto } from '../dto/create-device-channel-property.dto';
import { CreateProtectDeviceChannelDto } from '../dto/create-device-channel.dto';
import { CreateProtectDeviceDto } from '../dto/create-device.dto';
import { ProtectAdoptDeviceDto } from '../dto/protect-adoption.dto';
import { UpdateProtectChannelDto } from '../dto/update-channel.dto';
import { UpdateProtectDeviceDto } from '../dto/update-device.dto';
import {
	ProtectChannelEntity,
	ProtectChannelPropertyEntity,
	ProtectDeviceEntity,
} from '../entities/devices-unifi-protect.entity';
import {
	ProtectConsoleUnavailableError,
	ProtectDeviceNotFoundError,
	ProtectUnsupportedDeviceError,
} from '../errors/protect-adoption.error';
import { ProtectErrorCategory } from '../errors/protect-api.error';
import { ProtectMappedChannel, ProtectMappedDevice, ProtectMappedProperty } from '../mappings/mapping-evaluator';
import { ProtectMappingLoaderService } from '../mappings/mapping-loader.service';
import { ProtectModelKey } from '../mappings/mapping.types';
import {
	ProtectAdoptionFailureCode,
	ProtectAdoptionResultModel,
	ProtectAdoptionStatus,
	ProtectAdoptionStreamModel,
	ProtectAdoptionWarningCode,
	ProtectStreamOutcome,
} from '../models/protect-adoption.model';

import { ProtectAdoptionLockService } from './protect-adoption-lock.service';
import { ProtectAdoptionStreamsService, ProtectStreamEnablementResult } from './protect-adoption-streams.service';
import { readDefaultStreamQuality } from './protect-default-stream-quality';
import { ProtectMappingPreviewService, ProtectPreparedMapping } from './protect-mapping-preview.service';
import { ProtectStreamAvailabilityStore } from './protect-stream-availability.store';

const CONNECTION_STATE_IDENTIFIER = 'connection_state';
const STATUS_IDENTIFIER = 'status';
const STREAM_CHANNELS = ['camera.main', 'camera.package'] as const;

const FAILURE_MESSAGES: Record<ProtectAdoptionFailureCode, string> = {
	[ProtectAdoptionFailureCode.UNAVAILABLE]: 'The UniFi Protect console is not connected',
	[ProtectAdoptionFailureCode.DEVICE_NOT_FOUND]: 'The device was not found on the UniFi Protect console',
	[ProtectAdoptionFailureCode.UNSUPPORTED_MAPPING]: 'The device has no supported mapping',
	[ProtectAdoptionFailureCode.NOT_READY]: 'The device mapping does not satisfy the device specification',
	[ProtectAdoptionFailureCode.PERSISTENCE_FAILED]: 'The device could not be saved; no change was kept',
	[ProtectAdoptionFailureCode.ROLLBACK_FAILED]: 'The device could not be saved and some changes could not be undone',
};

type UndoOperation = () => Promise<void>;

/** The metadata `UpdateProtectChannelPropertyDto` accepts; identity (category, mapping name) never changes. */
interface PropertyMetadata {
	identifier: string;
	name: string;
	permissions: ProtectChannelPropertyEntity['permissions'];
	data_type: ProtectChannelPropertyEntity['dataType'];
	format: ProtectChannelPropertyEntity['format'];
	invalid: ProtectChannelPropertyEntity['invalid'];
	step: number | null;
}

interface PropertySnapshot {
	readonly metadata: PropertyMetadata;
	readonly value: PropertyValueState | null;
}

interface ExistingHierarchySnapshot {
	readonly propertiesById: ReadonlyMap<string, PropertySnapshot>;
}

type DeferredRemoval =
	| { readonly kind: 'channel'; readonly id: string; readonly deviceId: string; readonly identifier: string }
	| {
			readonly kind: 'property';
			readonly id: string;
			readonly channelId: string;
			readonly identifier: string;
			readonly protectMappingName: string;
	  };

interface PendingValueWrite {
	readonly propertyId: string;
	readonly value: string | number | boolean;
	readonly previous: PropertyValueState | null;
}

interface CreatePlan {
	readonly dto: CreateProtectDeviceDto;
	readonly writes: PendingValueWrite[];
}

@Injectable()
export class ProtectAdoptionService {
	private readonly logger = createExtensionLogger(DEVICES_UNIFI_PROTECT_PLUGIN_NAME, 'ProtectAdoptionService');
	private constantMappings: ReadonlySet<string> | null = null;

	constructor(
		private readonly preview: ProtectMappingPreviewService,
		private readonly devicesService: DevicesService,
		private readonly channelsService: ChannelsService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly propertyValueService: PropertyValueService,
		private readonly connectivity: DeviceConnectivityService,
		private readonly structureLock: DeviceStructureLockService,
		private readonly lock: ProtectAdoptionLockService,
		private readonly dataSource: DataSource,
		private readonly mappingLoader: ProtectMappingLoaderService,
		private readonly streams: ProtectAdoptionStreamsService,
		private readonly configService: ConfigService,
		private readonly streamAvailability: ProtectStreamAvailabilityStore,
	) {}

	/** Never rejects: every failure is an item result. */
	adoptOne(selection: ProtectAdoptDeviceDto): Promise<ProtectAdoptionResultModel> {
		return this.lock.run(selection.deviceId, async () => {
			try {
				return await this.adoptLocked(selection);
			} catch {
				this.logger.warn('UniFi Protect adoption failed before it completed');

				return this.failure(selection, ProtectAdoptionFailureCode.PERSISTENCE_FAILED);
			}
		});
	}

	async adoptBatch(selections: readonly ProtectAdoptDeviceDto[]): Promise<ProtectAdoptionResultModel[]> {
		const results: ProtectAdoptionResultModel[] = [];

		for (const selection of selections) {
			results.push(await this.adoptOne(selection));
		}

		return results;
	}

	private async adoptLocked(selection: ProtectAdoptDeviceDto): Promise<ProtectAdoptionResultModel> {
		let prepared: ProtectPreparedMapping;

		try {
			prepared = await this.preview.prepare(selection.deviceId, selection.modelKey);
		} catch (error) {
			return this.failure(selection, this.codeForPrepareError(error));
		}

		if (!prepared.readyToAdopt) {
			return this.failure(selection, ProtectAdoptionFailureCode.NOT_READY);
		}

		const device = prepared.device;
		const existing = await this.devicesService.findOneBy<ProtectDeviceEntity>(
			'identifier',
			device.identifier,
			DEVICES_UNIFI_PROTECT_TYPE,
		);

		if (existing !== null) {
			return this.reconcileExisting(selection, prepared, existing);
		}

		const plan = this.createPlan(selection, device);

		try {
			await this.structureLock.runExclusive(() =>
				DeviceCreationContext.run(
					(work) => this.dataSource.transaction(work),
					DEVICES_UNIFI_PROTECT_TYPE,
					(context) => this.devicesService.create<ProtectDeviceEntity, CreateProtectDeviceDto>(plan.dto, context),
					() => undefined,
				),
			);
		} catch {
			// The transaction left nothing behind. A concurrent adoption that won the unique insert is reconciled.
			const winner = await this.devicesService.findOneBy<ProtectDeviceEntity>(
				'identifier',
				device.identifier,
				DEVICES_UNIFI_PROTECT_TYPE,
			);

			if (winner === null) {
				this.logger.warn('UniFi Protect device creation failed and no concurrent adoption was found');

				return this.failure(selection, ProtectAdoptionFailureCode.PERSISTENCE_FAILED);
			}

			return this.reconcileExisting(selection, prepared, winner);
		}

		const complete = await this.applyTerminalValues(plan.writes, device, plan.dto.id);

		return this.finishWithStreams(selection, prepared, ProtectAdoptionStatus.CREATED, plan.dto.id, complete);
	}

	private async reconcileExisting(
		selection: ProtectAdoptDeviceDto,
		prepared: ProtectPreparedMapping,
		existing: ProtectDeviceEntity,
	): Promise<ProtectAdoptionResultModel> {
		const device = prepared.device;
		const journal: UndoOperation[] = [];
		const deferredRemovals: DeferredRemoval[] = [];
		const pendingValues: PendingValueWrite[] = [];
		let changed = false;

		// Storage snapshots can be slow and never mutate the hierarchy: take them before the structure lock.
		const snapshot = await this.snapshotHierarchy(existing.id);
		const structuralFailure = await this.structureLock.runExclusive(
			async (): Promise<ProtectAdoptionResultModel | null> => {
				try {
					const lockedDevice = await this.devicesService.findOne<ProtectDeviceEntity>(
						existing.id,
						DEVICES_UNIFI_PROTECT_TYPE,
					);

					if (lockedDevice === null) {
						throw new Error('The device is unavailable during reconciliation');
					}

					// The identity columns are written by creation only; a disagreement is never repaired.
					if (
						lockedDevice.protectNvrId !== device.protectNvrId ||
						lockedDevice.protectDeviceId !== device.protectDeviceId ||
						lockedDevice.protectModelKey !== device.protectModelKey
					) {
						throw new Error('The stored device identity does not match the console device');
					}

					for (const desiredChannel of device.channels) {
						changed =
							(await this.reconcileChannel(
								existing.id,
								desiredChannel,
								snapshot,
								pendingValues,
								deferredRemovals,
								journal,
							)) || changed;
					}

					changed = (await this.deferStaleChannels(existing.id, device.channels, deferredRemovals)) || changed;

					// No column records the last console name, so a Smart Panel rename survives re-adoption.
					const desiredName = selection.name ?? lockedDevice.name;

					if (lockedDevice.name !== desiredName || lockedDevice.category !== device.category) {
						const previous: UpdateProtectDeviceDto = {
							type: DEVICES_UNIFI_PROTECT_TYPE,
							name: lockedDevice.name,
							category: lockedDevice.category,
							identifier: lockedDevice.identifier,
						};
						const desired: UpdateProtectDeviceDto = {
							type: DEVICES_UNIFI_PROTECT_TYPE,
							name: desiredName,
							category: device.category,
							identifier: device.identifier,
						};

						journal.push(() => this.restoreDeviceMetadata(existing.id, desired, previous));
						await this.devicesService.update(existing.id, desired);
						changed = true;
					}

					for (const pending of pendingValues) {
						if (pending.previous?.value !== pending.value) {
							changed = true;
						}
					}

					return null;
				} catch {
					const rolledBack = await this.rollback(journal);

					this.logger.warn(
						rolledBack ? 'UniFi Protect adoption failed and was rolled back' : 'UniFi Protect adoption rollback failed',
					);

					return this.failure(
						selection,
						rolledBack ? ProtectAdoptionFailureCode.PERSISTENCE_FAILED : ProtectAdoptionFailureCode.ROLLBACK_FAILED,
					);
				}
			},
		);

		if (structuralFailure !== null) {
			return structuralFailure;
		}

		// Value writes append measurements and pruning erases value series: both stay behind every step that can
		// require a rollback. A failure is left to the next adoption instead of compensating with new points.
		const complete = await this.applyTerminalValues(pendingValues, device, existing.id);

		const structureComplete = await this.structureLock.runExclusive(() => this.pruneStale(deferredRemovals));

		return this.finishWithStreams(
			selection,
			prepared,
			changed ? ProtectAdoptionStatus.UPDATED : ProtectAdoptionStatus.SKIPPED,
			existing.id,
			complete,
			structureComplete,
		);
	}

	private async reconcileChannel(
		deviceId: string,
		desired: ProtectMappedChannel,
		snapshot: ExistingHierarchySnapshot,
		pendingValues: PendingValueWrite[],
		deferredRemovals: DeferredRemoval[],
		journal: UndoOperation[],
	): Promise<boolean> {
		let changed = false;
		let channel = await this.channelsService.findOneBy<ProtectChannelEntity>(
			'identifier',
			desired.identifier,
			deviceId,
			DEVICES_UNIFI_PROTECT_TYPE,
		);

		if (channel === null) {
			const preallocatedChannelId = uuid();
			let createdChannel: ProtectChannelEntity | null = null;

			journal.push(async () => {
				if (createdChannel !== null) {
					await this.channelsService.remove(createdChannel.id);

					return;
				}

				await this.removeCreatedChannel(preallocatedChannelId, deviceId, desired.identifier);
			});
			createdChannel = await this.channelsService.create<ProtectChannelEntity, CreateProtectChannelDto>({
				...this.createChannelDto(desired),
				id: preallocatedChannelId,
				device: deviceId,
			} as unknown as CreateProtectChannelDto);
			channel = createdChannel;
			changed = true;
		} else if (
			channel.name !== desired.name ||
			channel.identifier !== desired.identifier ||
			channel.category !== desired.category
		) {
			const previous: UpdateProtectChannelDto = {
				type: DEVICES_UNIFI_PROTECT_TYPE,
				name: channel.name,
				identifier: channel.identifier,
				category: channel.category,
			};
			const target: UpdateProtectChannelDto = {
				type: DEVICES_UNIFI_PROTECT_TYPE,
				name: desired.name,
				identifier: desired.identifier,
				category: desired.category,
			};
			const updatedChannelId = channel.id;

			journal.push(() => this.restoreChannelMetadata(updatedChannelId, deviceId, target, previous));
			channel = await this.channelsService.update<ProtectChannelEntity, UpdateProtectChannelDto>(channel.id, target);
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
			)) || changed;

		return changed;
	}

	private async reconcileProperties(
		channel: ProtectChannelEntity,
		desiredProperties: readonly ProtectMappedProperty[],
		snapshot: ExistingHierarchySnapshot,
		pendingValues: PendingValueWrite[],
		deferredRemovals: DeferredRemoval[],
		journal: UndoOperation[],
	): Promise<boolean> {
		let changed = false;
		const matchedPropertyIds = new Set<string>();
		const currentProperties = (
			await this.channelsPropertiesService.findAll(channel.id, DEVICES_UNIFI_PROTECT_TYPE)
		).filter((property): property is ProtectChannelPropertyEntity => property.type === DEVICES_UNIFI_PROTECT_TYPE);

		for (const desired of desiredProperties) {
			let property =
				currentProperties.find((candidate) => candidate.protectMappingName === desired.mappingName) ??
				currentProperties.find((candidate) => candidate.identifier === desired.identifier);

			if (property !== undefined) {
				// Category and mapping name cannot be updated; a candidate that differs is never adopted. A missing
				// mapping name (A20: connection_state recreated by the connectivity service) is accepted, not written.
				if (
					property.category !== desired.category ||
					(property.protectMappingName !== null && property.protectMappingName !== desired.mappingName)
				) {
					throw new Error('A stored property does not match the mapped property');
				}

				matchedPropertyIds.add(property.id);
			}

			const desiredDto = this.createPropertyDto(desired);

			if (property === undefined) {
				const preallocatedPropertyId = uuid();
				let createdProperty: ProtectChannelPropertyEntity | null = null;

				journal.push(async () => {
					if (createdProperty !== null) {
						await this.channelsPropertiesService.remove(createdProperty.id);

						return;
					}

					await this.removeCreatedProperty(preallocatedPropertyId, channel.id, desiredDto);
				});
				createdProperty = await this.channelsPropertiesService.create(channel.id, {
					...desiredDto,
					id: preallocatedPropertyId,
				});
				property = createdProperty;
				changed = true;
			} else if (this.propertyMetadataChanged(property, desiredDto)) {
				const persistedSnapshot = snapshot.propertiesById.get(property.id);

				if (!persistedSnapshot) {
					throw new Error('The property snapshot is unavailable');
				}

				// Roll back from the row observed under the lock, so an unrelated edit made during the slow
				// snapshot read is never replaced with stale metadata.
				const previous = this.snapshotMetadata(property);

				journal.push(() => this.restorePropertyMetadata(property.id, previous, desiredDto, channel.id));
				await this.channelsPropertiesService.update(property.id, {
					type: DEVICES_UNIFI_PROTECT_TYPE,
					identifier: desiredDto.identifier,
					name: desiredDto.name,
					permissions: desiredDto.permissions,
					data_type: desiredDto.data_type,
					format: desiredDto.format,
					invalid: desiredDto.invalid,
					step: desiredDto.step,
				} as never);
				property = await this.channelsPropertiesService.findOne<ProtectChannelPropertyEntity>(
					property.id,
					channel.id,
					DEVICES_UNIFI_PROTECT_TYPE,
				);

				if (property === null) {
					throw new Error('The updated property is unavailable');
				}

				changed = true;
			}

			if (desired.value !== null && desired.identifier !== CONNECTION_STATE_IDENTIFIER) {
				const previous = snapshot.propertiesById.get(property.id)?.value ?? null;

				// A constant is only an initial value: a stored value (possibly live) is never overwritten.
				if (!(previous !== null && this.isConstant(desired.mappingName))) {
					pendingValues.push({ propertyId: property.id, value: desired.value, previous });
				}
			}
		}

		for (const candidate of currentProperties) {
			if (
				candidate.identifier === null ||
				typeof candidate.protectMappingName !== 'string' ||
				matchedPropertyIds.has(candidate.id)
			) {
				continue;
			}

			deferredRemovals.push({
				kind: 'property',
				id: candidate.id,
				channelId: channel.id,
				identifier: candidate.identifier,
				protectMappingName: candidate.protectMappingName,
			});
			changed = true;
		}

		return changed;
	}

	private async deferStaleChannels(
		deviceId: string,
		desiredChannels: readonly ProtectMappedChannel[],
		deferredRemovals: DeferredRemoval[],
	): Promise<boolean> {
		const desiredIdentifiers = new Set(desiredChannels.map((channel) => channel.identifier));
		const current = await this.channelsService.findAll(deviceId);
		let changed = false;

		for (const candidate of current) {
			if (
				candidate.type !== DEVICES_UNIFI_PROTECT_TYPE ||
				candidate.category === ChannelCategory.DEVICE_INFORMATION ||
				candidate.identifier === null ||
				desiredIdentifiers.has(candidate.identifier)
			) {
				continue;
			}

			deferredRemovals.push({ kind: 'channel', id: candidate.id, deviceId, identifier: candidate.identifier });
			changed = true;
		}

		return changed;
	}

	private async snapshotHierarchy(deviceId: string): Promise<ExistingHierarchySnapshot> {
		const channels = (await this.channelsService.findAll(deviceId)).filter(
			(channel): channel is ProtectChannelEntity => channel.type === DEVICES_UNIFI_PROTECT_TYPE,
		);
		const propertiesById = new Map<string, PropertySnapshot>();

		for (const channel of channels) {
			const properties = (await this.channelsPropertiesService.findAll(channel.id)).filter(
				(property): property is ProtectChannelPropertyEntity => property.type === DEVICES_UNIFI_PROTECT_TYPE,
			);

			for (const property of properties) {
				const value = await this.propertyValueService.readLatestPersisted(property);

				propertiesById.set(property.id, { metadata: this.snapshotMetadata(property), value });
			}
		}

		return { propertiesById };
	}

	private snapshotMetadata(property: ProtectChannelPropertyEntity): PropertyMetadata {
		return {
			identifier: property.identifier,
			name: property.name,
			permissions: [...property.permissions],
			data_type: property.dataType,
			format: (property.format === null ? null : [...property.format]) as PropertyMetadata['format'],
			invalid: property.invalid,
			step: property.step,
		};
	}

	private createPlan(selection: ProtectAdoptDeviceDto, device: ProtectMappedDevice): CreatePlan {
		const writes: PendingValueWrite[] = [];
		const channels = device.channels.map((channel) => {
			const dto = this.createChannelDto(channel, true);

			for (const [index, property] of channel.properties.entries()) {
				if (property.value !== null && property.identifier !== CONNECTION_STATE_IDENTIFIER) {
					writes.push({ propertyId: dto.properties[index].id, value: property.value, previous: null });
				}
			}

			return dto;
		});
		const dto = {
			id: uuid(),
			type: DEVICES_UNIFI_PROTECT_TYPE,
			identifier: device.identifier,
			name: selection.name ?? device.name,
			category: device.category,
			protectNvrId: device.protectNvrId,
			protectDeviceId: device.protectDeviceId,
			protectModelKey: device.protectModelKey,
			channels,
		} as unknown as CreateProtectDeviceDto;

		return { dto, writes };
	}

	private createChannelDto(channel: ProtectMappedChannel, withIds = false): CreateProtectDeviceChannelDto {
		return {
			...(withIds ? { id: uuid() } : {}),
			type: DEVICES_UNIFI_PROTECT_TYPE,
			identifier: channel.identifier,
			name: channel.name,
			category: channel.category,
			properties: channel.properties.map((property) => ({
				...this.createPropertyDto(property),
				...(withIds ? { id: uuid() } : {}),
			})),
		} as unknown as CreateProtectDeviceChannelDto;
	}

	/** The unit is derived from the specification on load, so it is never sent. */
	private createPropertyDto(property: ProtectMappedProperty): CreateProtectDeviceChannelPropertyDto {
		return {
			type: DEVICES_UNIFI_PROTECT_TYPE,
			identifier: property.identifier,
			name: property.name,
			category: property.category,
			permissions: [...property.permissions],
			data_type: property.dataType,
			format: property.format === null ? null : [...property.format],
			step: property.step,
			invalid: null,
			protectMappingName: property.mappingName,
		} as unknown as CreateProtectDeviceChannelPropertyDto;
	}

	private isConstant(mappingName: string): boolean {
		this.constantMappings ??= new Set(
			this.mappingLoader
				.getMappings()
				.properties.filter((mapping) => mapping.value !== null && 'constant' in mapping.value)
				.map((mapping) => mapping.name),
		);

		return this.constantMappings.has(mappingName);
	}

	private async restoreDeviceMetadata(
		deviceId: string,
		expected: UpdateProtectDeviceDto,
		previous: UpdateProtectDeviceDto,
	): Promise<void> {
		const current = await this.devicesService.findOne<ProtectDeviceEntity>(deviceId, DEVICES_UNIFI_PROTECT_TYPE);

		if (
			current !== null &&
			current.identifier === expected.identifier &&
			current.name === expected.name &&
			current.category === expected.category
		) {
			await this.devicesService.update(deviceId, previous);
		}
	}

	private async restoreChannelMetadata(
		channelId: string,
		deviceId: string,
		expected: UpdateProtectChannelDto,
		previous: UpdateProtectChannelDto,
	): Promise<void> {
		const current = await this.channelsService.findOne<ProtectChannelEntity>(
			channelId,
			deviceId,
			DEVICES_UNIFI_PROTECT_TYPE,
		);

		if (
			current !== null &&
			current.identifier === expected.identifier &&
			current.name === expected.name &&
			current.category === expected.category
		) {
			await this.channelsService.update(channelId, previous);
		}
	}

	private async restorePropertyMetadata(
		propertyId: string,
		previous: PropertyMetadata,
		expected: CreateProtectDeviceChannelPropertyDto,
		channelId: string,
	): Promise<void> {
		const current = await this.channelsPropertiesService.findOne<ProtectChannelPropertyEntity>(
			propertyId,
			channelId,
			DEVICES_UNIFI_PROTECT_TYPE,
		);

		if (current === null || this.propertyMetadataChanged(current, expected)) {
			return;
		}

		await this.channelsPropertiesService.update(propertyId, { type: DEVICES_UNIFI_PROTECT_TYPE, ...previous } as never);
	}

	private async removeCreatedChannel(channelId: string, deviceId: string, desiredIdentifier: string): Promise<void> {
		const channel = await this.channelsService.findOne<ProtectChannelEntity>(
			channelId,
			deviceId,
			DEVICES_UNIFI_PROTECT_TYPE,
		);

		if (channel !== null && channel.identifier === desiredIdentifier) {
			await this.channelsService.remove(channelId);
		}
	}

	private async removeCreatedProperty(
		propertyId: string,
		channelId: string,
		desired: CreateProtectDeviceChannelPropertyDto,
	): Promise<void> {
		const property = await this.channelsPropertiesService.findOne<ProtectChannelPropertyEntity>(
			propertyId,
			channelId,
			DEVICES_UNIFI_PROTECT_TYPE,
		);

		if (
			property !== null &&
			property.identifier === desired.identifier &&
			property.protectMappingName === desired.protectMappingName
		) {
			await this.channelsPropertiesService.remove(propertyId);
		}
	}

	/** Compares only what an update can change: identifier, name, permissions, data type, format, invalid, step. */
	private propertyMetadataChanged(
		property: ProtectChannelPropertyEntity,
		desired: CreateProtectDeviceChannelPropertyDto,
	): boolean {
		return (
			property.identifier !== desired.identifier ||
			property.name !== desired.name ||
			property.dataType !== desired.data_type ||
			property.invalid !== desired.invalid ||
			property.step !== desired.step ||
			JSON.stringify(property.permissions) !== JSON.stringify(desired.permissions) ||
			JSON.stringify(property.format) !== JSON.stringify(desired.format)
		);
	}

	/** Writes the current values and the connection state; true when every write succeeded. */
	private async applyTerminalValues(
		writes: readonly PendingValueWrite[],
		device: ProtectMappedDevice,
		deviceId: string,
	): Promise<boolean> {
		let complete = await this.writeValues(writes);

		const state = this.connectionState(device);

		if (state !== null) {
			const stateWritten = await this.connectivity.trySetConnectionState(deviceId, { state }).catch(() => false);

			if (!stateWritten) {
				complete = false;
				this.logger.warn('UniFi Protect connection state persistence was deferred until the next adoption');
			}
		}

		return complete;
	}

	/** Strict, compare-and-set value writes; true when every write succeeded. */
	private async writeValues(writes: readonly PendingValueWrite[]): Promise<boolean> {
		let complete = true;

		for (const pending of writes) {
			try {
				await this.channelsPropertiesService.update(
					pending.propertyId,
					{ type: DEVICES_UNIFI_PROTECT_TYPE, value: pending.value } as never,
					{
						strictValuePersistence: true,
						comparePersistedValue: true,
						expectedPersistedState: pending.previous,
					},
				);
			} catch {
				complete = false;
				this.logger.warn('UniFi Protect current value persistence was deferred until the next adoption');
			}
		}

		return complete;
	}

	private connectionState(device: ProtectMappedDevice): ConnectionState | null {
		const value = device.channels
			.flatMap((channel) => channel.properties)
			.find((property) => property.identifier === CONNECTION_STATE_IDENTIFIER)?.value;

		return typeof value === 'string' && (Object.values(ConnectionState) as string[]).includes(value)
			? (value as ConnectionState)
			: null;
	}

	/** Returns false when any removal failed; the next adoption retries it. */
	private async pruneStale(removals: readonly DeferredRemoval[]): Promise<boolean> {
		let complete = true;

		for (const removal of removals) {
			try {
				if (removal.kind === 'property') {
					const current = await this.channelsPropertiesService.findOne<ProtectChannelPropertyEntity>(
						removal.id,
						removal.channelId,
						DEVICES_UNIFI_PROTECT_TYPE,
					);

					if (
						current === null ||
						current.identifier !== removal.identifier ||
						current.protectMappingName !== removal.protectMappingName
					) {
						continue;
					}

					await this.channelsPropertiesService.remove(removal.id);
				} else {
					const current = await this.channelsService.findOne<ProtectChannelEntity>(
						removal.id,
						removal.deviceId,
						DEVICES_UNIFI_PROTECT_TYPE,
					);

					if (
						current === null ||
						current.identifier !== removal.identifier ||
						current.category === ChannelCategory.DEVICE_INFORMATION
					) {
						continue;
					}

					await this.channelsService.remove(removal.id);
				}
			} catch {
				complete = false;
				this.logger.warn('UniFi Protect stale structure pruning was deferred until the next adoption');
			}
		}

		return complete;
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

	/**
	 * Enables the RTSPS streams after the device is saved (D9/P6). Never changes the adoption status: a failure is a
	 * stream outcome. Only qualities and status values leave this method, never stream addresses.
	 */
	private async finishWithStreams(
		selection: ProtectAdoptDeviceDto,
		prepared: ProtectPreparedMapping,
		status: ProtectAdoptionStatus,
		panelDeviceId: string,
		complete: boolean,
		structureComplete = true,
	): Promise<ProtectAdoptionResultModel> {
		const outcome = await this.enableStreams(selection, prepared, panelDeviceId);

		return this.success(
			selection,
			status,
			panelDeviceId,
			complete && outcome.complete,
			outcome.stream,
			structureComplete,
		);
	}

	private async enableStreams(
		selection: ProtectAdoptDeviceDto,
		prepared: ProtectPreparedMapping,
		panelDeviceId: string,
	): Promise<{ stream: ProtectAdoptionStreamModel | null; complete: boolean }> {
		if (prepared.device.protectModelKey !== 'camera') {
			return { stream: null, complete: true };
		}

		if (selection.stream?.enabled === false) {
			this.recordAvailability(prepared, prepared.streams);

			return {
				stream: this.streamModel(
					ProtectStreamOutcome.NOT_REQUESTED,
					null,
					this.enabledQualitiesOf(prepared.streams),
					null,
				),
				complete: true,
			};
		}

		const quality = selection.stream?.quality ?? readDefaultStreamQuality(this.configService);
		let result: ProtectStreamEnablementResult;

		try {
			result = await this.streams.ensureStreams(prepared.fresh.client, prepared.device.protectDeviceId, {
				quality,
				packageCamera: prepared.fresh.entry.raw.hasPackageCamera === true,
			});
		} catch {
			this.logger.warn('RTSPS stream enablement finished (failed)');
			this.recordAvailability(prepared, prepared.streams);

			return {
				stream: this.streamModel(
					ProtectStreamOutcome.FAILED,
					quality,
					this.enabledQualitiesOf(prepared.streams),
					ProtectErrorCategory.UNAVAILABLE,
				),
				complete: true,
			};
		}

		const stream = this.streamModel(result.outcome, result.quality, result.enabledQualities, result.failureCategory);
		let complete = true;

		if (result.availability === null) {
			// A failed enablement: the console state read before it is the best knowledge there is.
			this.recordAvailability(prepared, prepared.streams);
		} else {
			this.recordAvailability(prepared, result.availability);

			try {
				complete = await this.updateStreamStatuses(prepared, result.availability, panelDeviceId);
			} catch {
				complete = false;
				this.logger.warn('UniFi Protect stream status persistence was deferred until the next adoption');
			}
		}

		return { stream, complete };
	}

	/** Shares what the console reported with the synchronizer (booleans only), before any status write. */
	private recordAvailability(prepared: ProtectPreparedMapping, availability: ProtectPreparedMapping['streams']): void {
		if (availability !== null) {
			this.streamAvailability.set(prepared.device.protectDeviceId, availability);
		}
	}

	/** Re-evaluates camera.main/camera.package status and writes only the values that changed. */
	private async updateStreamStatuses(
		prepared: ProtectPreparedMapping,
		availability: Parameters<ProtectMappingPreviewService['toStatusValue']>[1],
		deviceId: string,
	): Promise<boolean> {
		const next = this.preview.toStatusValue(prepared, availability);
		const writes: PendingValueWrite[] = [];

		for (const identifier of STREAM_CHANNELS) {
			const desiredProperty = next.channels
				.find((channel) => channel.identifier === identifier)
				?.properties.find((property) => property.identifier === STATUS_IDENTIFIER);

			if (desiredProperty === undefined || desiredProperty.value === null) {
				continue;
			}

			const channel = await this.channelsService.findOneBy<ProtectChannelEntity>(
				'identifier',
				identifier,
				deviceId,
				DEVICES_UNIFI_PROTECT_TYPE,
			);

			if (channel === null) {
				continue;
			}

			const property = (await this.channelsPropertiesService.findAll(channel.id, DEVICES_UNIFI_PROTECT_TYPE)).find(
				(candidate): candidate is ProtectChannelPropertyEntity =>
					candidate.type === DEVICES_UNIFI_PROTECT_TYPE &&
					(candidate as ProtectChannelPropertyEntity).protectMappingName === desiredProperty.mappingName,
			);

			if (property === undefined) {
				continue;
			}

			const previous = await this.propertyValueService.readLatestPersisted(property);

			if (previous?.value !== desiredProperty.value) {
				writes.push({ propertyId: property.id, value: desiredProperty.value, previous });
			}
		}

		return this.writeValues(writes);
	}

	/** Quality names from presence booleans; null when the console state is unknown. */
	private enabledQualitiesOf(
		availability: ProtectPreparedMapping['streams'],
	): ProtectAdoptionStreamModel['enabledQualities'] {
		return availability === null ? null : PROTECT_RTSPS_QUALITIES.filter((quality) => availability[quality]);
	}

	private streamModel(
		status: ProtectStreamOutcome,
		quality: ProtectStreamQuality | null,
		enabledQualities: ProtectAdoptionStreamModel['enabledQualities'],
		failureCategory: ProtectErrorCategory | null,
	): ProtectAdoptionStreamModel {
		return Object.assign(new ProtectAdoptionStreamModel(), { status, quality, enabledQualities, failureCategory });
	}

	private codeForPrepareError(error: unknown): ProtectAdoptionFailureCode {
		if (error instanceof ProtectDeviceNotFoundError) {
			return ProtectAdoptionFailureCode.DEVICE_NOT_FOUND;
		}

		if (error instanceof ProtectUnsupportedDeviceError) {
			return ProtectAdoptionFailureCode.UNSUPPORTED_MAPPING;
		}

		if (error instanceof ProtectConsoleUnavailableError) {
			return ProtectAdoptionFailureCode.UNAVAILABLE;
		}

		return ProtectAdoptionFailureCode.UNAVAILABLE;
	}

	private success(
		selection: ProtectAdoptDeviceDto,
		status: ProtectAdoptionStatus,
		panelDeviceId: string,
		complete: boolean,
		stream: ProtectAdoptionStreamModel | null = null,
		structureComplete = true,
	): ProtectAdoptionResultModel {
		return this.result(selection.deviceId, selection.modelKey, {
			status,
			panelDeviceId,
			failureCode: null,
			message: null,
			warnings: [
				...(complete ? [] : [ProtectAdoptionWarningCode.VALUES_INCOMPLETE]),
				...(structureComplete ? [] : [ProtectAdoptionWarningCode.STRUCTURE_INCOMPLETE]),
			],
			stream,
		});
	}

	private failure(selection: ProtectAdoptDeviceDto, code: ProtectAdoptionFailureCode): ProtectAdoptionResultModel {
		return this.result(selection.deviceId, selection.modelKey, {
			status: ProtectAdoptionStatus.FAILED,
			panelDeviceId: null,
			failureCode: code,
			message: FAILURE_MESSAGES[code],
			warnings: [],
			stream: null,
		});
	}

	private result(
		deviceId: string,
		modelKey: ProtectModelKey,
		fields: Omit<ProtectAdoptionResultModel, 'deviceId' | 'modelKey'>,
	): ProtectAdoptionResultModel {
		return Object.assign(new ProtectAdoptionResultModel(), { deviceId, modelKey, ...fields });
	}
}

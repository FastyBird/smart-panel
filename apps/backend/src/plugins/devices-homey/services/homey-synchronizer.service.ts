import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger';
import { ConnectionState, EventType } from '../../../modules/devices/devices.constants';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DEVICES_HOMEY_PLUGIN_NAME, DEVICES_HOMEY_TYPE } from '../devices-homey.constants';
import { HomeyChannelPropertyEntity, HomeyDeviceEntity } from '../entities/devices-homey.entity';
import { HomeyMappingLoaderService } from '../mappings/mapping-loader.service';
import { HomeyMappingTransformerService } from '../mappings/mapping-transformer.service';
import { ResolvedHomeyPropertyMapping } from '../mappings/mapping.types';
import { HomeyCapability, HomeyCapabilityValue } from '../models/homey-capability.model';
import { HomeyDevice } from '../models/homey-device.model';
import { HomeyEvent, HomeyEventType } from '../models/homey-event.model';

interface HomeyIndexedProperty {
	readonly panelDeviceId: string;
	readonly property: HomeyChannelPropertyEntity;
	readonly mapping: ResolvedHomeyPropertyMapping;
}

export interface HomeySynchronizationResult {
	readonly updated: number;
	readonly ignored: number;
	readonly failed: number;
}

interface MutableSynchronizationResult {
	updated: number;
	ignored: number;
	failed: number;
}

interface HomeyEventOrder {
	readonly sequence: string | number | null;
	readonly timestamp: number | null;
	readonly arrival: number;
}

@Injectable()
export class HomeySynchronizerService {
	private readonly logger = createExtensionLogger(DEVICES_HOMEY_PLUGIN_NAME, 'Synchronizer');
	private adoptedDevices = new Map<string, HomeyDeviceEntity>();
	private propertiesByDeviceCapability = new Map<string, Map<string, HomeyIndexedProperty[]>>();
	private lastAppliedOrder = new Map<string, HomeyEventOrder>();
	private lastAppliedAvailabilityOrder = new Map<string, HomeyEventOrder>();
	private arrivalOrder = 0;
	private indexDirty = true;
	private indexRefresh: Promise<void> | null = null;
	private indexGeneration = 0;

	constructor(
		private readonly devicesService: DevicesService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly deviceConnectivityService: DeviceConnectivityService,
		private readonly mappingLoader: HomeyMappingLoaderService,
		private readonly transformer: HomeyMappingTransformerService,
	) {}

	@OnEvent(EventType.DEVICE_CREATED)
	@OnEvent(EventType.DEVICE_UPDATED)
	@OnEvent(EventType.DEVICE_DELETED)
	@OnEvent(EventType.CHANNEL_CREATED)
	@OnEvent(EventType.CHANNEL_UPDATED)
	@OnEvent(EventType.CHANNEL_DELETED)
	@OnEvent(EventType.CHANNEL_PROPERTY_CREATED)
	@OnEvent(EventType.CHANNEL_PROPERTY_UPDATED)
	@OnEvent(EventType.CHANNEL_PROPERTY_DELETED)
	invalidateFromEntity(): void {
		this.invalidateIndex();
	}

	invalidateIndex(): void {
		this.indexDirty = true;
		this.indexGeneration += 1;
	}

	async refreshIndex(): Promise<void> {
		this.invalidateIndex();
		await this.ensureIndex();
	}

	async synchronizeSnapshot(devices: readonly HomeyDevice[]): Promise<HomeySynchronizationResult> {
		await this.refreshIndex();
		const upstreamDevices = new Map(devices.map((device) => [device.id, device]));
		const result = this.emptyResult();

		for (const [homeyDeviceId, adopted] of this.adoptedDevices) {
			const upstream = upstreamDevices.get(homeyDeviceId);

			if (upstream === undefined) {
				await this.setConnectionState(adopted.id, ConnectionState.LOST, result);
				continue;
			}

			await this.synchronizeDevice(upstream, result);
		}

		return result;
	}

	async synchronizeDevices(
		devices: readonly HomeyDevice[],
		missingDeviceIds: readonly string[] = [],
	): Promise<HomeySynchronizationResult> {
		await this.ensureIndex();
		const result = this.emptyResult();

		for (const device of devices) {
			await this.synchronizeDevice(device, result);
		}

		for (const homeyDeviceId of missingDeviceIds) {
			const adopted = this.adoptedDevices.get(homeyDeviceId);

			if (adopted !== undefined) {
				await this.setConnectionState(adopted.id, ConnectionState.LOST, result);
			}
		}

		return result;
	}

	async synchronizeEvents(
		events: readonly HomeyEvent[],
		currentDevices: ReadonlyMap<string, HomeyDevice>,
	): Promise<HomeySynchronizationResult> {
		await this.ensureIndex();
		const result = this.emptyResult();

		for (const event of this.coalesceEvents(events)) {
			if (!this.isValidEvent(event)) {
				result.ignored += 1;
				continue;
			}

			switch (event.type) {
				case HomeyEventType.CAPABILITY_VALUE_CHANGED:
					await this.synchronizeCapabilityValue(
						event.deviceId,
						event.capabilityId,
						event.value,
						event.lastUpdatedAt ?? event.occurredAt,
						event.sequence,
						result,
					);
					break;
				case HomeyEventType.DEVICE_AVAILABILITY_CHANGED: {
					const adopted = this.adoptedDevices.get(event.deviceId);

					if (adopted === undefined) {
						result.ignored += 1;
						break;
					}

					const order = this.createOrder(event.sequence, event.occurredAt);
					const previousOrder = this.lastAppliedAvailabilityOrder.get(event.deviceId);

					if (previousOrder !== undefined && !this.isNewerOrder(order, previousOrder)) {
						result.ignored += 1;
						break;
					}

					const applied = await this.setConnectionState(
						adopted.id,
						event.available ? ConnectionState.CONNECTED : ConnectionState.DISCONNECTED,
						result,
					);

					if (applied) {
						this.lastAppliedAvailabilityOrder.set(event.deviceId, order);
					}
					break;
				}
				case HomeyEventType.DEVICE_ADDED:
				case HomeyEventType.DEVICE_UPDATED: {
					const current = currentDevices.get(event.deviceId);

					if (current === undefined) {
						const adopted = this.adoptedDevices.get(event.deviceId);
						if (adopted === undefined) {
							result.ignored += 1;
						} else {
							await this.setConnectionState(adopted.id, ConnectionState.LOST, result);
						}
						break;
					}

					await this.synchronizeDevice(current, result);
					break;
				}
				case HomeyEventType.DEVICE_REMOVED: {
					const adopted = this.adoptedDevices.get(event.deviceId);

					if (adopted === undefined) {
						result.ignored += 1;
					} else {
						await this.setConnectionState(adopted.id, ConnectionState.LOST, result);
					}
					break;
				}
				case HomeyEventType.ZONE_ADDED:
				case HomeyEventType.ZONE_UPDATED:
				case HomeyEventType.ZONE_REMOVED:
					result.ignored += 1;
					break;
			}
		}

		return result;
	}

	reset(): void {
		this.adoptedDevices.clear();
		this.propertiesByDeviceCapability.clear();
		this.lastAppliedOrder.clear();
		this.lastAppliedAvailabilityOrder.clear();
		this.arrivalOrder = 0;
		this.indexDirty = true;
		this.indexGeneration += 1;
	}

	private async ensureIndex(): Promise<void> {
		if (!this.indexDirty) {
			return;
		}

		if (this.indexRefresh !== null) {
			await this.indexRefresh;
			if (this.indexDirty) {
				await this.ensureIndex();
			}
			return;
		}

		this.indexRefresh = this.rebuildIndex();

		try {
			await this.indexRefresh;
		} finally {
			this.indexRefresh = null;
		}

		if (this.indexDirty) {
			await this.ensureIndex();
		}
	}

	private async rebuildIndex(): Promise<void> {
		const generation = this.indexGeneration;
		const mappings = new Map(this.mappingLoader.getPropertyMappings().map((mapping) => [mapping.name, mapping]));
		const devices = await this.devicesService.findAll<HomeyDeviceEntity>(DEVICES_HOMEY_TYPE);
		const adoptedDevices = new Map<string, HomeyDeviceEntity>();
		const propertiesByDeviceCapability = new Map<string, Map<string, HomeyIndexedProperty[]>>();

		for (const device of devices) {
			if (device.identifier === null || !device.enabled) {
				continue;
			}

			adoptedDevices.set(device.identifier, device);
			const capabilities = new Map<string, HomeyIndexedProperty[]>();

			for (const channel of device.channels ?? []) {
				for (const candidate of channel.properties ?? []) {
					const property = candidate as HomeyChannelPropertyEntity;

					if (
						candidate.type !== DEVICES_HOMEY_TYPE ||
						typeof property.homeyCapabilityId !== 'string' ||
						typeof property.homeyMappingName !== 'string'
					) {
						continue;
					}

					const mapping = mappings.get(property.homeyMappingName);
					if (mapping === undefined || mapping.property.direction === 'write_only') {
						continue;
					}

					const bindings = capabilities.get(property.homeyCapabilityId) ?? [];
					bindings.push({ panelDeviceId: device.id, property, mapping });
					capabilities.set(property.homeyCapabilityId, bindings);
				}
			}

			propertiesByDeviceCapability.set(device.identifier, capabilities);
		}

		this.adoptedDevices = adoptedDevices;
		this.propertiesByDeviceCapability = propertiesByDeviceCapability;
		this.indexDirty = this.indexGeneration !== generation;
	}

	private async synchronizeDevice(device: HomeyDevice, result: MutableSynchronizationResult): Promise<void> {
		const adopted = this.adoptedDevices.get(device.id);

		if (adopted === undefined) {
			result.ignored += 1;
			return;
		}

		await this.setConnectionState(
			adopted.id,
			device.available ? ConnectionState.CONNECTED : ConnectionState.DISCONNECTED,
			result,
		);

		for (const capability of device.capabilities) {
			if (!capability.readable || capability.available === false) {
				result.ignored += 1;
				continue;
			}

			await this.synchronizeCapability(device.id, capability, result);
		}
	}

	private async synchronizeCapability(
		homeyDeviceId: string,
		capability: HomeyCapability,
		result: MutableSynchronizationResult,
	): Promise<void> {
		await this.synchronizeCapabilityValue(
			homeyDeviceId,
			capability.id,
			capability.value,
			capability.lastUpdatedAt,
			null,
			result,
		);
	}

	private async synchronizeCapabilityValue(
		homeyDeviceId: string,
		capabilityId: string,
		value: HomeyCapabilityValue,
		updatedAt: string | null,
		sequence: string | number | null,
		result: MutableSynchronizationResult,
	): Promise<void> {
		const bindings = this.propertiesByDeviceCapability.get(homeyDeviceId)?.get(capabilityId);

		if (bindings === undefined || bindings.length === 0 || !this.isCapabilityValue(value)) {
			result.ignored += 1;
			return;
		}

		const order = this.createOrder(sequence, updatedAt);

		for (const binding of bindings) {
			const previousOrder = this.lastAppliedOrder.get(binding.property.id);

			if (previousOrder !== undefined && !this.isNewerOrder(order, previousOrder)) {
				result.ignored += 1;
				continue;
			}

			try {
				const transformed = this.transformer.read(binding.mapping, value);
				await this.channelsPropertiesService.update(binding.property.id, {
					type: DEVICES_HOMEY_TYPE,
					value: transformed,
				});
				this.lastAppliedOrder.set(binding.property.id, order);
				result.updated += 1;
			} catch {
				result.failed += 1;
				this.logger.warn('Ignored a Homey capability update that could not be mapped or persisted', {
					resource: binding.property.id,
				});
			}
		}
	}

	private async setConnectionState(
		panelDeviceId: string,
		state: ConnectionState,
		result: MutableSynchronizationResult,
	): Promise<boolean> {
		try {
			await this.deviceConnectivityService.setConnectionState(panelDeviceId, { state });
			result.updated += 1;
			return true;
		} catch {
			result.failed += 1;
			this.logger.warn('Could not update an adopted Homey device connection state', { resource: panelDeviceId });
			return false;
		}
	}

	private coalesceEvents(events: readonly HomeyEvent[]): HomeyEvent[] {
		const selectedCapabilityIndexes = new Map<string, number>();

		for (let index = 0; index < events.length; index += 1) {
			const event = events[index];

			if (event.type !== HomeyEventType.CAPABILITY_VALUE_CHANGED) {
				continue;
			}

			const key = `${event.deviceId}\u0000${event.capabilityId}`;
			const selectedIndex = selectedCapabilityIndexes.get(key);

			if (selectedIndex === undefined || this.isLaterCapabilityEvent(event, events[selectedIndex])) {
				selectedCapabilityIndexes.set(key, index);
			}
		}

		return events.filter((event, index) => {
			if (event.type !== HomeyEventType.CAPABILITY_VALUE_CHANGED) {
				return true;
			}

			return selectedCapabilityIndexes.get(`${event.deviceId}\u0000${event.capabilityId}`) === index;
		});
	}

	private isLaterCapabilityEvent(
		candidate: Extract<HomeyEvent, { type: HomeyEventType.CAPABILITY_VALUE_CHANGED }>,
		current: HomeyEvent,
	): boolean {
		if (current.type !== HomeyEventType.CAPABILITY_VALUE_CHANGED) {
			return true;
		}

		const sequenceComparison = this.compareSequences(candidate.sequence, current.sequence);

		if (sequenceComparison !== null) {
			return sequenceComparison > 0;
		}

		const candidateTimestamp = this.parseTimestamp(candidate.lastUpdatedAt ?? candidate.occurredAt);
		const currentTimestamp = this.parseTimestamp(current.lastUpdatedAt ?? current.occurredAt);

		if (candidateTimestamp !== null && currentTimestamp !== null && candidateTimestamp !== currentTimestamp) {
			return candidateTimestamp > currentTimestamp;
		}

		return true;
	}

	private isNewerOrder(candidate: HomeyEventOrder, current: HomeyEventOrder): boolean {
		const sequenceComparison = this.compareSequences(candidate.sequence, current.sequence);

		if (sequenceComparison !== null) {
			return sequenceComparison > 0;
		}

		if (candidate.timestamp !== null && current.timestamp !== null) {
			return candidate.timestamp > current.timestamp;
		}

		return candidate.arrival > current.arrival;
	}

	private createOrder(sequence: string | number | null, updatedAt: string | null): HomeyEventOrder {
		return {
			sequence,
			timestamp: this.parseTimestamp(updatedAt),
			arrival: ++this.arrivalOrder,
		};
	}

	private compareSequences(candidate: string | number | null, current: string | number | null): number | null {
		if (typeof candidate === 'number' && typeof current === 'number') {
			return Math.sign(candidate - current);
		}

		if (typeof candidate === 'string' && typeof current === 'string' && candidate === current) {
			return 0;
		}

		return null;
	}

	private isValidEvent(event: HomeyEvent): boolean {
		switch (event.type) {
			case HomeyEventType.CAPABILITY_VALUE_CHANGED:
				return (
					typeof event.deviceId === 'string' &&
					event.deviceId.length > 0 &&
					typeof event.capabilityId === 'string' &&
					event.capabilityId.length > 0 &&
					this.isCapabilityValue(event.value)
				);
			case HomeyEventType.DEVICE_AVAILABILITY_CHANGED:
				return typeof event.deviceId === 'string' && event.deviceId.length > 0 && typeof event.available === 'boolean';
			case HomeyEventType.DEVICE_ADDED:
			case HomeyEventType.DEVICE_UPDATED:
			case HomeyEventType.DEVICE_REMOVED:
				return typeof event.deviceId === 'string' && event.deviceId.length > 0;
			case HomeyEventType.ZONE_ADDED:
			case HomeyEventType.ZONE_UPDATED:
			case HomeyEventType.ZONE_REMOVED:
				return typeof event.zoneId === 'string' && event.zoneId.length > 0;
		}
	}

	private isCapabilityValue(value: unknown): value is HomeyCapabilityValue {
		return (
			value === null ||
			typeof value === 'boolean' ||
			typeof value === 'string' ||
			(typeof value === 'number' && Number.isFinite(value))
		);
	}

	private parseTimestamp(value: string | null): number | null {
		if (value === null) {
			return null;
		}

		const timestamp = Date.parse(value);

		return Number.isFinite(timestamp) ? timestamp : null;
	}

	private emptyResult(): MutableSynchronizationResult {
		return { updated: 0, ignored: 0, failed: 0 };
	}
}

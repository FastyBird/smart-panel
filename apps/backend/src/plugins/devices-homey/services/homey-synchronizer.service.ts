import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger';
import { ConnectionState, EventType } from '../../../modules/devices/devices.constants';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DEVICES_HOMEY_PLUGIN_NAME, DEVICES_HOMEY_TYPE } from '../devices-homey.constants';
import { HomeyChannelPropertyEntity, HomeyDeviceEntity } from '../entities/devices-homey.entity';
import { resolveHomeyDeviceSupport } from '../mappings/device-support';
import { HomeyMappingLoaderService } from '../mappings/mapping-loader.service';
import { HomeyMappingTransformerService } from '../mappings/mapping-transformer.service';
import { ResolvedHomeyPropertyMapping } from '../mappings/mapping.types';
import { HomeyCapability, HomeyCapabilityValue } from '../models/homey-capability.model';
import { HomeyDevice } from '../models/homey-device.model';
import { HomeyEvent, HomeyEventType } from '../models/homey-event.model';
import { HomeyDeviceSupportState } from '../models/inventory.model';

import { HomeyFailureLogLimiter } from './homey-failure-log-limiter';

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

export interface HomeyOperationalDiagnostics {
	readonly adopted: number;
	readonly adoptedDevices: readonly HomeyAdoptedDeviceDiagnostic[];
	readonly missing: number;
	readonly unsupported: number;
	readonly unavailable: number;
}

export interface HomeyAdoptedDeviceDiagnostic {
	readonly panelDeviceId: string;
	readonly homeyDeviceId: string;
}

export interface HomeyEventSynchronizationResult extends HomeySynchronizationResult {
	readonly acceptedEvents: readonly HomeyEvent[];
	readonly acceptedCapabilityValues?: readonly HomeyAcceptedCapabilityValue[];
}

export interface HomeyAcceptedCapabilityValue {
	readonly deviceId: string;
	readonly capabilityId: string;
	readonly value: HomeyCapabilityValue;
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
	private readonly failureLogLimiter = new HomeyFailureLogLimiter();
	private adoptedDevices = new Map<string, HomeyDeviceEntity>();
	private propertiesByDeviceCapability = new Map<string, Map<string, HomeyIndexedProperty[]>>();
	private lastAppliedOrder = new Map<string, HomeyEventOrder>();
	private lastAppliedValues = new Map<string, HomeyCapabilityValue>();
	private lastObservedOrder = new Map<string, HomeyEventOrder>();
	private lastAppliedDeviceOrder = new Map<string, HomeyEventOrder>();
	private lastObservedDeviceOrder = new Map<string, HomeyEventOrder>();
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

	async synchronizeSnapshot(
		devices: readonly HomeyDevice[],
		readbackEvents: readonly HomeyEvent[] = [],
	): Promise<HomeyEventSynchronizationResult> {
		await this.refreshIndex();
		const upstreamDevices = new Map(devices.map((device) => [device.id, device]));
		const result = this.emptyResult();
		const connectionStateApplied = new Map<string, boolean>();
		const acceptedCapabilityValues: HomeyAcceptedCapabilityValue[] = [];

		for (const [homeyDeviceId, adopted] of this.adoptedDevices) {
			const upstream = upstreamDevices.get(homeyDeviceId);

			if (upstream === undefined) {
				connectionStateApplied.set(
					homeyDeviceId,
					await this.setConnectionState(adopted.id, ConnectionState.LOST, result),
				);
				continue;
			}

			connectionStateApplied.set(
				homeyDeviceId,
				await this.synchronizeDevice(upstream, result, acceptedCapabilityValues),
			);
		}

		const acceptedEvents = await this.commitReadbackOrder(
			readbackEvents,
			upstreamDevices,
			connectionStateApplied,
			result,
		);

		return { ...result, acceptedEvents, acceptedCapabilityValues };
	}

	async synchronizeDevices(
		devices: readonly HomeyDevice[],
		missingDeviceIds: readonly string[] = [],
		readbackEvents: readonly HomeyEvent[] = [],
	): Promise<HomeyEventSynchronizationResult> {
		await this.ensureIndex();
		const result = this.emptyResult();
		const connectionStateApplied = new Map<string, boolean>();
		const acceptedCapabilityValues: HomeyAcceptedCapabilityValue[] = [];

		for (const device of devices) {
			connectionStateApplied.set(device.id, await this.synchronizeDevice(device, result, acceptedCapabilityValues));
		}

		for (const homeyDeviceId of missingDeviceIds) {
			const adopted = this.adoptedDevices.get(homeyDeviceId);

			if (adopted !== undefined) {
				connectionStateApplied.set(
					homeyDeviceId,
					await this.setConnectionState(adopted.id, ConnectionState.LOST, result),
				);
			}
		}

		const acceptedEvents = await this.commitReadbackOrder(
			readbackEvents,
			new Map(devices.map((device) => [device.id, device])),
			connectionStateApplied,
			result,
		);

		return { ...result, acceptedEvents, acceptedCapabilityValues };
	}

	async synchronizeEvents(
		events: readonly HomeyEvent[],
		currentDevices: ReadonlyMap<string, HomeyDevice>,
	): Promise<HomeyEventSynchronizationResult> {
		await this.ensureIndex();
		const result = this.emptyResult();
		const acceptedEvents: HomeyEvent[] = [];

		for (const event of this.filterEvents(events)) {
			if (!this.isValidEvent(event)) {
				result.ignored += 1;
				continue;
			}

			switch (event.type) {
				case HomeyEventType.CAPABILITY_VALUE_CHANGED:
					{
						const currentCapability = currentDevices
							.get(event.deviceId)
							?.capabilities.find((capability) => capability.id === event.capabilityId);

						if (
							currentCapability === undefined ||
							!currentCapability.readable ||
							currentCapability.available === false
						) {
							result.ignored += 1;
							break;
						}

						const applied = await this.synchronizeCapabilityValue(
							event.deviceId,
							event.capabilityId,
							event.value,
							event.lastUpdatedAt ?? event.occurredAt,
							event.sequence,
							result,
						);

						if (applied) {
							acceptedEvents.push(event);
						}
					}
					break;
				case HomeyEventType.DEVICE_AVAILABILITY_CHANGED: {
					if (!currentDevices.has(event.deviceId)) {
						result.ignored += 1;
						break;
					}

					const context = this.prepareDeviceEvent(event.deviceId, event.sequence, event.occurredAt, result);

					if (context === null) {
						break;
					}

					const applied = await this.setConnectionState(
						context.adopted.id,
						event.available ? ConnectionState.CONNECTED : ConnectionState.DISCONNECTED,
						result,
					);
					this.recordDeviceOrder(event.deviceId, context.order, applied);
					break;
				}
				case HomeyEventType.DEVICE_ADDED:
				case HomeyEventType.DEVICE_UPDATED: {
					const context = this.prepareDeviceEvent(event.deviceId, event.sequence, event.occurredAt, result);

					if (context === null) {
						break;
					}

					const current = currentDevices.get(event.deviceId);
					let applied: boolean;
					if (current === undefined) {
						applied = await this.setConnectionState(context.adopted.id, ConnectionState.LOST, result);
					} else {
						applied = await this.synchronizeDevice(current, result);
					}

					this.recordDeviceOrder(event.deviceId, context.order, applied);
					break;
				}
				case HomeyEventType.DEVICE_REMOVED: {
					const context = this.prepareDeviceEvent(event.deviceId, event.sequence, event.occurredAt, result);

					if (context === null) {
						break;
					}

					const applied = await this.setConnectionState(context.adopted.id, ConnectionState.LOST, result);
					this.recordDeviceOrder(event.deviceId, context.order, applied);
					break;
				}
				case HomeyEventType.ZONE_ADDED:
				case HomeyEventType.ZONE_UPDATED:
				case HomeyEventType.ZONE_REMOVED:
					result.ignored += 1;
					break;
			}
		}

		return { ...result, acceptedEvents };
	}

	filterEvents(events: readonly HomeyEvent[]): HomeyEvent[] {
		return this.coalesceEvents(events).filter((event) => {
			if (!this.isDeviceEvent(event)) {
				return true;
			}

			const previousOrder = this.lastObservedDeviceOrder.get(event.deviceId);

			return (
				previousOrder === undefined ||
				this.compareOrders(this.createOrder(event.sequence, event.occurredAt), previousOrder) >= 0
			);
		});
	}

	async hasReadableCapabilityBinding(homeyDeviceId: string, capabilityId: string): Promise<boolean> {
		await this.ensureIndex();

		return (this.propertiesByDeviceCapability.get(homeyDeviceId)?.get(capabilityId)?.length ?? 0) > 0;
	}

	async getOperationalDiagnostics(devices: readonly HomeyDevice[]): Promise<HomeyOperationalDiagnostics> {
		await this.ensureIndex();
		const upstreamIds = new Set(devices.map((device) => device.id));
		const adoptedDevices = [...this.adoptedDevices.values()].map((device) => ({
			homeyDeviceId: device.identifier,
			panelDeviceId: device.id,
		}));

		return {
			adopted: adoptedDevices.length,
			adoptedDevices,
			missing: adoptedDevices.filter((device) => !upstreamIds.has(device.homeyDeviceId)).length,
			unsupported: devices.filter(
				(device) => resolveHomeyDeviceSupport(this.mappingLoader, device).state !== HomeyDeviceSupportState.SUPPORTED,
			).length,
			unavailable: devices.filter((device) => !device.available).length,
		};
	}

	reset(): void {
		this.adoptedDevices.clear();
		this.propertiesByDeviceCapability.clear();
		this.lastAppliedOrder.clear();
		this.lastAppliedValues.clear();
		this.lastObservedOrder.clear();
		this.lastAppliedDeviceOrder.clear();
		this.lastObservedDeviceOrder.clear();
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

	private async synchronizeDevice(
		device: HomeyDevice,
		result: MutableSynchronizationResult,
		acceptedCapabilityValues?: HomeyAcceptedCapabilityValue[],
	): Promise<boolean> {
		const adopted = this.adoptedDevices.get(device.id);

		if (adopted === undefined) {
			result.ignored += 1;
			return false;
		}

		const connectionStateApplied = await this.setConnectionState(
			adopted.id,
			device.available ? ConnectionState.CONNECTED : ConnectionState.DISCONNECTED,
			result,
		);

		for (const capability of device.capabilities) {
			if (!capability.readable || capability.available === false) {
				result.ignored += 1;
				continue;
			}

			if (await this.synchronizeCapability(device.id, capability, result)) {
				acceptedCapabilityValues?.push({
					deviceId: device.id,
					capabilityId: capability.id,
					value: capability.value,
				});
			}
		}

		return connectionStateApplied;
	}

	private async synchronizeCapability(
		homeyDeviceId: string,
		capability: HomeyCapability,
		result: MutableSynchronizationResult,
	): Promise<boolean> {
		return this.synchronizeCapabilityValue(
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
	): Promise<boolean> {
		const bindings = this.propertiesByDeviceCapability.get(homeyDeviceId)?.get(capabilityId);

		if (bindings === undefined || bindings.length === 0 || !this.isCapabilityValue(value)) {
			result.ignored += 1;
			return false;
		}

		const order = this.createOrder(sequence, updatedAt);
		let allBindingsApplied = true;

		for (const binding of bindings) {
			const previousObservedOrder = this.lastObservedOrder.get(binding.property.id);
			const previousOrder = this.lastAppliedOrder.get(binding.property.id);
			const observedComparison =
				previousObservedOrder === undefined ? null : this.compareOrders(order, previousObservedOrder);
			const appliedComparison = previousOrder === undefined ? null : this.compareOrders(order, previousOrder);

			if (observedComparison !== null && observedComparison < 0) {
				result.ignored += 1;
				allBindingsApplied = false;
				continue;
			}

			if (appliedComparison !== null && appliedComparison <= 0) {
				result.ignored += 1;
				allBindingsApplied =
					appliedComparison === 0 &&
					this.lastAppliedValues.has(binding.property.id) &&
					Object.is(this.lastAppliedValues.get(binding.property.id), value) &&
					allBindingsApplied;
				continue;
			}

			const observedOrder = this.preserveSequenceWatermark(order, previousObservedOrder);
			this.lastObservedOrder.set(binding.property.id, observedOrder);

			try {
				const transformed = this.transformer.read(binding.mapping, value);
				await this.channelsPropertiesService.update(binding.property.id, {
					type: DEVICES_HOMEY_TYPE,
					value: transformed,
				});
				this.lastAppliedOrder.set(binding.property.id, this.preserveSequenceWatermark(observedOrder, previousOrder));
				this.lastAppliedValues.set(binding.property.id, value);
				result.updated += 1;
			} catch {
				result.failed += 1;
				allBindingsApplied = false;
				const decision = this.failureLogLimiter.consume('capability-update');

				if (decision.log) {
					this.logger.warn('Ignored a Homey capability update that could not be mapped or persisted', {
						suppressed: decision.suppressed,
					});
				}
			}
		}

		return allBindingsApplied;
	}

	private async commitReadbackOrder(
		events: readonly HomeyEvent[],
		currentDevices: ReadonlyMap<string, HomeyDevice>,
		connectionStateApplied: ReadonlyMap<string, boolean>,
		result: MutableSynchronizationResult,
	): Promise<readonly HomeyEvent[]> {
		const acceptedEvents: HomeyEvent[] = [];

		for (const event of this.filterEvents(events)) {
			if (!this.isValidEvent(event)) {
				result.ignored += 1;
				continue;
			}

			if (event.type === HomeyEventType.CAPABILITY_VALUE_CHANGED) {
				const capability = currentDevices
					.get(event.deviceId)
					?.capabilities.find((candidate) => candidate.id === event.capabilityId);

				if (capability === undefined || !capability.readable || capability.available === false) {
					result.ignored += 1;
					continue;
				}

				const applied = await this.synchronizeCapabilityValue(
					event.deviceId,
					event.capabilityId,
					capability.value,
					null,
					event.sequence,
					result,
				);

				if (applied) {
					acceptedEvents.push({ ...event, value: capability.value });
				}
				continue;
			}

			if (!this.isDeviceEvent(event)) {
				continue;
			}

			if (event.type === HomeyEventType.DEVICE_ADDED || event.type === HomeyEventType.DEVICE_UPDATED) {
				const current = currentDevices.get(event.deviceId);

				if (current !== undefined) {
					for (const capability of current.capabilities) {
						if (!capability.readable || capability.available === false) {
							continue;
						}

						await this.synchronizeCapabilityValue(
							event.deviceId,
							capability.id,
							capability.value,
							event.sequence === null ? event.occurredAt : null,
							event.sequence,
							result,
						);
					}
				}
			}

			const context = this.prepareDeviceEvent(event.deviceId, event.sequence, event.occurredAt, result);

			if (context !== null) {
				this.recordDeviceOrder(event.deviceId, context.order, connectionStateApplied.get(event.deviceId) === true);
			}
		}

		return acceptedEvents;
	}

	private async setConnectionState(
		panelDeviceId: string,
		state: ConnectionState,
		result: MutableSynchronizationResult,
	): Promise<boolean> {
		try {
			const applied = await this.deviceConnectivityService.trySetConnectionState(panelDeviceId, { state });

			if (applied) {
				result.updated += 1;
				return true;
			}
		} catch {
			// The fixed failure path below handles both thrown and explicit not-applied outcomes.
		}

		result.failed += 1;
		const decision = this.failureLogLimiter.consume('connection-state-update');

		if (decision.log) {
			this.logger.warn('Could not update an adopted Homey device connection state', {
				suppressed: decision.suppressed,
			});
		}
		return false;
	}

	private coalesceEvents(events: readonly HomeyEvent[]): HomeyEvent[] {
		const selectedCapabilityIndexes = new Map<string, number>();
		const selectedDeviceIndexes = new Map<string, { latest: number; latestRefresh: number | null }>();

		for (let index = 0; index < events.length; index += 1) {
			const event = events[index];

			if (event.type === HomeyEventType.CAPABILITY_VALUE_CHANGED) {
				const key = `${event.deviceId}\u0000${event.capabilityId}`;
				const selectedIndex = selectedCapabilityIndexes.get(key);

				if (selectedIndex === undefined || this.isLaterEvent(event, events[selectedIndex])) {
					selectedCapabilityIndexes.set(key, index);
				}
			} else if (this.isDeviceEvent(event)) {
				const selected = selectedDeviceIndexes.get(event.deviceId);
				const isRefresh = event.type === HomeyEventType.DEVICE_ADDED || event.type === HomeyEventType.DEVICE_UPDATED;
				const latest =
					selected === undefined || this.isLaterEvent(event, events[selected.latest]) ? index : selected.latest;
				const latestRefresh = !isRefresh
					? (selected?.latestRefresh ?? null)
					: selected?.latestRefresh === null || selected?.latestRefresh === undefined
						? index
						: this.isLaterEvent(event, events[selected.latestRefresh])
							? index
							: selected.latestRefresh;

				selectedDeviceIndexes.set(event.deviceId, { latest, latestRefresh });
			}
		}

		return events.filter((event, index) => {
			if (event.type === HomeyEventType.CAPABILITY_VALUE_CHANGED) {
				return selectedCapabilityIndexes.get(`${event.deviceId}\u0000${event.capabilityId}`) === index;
			}

			if (!this.isDeviceEvent(event)) {
				return true;
			}

			const selected = selectedDeviceIndexes.get(event.deviceId);

			if (selected === undefined || selected.latest === index) {
				return true;
			}

			return (
				selected.latestRefresh === index && events[selected.latest].type === HomeyEventType.DEVICE_AVAILABILITY_CHANGED
			);
		});
	}

	private preserveSequenceWatermark(
		order: HomeyEventOrder,
		previousOrder: HomeyEventOrder | undefined,
	): HomeyEventOrder {
		if (order.sequence !== null || typeof previousOrder?.sequence !== 'number') {
			return order;
		}

		return { ...order, sequence: previousOrder.sequence };
	}

	private isLaterEvent(candidate: HomeyEvent, current: HomeyEvent): boolean {
		const sequenceComparison = this.compareSequences(candidate.sequence, current.sequence);

		if (sequenceComparison !== null) {
			return sequenceComparison > 0;
		}

		const candidateTimestamp = this.eventTimestamp(candidate);
		const currentTimestamp = this.eventTimestamp(current);

		if (candidateTimestamp !== null && currentTimestamp !== null && candidateTimestamp !== currentTimestamp) {
			return candidateTimestamp > currentTimestamp;
		}

		return true;
	}

	private eventTimestamp(event: HomeyEvent): number | null {
		return this.parseTimestamp(
			event.type === HomeyEventType.CAPABILITY_VALUE_CHANGED
				? (event.lastUpdatedAt ?? event.occurredAt)
				: event.occurredAt,
		);
	}

	private isNewerOrder(candidate: HomeyEventOrder, current: HomeyEventOrder): boolean {
		return this.compareOrders(candidate, current) > 0;
	}

	private compareOrders(candidate: HomeyEventOrder, current: HomeyEventOrder): number {
		const sequenceComparison = this.compareSequences(candidate.sequence, current.sequence);

		if (sequenceComparison !== null) {
			return sequenceComparison;
		}

		if (candidate.timestamp !== null && current.timestamp !== null) {
			return Math.sign(candidate.timestamp - current.timestamp);
		}

		return Math.sign(candidate.arrival - current.arrival);
	}

	private createOrder(sequence: string | number | null, updatedAt: string | null): HomeyEventOrder {
		return {
			sequence,
			timestamp: this.parseTimestamp(updatedAt),
			arrival: ++this.arrivalOrder,
		};
	}

	private prepareDeviceEvent(
		homeyDeviceId: string,
		sequence: string | number | null,
		occurredAt: string | null,
		result: MutableSynchronizationResult,
	): { readonly adopted: HomeyDeviceEntity; readonly order: HomeyEventOrder } | null {
		const adopted = this.adoptedDevices.get(homeyDeviceId);

		if (adopted === undefined) {
			result.ignored += 1;
			return null;
		}

		const order = this.createOrder(sequence, occurredAt);
		const previousOrder = this.lastAppliedDeviceOrder.get(homeyDeviceId);

		if (previousOrder !== undefined && !this.isNewerOrder(order, previousOrder)) {
			result.ignored += 1;
			return null;
		}

		return { adopted, order };
	}

	private recordDeviceOrder(homeyDeviceId: string, order: HomeyEventOrder, applied: boolean): void {
		this.lastObservedDeviceOrder.set(
			homeyDeviceId,
			this.preserveSequenceWatermark(order, this.lastObservedDeviceOrder.get(homeyDeviceId)),
		);

		if (applied) {
			this.lastAppliedDeviceOrder.set(
				homeyDeviceId,
				this.preserveSequenceWatermark(order, this.lastAppliedDeviceOrder.get(homeyDeviceId)),
			);
		}
	}

	private isDeviceEvent(
		event: HomeyEvent,
	): event is Exclude<
		HomeyEvent,
		| Extract<HomeyEvent, { type: HomeyEventType.CAPABILITY_VALUE_CHANGED }>
		| Extract<
				HomeyEvent,
				{ type: HomeyEventType.ZONE_ADDED | HomeyEventType.ZONE_UPDATED | HomeyEventType.ZONE_REMOVED }
		  >
	> {
		return (
			event.type === HomeyEventType.DEVICE_AVAILABILITY_CHANGED ||
			event.type === HomeyEventType.DEVICE_ADDED ||
			event.type === HomeyEventType.DEVICE_UPDATED ||
			event.type === HomeyEventType.DEVICE_REMOVED
		);
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

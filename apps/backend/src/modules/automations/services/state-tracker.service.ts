import { Inject, Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger';
import { ConnectionState, EventType as DevicesEventType, OnlineDeviceState } from '../../devices/devices.constants';
import { ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { PropertyValueState } from '../../devices/models/property-value-state.model';
import { ChannelsPropertiesService } from '../../devices/services/channels.properties.service';
import { DeviceConnectionStateService } from '../../devices/services/device-connection-state.service';
import { PropertyValueService } from '../../devices/services/property-value.service';
import { AUTOMATIONS_MODULE_NAME } from '../automations.constants';
import { TrackerClock, systemTrackerClock } from '../tracker/clock';
import {
	StateFireCallback,
	StateReadResult,
	StateSnapshot,
	StateTracker,
	StateWatchSpec,
} from '../tracker/state-tracker';

/** Injection token for the clock of the state tracker; left unbound in the application, bound in tests */
export const AUTOMATION_TRACKER_CLOCK = Symbol('AUTOMATION_TRACKER_CLOCK');

interface DeviceConnectionChangedPayload {
	device?: Pick<DeviceEntity, 'id'> | null;
	state?: ConnectionState;
}

const describeError = (error: unknown): string => (error instanceof Error ? error.message : 'unknown error');

/**
 * A device that never reported its connection is treated as reachable: several integrations do not report
 * one at all, and their devices would otherwise never start an automation.
 */
const isReachable = (status: ConnectionState | undefined, online?: boolean): boolean =>
	online === true || status === undefined || status === ConnectionState.UNKNOWN || OnlineDeviceState.includes(status);

/**
 * Turns the value state of a property into what the tracker takes. A property without a value, or one
 * whose derived value is reported as unavailable, is not valid.
 */
export const toStateSnapshot = (state: PropertyValueState | null | undefined): StateSnapshot => {
	const value = state?.value ?? null;

	return { value, valid: value !== null && state?.producer?.quality !== 'unavailable' };
};

/** The id of the device a property belongs to, when the entity carries its channel */
const deviceIdOf = (property: ChannelPropertyEntity): string | null => {
	const channel = property.channel && typeof property.channel === 'object' ? property.channel : null;

	if (!channel) return null;

	if (channel.device && typeof channel.device === 'object') return channel.device.id ?? null;

	return typeof channel.device === 'string' ? channel.device : null;
};

/**
 * The state tracker of the automations module: a thin adapter (ADR 0003, decision 15) that feeds device
 * events into the framework-free `StateTracker` and reads the baseline of a property when it is first
 * referenced.
 *
 * It holds exactly one listener per device event, whatever the number of watches - the event bus allows 32
 * listeners per event - and the core routes each event by property id.
 */
@Injectable()
export class AutomationStateTrackerService implements OnModuleDestroy {
	private readonly logger = createExtensionLogger(AUTOMATIONS_MODULE_NAME, 'AutomationStateTrackerService');

	private readonly tracker: StateTracker;

	/** Tracked properties of each device, to route a connection change */
	private readonly deviceProperties = new Map<string, Set<string>>();
	private readonly propertyDevice = new Map<string, string>();
	private readonly baselines = new Set<Promise<void>>();

	constructor(
		private readonly propertiesService: ChannelsPropertiesService,
		private readonly propertyValueService: PropertyValueService,
		private readonly connectionStateService: DeviceConnectionStateService,
		@Optional() @Inject(AUTOMATION_TRACKER_CLOCK) clock?: TrackerClock,
	) {
		this.tracker = new StateTracker(clock ?? systemTrackerClock, {
			onTrack: (propertyId) => this.startBaseline(propertyId),
			onUntrack: (propertyId) => this.forgetDevice(propertyId),
			onError: (error, propertyId) => {
				this.logger.error(`A watch of property id=${propertyId} failed: ${describeError(error)}`);
			},
		});
	}

	onModuleDestroy(): void {
		this.tracker.dispose();
		this.deviceProperties.clear();
		this.propertyDevice.clear();
	}

	/**
	 * Starts watching a property and returns the function that stops the watch. `fire` is called for every
	 * transition, crossing or elapsed "for" duration the spec describes - never from inside this call and
	 * never for the value the property has when the watch starts.
	 *
	 * When this is the first reference to the property, its baseline is read in the background; call
	 * `settled()` to wait for it.
	 *
	 * @throws StateWatchSpecError when the spec is not valid (see `validateStateWatchSpec`)
	 */
	watch(spec: StateWatchSpec, fire: StateFireCallback): () => void {
		return this.tracker.watch(spec, fire);
	}

	/**
	 * Keeps the last-seen value of a property available to `read()` without watching it. Returns the
	 * function that releases the reference.
	 */
	reference(propertyId: string): () => void {
		return this.tracker.reference(propertyId);
	}

	/**
	 * The last-seen value of a watched or referenced property. Anything but `ok` means the value must not
	 * be acted on: `unknown` (not referenced, or nothing seen yet), `invalid` or `offline`.
	 */
	read(propertyId: string): StateReadResult {
		return this.tracker.read(propertyId);
	}

	/** Resolves once every baseline read that is in flight has finished */
	async settled(): Promise<void> {
		while (this.baselines.size > 0) {
			await Promise.all([...this.baselines]);
		}
	}

	/** Number of properties a value is kept for */
	trackedCount(): number {
		return this.tracker.trackedCount();
	}

	/** Number of "for" durations currently running */
	pendingTimers(): number {
		return this.tracker.pendingTimers();
	}

	@OnEvent(DevicesEventType.CHANNEL_PROPERTY_VALUE_SET)
	handlePropertyValueSet(property: ChannelPropertyEntity | null): void {
		this.ingest(property);
	}

	/**
	 * Required next to the value-set event: an update that changes both metadata and value emits only
	 * this one.
	 */
	@OnEvent(DevicesEventType.CHANNEL_PROPERTY_UPDATED)
	handlePropertyUpdated(property: ChannelPropertyEntity | null): void {
		// A metadata update may carry an entity whose value state was not read back. That says nothing about
		// the value, so it must not invalidate what is tracked; a state that is present still counts, also
		// when its value is null.
		this.ingest(property, { requireState: true });
	}

	/** The value state of a derived property changed: its quality, and possibly its value */
	@OnEvent(DevicesEventType.CHANNEL_PROPERTY_VALUE_STATE_CHANGED)
	handlePropertyValueStateChanged(property: ChannelPropertyEntity | null): void {
		this.ingest(property);
	}

	@OnEvent(DevicesEventType.DEVICE_CONNECTION_CHANGED)
	handleDeviceConnectionChanged(payload: DeviceConnectionChangedPayload | null): void {
		try {
			const deviceId = payload?.device?.id;
			const propertyIds = deviceId ? this.deviceProperties.get(deviceId) : undefined;

			if (!propertyIds) return;

			const online = isReachable(payload?.state);

			for (const propertyId of [...propertyIds]) {
				this.tracker.setAvailability(propertyId, { online });
			}
		} catch (error) {
			this.logFailure('a device connection change', error);
		}
	}

	private ingest(property: ChannelPropertyEntity | null, options: { requireState?: boolean } = {}): void {
		try {
			// The bus is synchronous: nothing thrown here may reach the service that emitted the event
			if (!property || typeof property.id !== 'string' || !this.tracker.isTracked(property.id)) return;

			// The baseline read normally indexes the device. When it failed, learn it from the event, so a
			// device going offline still reaches this property.
			if (!this.propertyDevice.has(property.id)) {
				const deviceId = deviceIdOf(property);

				if (deviceId) this.rememberDevice(property.id, deviceId);
			}

			if (options.requireState && (property.value === null || property.value === undefined)) return;

			this.tracker.report(property.id, toStateSnapshot(property.value));
		} catch (error) {
			this.logFailure('a property event', error);
		}
	}

	private startBaseline(propertyId: string): void {
		const baseline = this.loadBaseline(propertyId)
			.catch((error: unknown) => this.logFailure(`the baseline of property id=${propertyId}`, error))
			.finally(() => this.baselines.delete(baseline));

		this.baselines.add(baseline);
	}

	/**
	 * Reads the current value and reachability of a property that has just been referenced for the first
	 * time. The tracker ignores the value when a report arrived in the meantime, and never fires for it.
	 */
	private async loadBaseline(propertyId: string): Promise<void> {
		const property = await this.propertiesService.findOne(propertyId);

		if (!property || !this.tracker.isTracked(propertyId)) return;

		const deviceId = deviceIdOf(property);

		let online: boolean | undefined;

		if (deviceId) {
			// Indexed before the first await below, so a connection change during the reads is not missed
			this.rememberDevice(propertyId, deviceId);

			const connection = await this.connectionStateService.readLatest({ id: deviceId });

			online = isReachable(connection.status, connection.online);
		}

		const state = await this.propertyValueService.readLatest(property);

		if (!this.tracker.isTracked(propertyId)) {
			this.forgetDevice(propertyId);

			return;
		}

		this.tracker.seed(propertyId, { ...toStateSnapshot(state), ...(online !== undefined ? { online } : {}) });
	}

	private rememberDevice(propertyId: string, deviceId: string): void {
		this.propertyDevice.set(propertyId, deviceId);

		let propertyIds = this.deviceProperties.get(deviceId);

		if (!propertyIds) {
			propertyIds = new Set();
			this.deviceProperties.set(deviceId, propertyIds);
		}

		propertyIds.add(propertyId);
	}

	private forgetDevice(propertyId: string): void {
		const deviceId = this.propertyDevice.get(propertyId);

		if (!deviceId) return;

		this.propertyDevice.delete(propertyId);

		const propertyIds = this.deviceProperties.get(deviceId);

		propertyIds?.delete(propertyId);

		if (propertyIds?.size === 0) this.deviceProperties.delete(deviceId);
	}

	private logFailure(what: string, error: unknown): void {
		this.logger.warn(`Failed to process ${what}: ${describeError(error)}`);
	}
}

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger';
import { ConnectionState, EventType as DevicesEventType, OnlineDeviceState } from '../../devices/devices.constants';
import { DeviceConnectionStateService } from '../../devices/services/device-connection-state.service';
import { EventType as ScenesEventType } from '../../scenes/scenes.constants';
import { SecurityStateChangedPayload } from '../../security/contracts/security-state-changed.type';
import { EventType as SecurityEventType } from '../../security/security.constants';
import { EventType as SystemEventType } from '../../system/system.constants';
import { AUTOMATIONS_MODULE_NAME } from '../automations.constants';
import { ButtonOccurrence, DeviceConnectionChange, HouseModeChange, SceneRunEvent } from '../nodes/bus-events.types';

type Listener<T> = (payload: T) => void;

interface DeviceConnectionWatch {
	/** Whether the device is online; null while it is not known */
	online: boolean | null;
	/** Whether a connection change was seen since the watch started; it wins over the baseline read */
	seen: boolean;
	listeners: Set<Listener<DeviceConnectionChange>>;
}

const describeError = (error: unknown): string => (error instanceof Error ? error.message : 'unknown error');

const asRecord = (value: unknown): Record<string, unknown> | null =>
	typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;

const asString = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

/**
 * Whether a connection state is online, offline or says nothing. A device that reports no state, or
 * `unknown`, is neither: it is not taken as a transition either way.
 */
export const connectionOnline = (state: unknown): boolean | null => {
	if (typeof state !== 'string' || state === '' || state === (ConnectionState.UNKNOWN as string)) return null;

	return OnlineDeviceState.includes(state as ConnectionState);
};

/**
 * The events of the other modules the automation cards start on: button presses, device connection
 * changes, scene runs, house mode changes and security state transitions. A thin adapter (ADR 0003,
 * decision 15), like the state tracker and the time source.
 *
 * It holds exactly one listener per bus event, whatever the number of armed triggers - the event bus allows
 * 32 listeners per event - and hands each event to the triggers that subscribed. A listener that throws is
 * logged and the others are still called; nothing is thrown back into the bus.
 */
@Injectable()
export class AutomationEventSourceService implements OnModuleDestroy {
	private readonly logger = createExtensionLogger(AUTOMATIONS_MODULE_NAME, 'AutomationEventSourceService');

	private readonly buttonListeners = new Set<Listener<ButtonOccurrence>>();
	private readonly sceneListeners = new Set<Listener<SceneRunEvent>>();
	private readonly houseModeListeners = new Set<Listener<HouseModeChange>>();
	private readonly securityListeners = new Set<Listener<SecurityStateChangedPayload>>();
	private readonly connections = new Map<string, DeviceConnectionWatch>();

	constructor(private readonly connectionStateService: DeviceConnectionStateService) {}

	onModuleDestroy(): void {
		this.buttonListeners.clear();
		this.sceneListeners.clear();
		this.houseModeListeners.clear();
		this.securityListeners.clear();
		this.connections.clear();
	}

	/** Calls `listener` for every button occurrence of every device */
	onButtonOccurrence(listener: Listener<ButtonOccurrence>): () => void {
		return this.add(this.buttonListeners, listener);
	}

	/**
	 * Calls `listener` whenever the device goes from online to offline or back. A change between two
	 * online states (`init` to `ready`) or two offline ones is not a transition, and neither is the state
	 * the device is in when the watch starts: it is read in the background as the baseline.
	 */
	onDeviceConnection(deviceId: string, listener: Listener<DeviceConnectionChange>): () => void {
		let watch = this.connections.get(deviceId);

		if (!watch) {
			const created: DeviceConnectionWatch = { online: null, seen: false, listeners: new Set() };

			watch = created;
			this.connections.set(deviceId, created);

			this.connectionStateService
				.readLatest({ id: deviceId })
				.then((connection) => {
					if (this.connections.get(deviceId) !== created || created.seen) return;

					created.online = connectionOnline(connection.status);
				})
				.catch((error: unknown) => {
					this.logger.warn(`Failed to read the connection state of device id=${deviceId}: ${describeError(error)}`);
				});
		}

		const current = watch;
		const entry: Listener<DeviceConnectionChange> = (change) => listener(change);

		current.listeners.add(entry);

		let released = false;

		return () => {
			if (released) return;

			released = true;
			current.listeners.delete(entry);

			if (current.listeners.size === 0 && this.connections.get(deviceId) === current) {
				this.connections.delete(deviceId);
			}
		};
	}

	/** Calls `listener` for every scene run once it has finished */
	onSceneRun(listener: Listener<SceneRunEvent>): () => void {
		return this.add(this.sceneListeners, listener);
	}

	/** Calls `listener` whenever the house mode changes */
	onHouseModeChanged(listener: Listener<HouseModeChange>): () => void {
		return this.add(this.houseModeListeners, listener);
	}

	/** Calls `listener` for every transition of the armed state or of the alarm state */
	onSecurityStateChanged(listener: Listener<SecurityStateChangedPayload>): () => void {
		return this.add(this.securityListeners, listener);
	}

	/** Number of triggers being served, over every event */
	subscriptionCount(): number {
		let count =
			this.buttonListeners.size + this.sceneListeners.size + this.houseModeListeners.size + this.securityListeners.size;

		for (const watch of this.connections.values()) {
			count += watch.listeners.size;
		}

		return count;
	}

	// ---- bus -------------------------------------------------------------------------------------------

	@OnEvent(DevicesEventType.CHANNEL_INPUT_OCCURRENCE)
	handleChannelInputOccurrence(payload: unknown): void {
		const record = asRecord(payload);
		const id = asString(record?.id);
		const deviceId = asString(record?.deviceId);
		const channelId = asString(record?.channelId);
		const propertyId = asString(record?.propertyId);
		const event = asString(record?.event);

		if (!id || !deviceId || !channelId || !propertyId || !event) return;

		this.dispatch(this.buttonListeners, { id, deviceId, channelId, propertyId, event }, 'a button occurrence');
	}

	@OnEvent(DevicesEventType.DEVICE_CONNECTION_CHANGED)
	handleDeviceConnectionChanged(payload: unknown): void {
		const record = asRecord(payload);
		const deviceId = asString(asRecord(record?.device)?.id);
		const watch = deviceId ? this.connections.get(deviceId) : undefined;

		if (!deviceId || !watch) return;

		const state = record?.state;
		const online = connectionOnline(state);

		if (online === null) return;

		const previous = watch.online;

		watch.seen = true;
		watch.online = online;

		// Nothing is known to have changed when the state before is not known
		if (previous === null || previous === online) return;

		this.dispatch(watch.listeners, { deviceId, online, state: state as string }, 'a device connection change');
	}

	@OnEvent(ScenesEventType.SCENE_TRIGGERED)
	handleSceneTriggered(payload: unknown): void {
		const record = asRecord(payload);
		const result = asRecord(record?.result);
		const sceneId = asString(record?.id) ?? asString(result?.sceneId);
		const status = asString(result?.status);

		if (!sceneId || !status) return;

		this.dispatch(this.sceneListeners, { sceneId, status, triggeredBy: asString(result?.triggeredBy) }, 'a scene run');
	}

	@OnEvent(SystemEventType.HOUSE_MODE_CHANGED)
	handleHouseModeChanged(payload: unknown): void {
		const record = asRecord(payload);
		const to = asString(record?.newMode);

		if (!to) return;

		this.dispatch(this.houseModeListeners, { from: asString(record?.previousMode), to }, 'a house mode change');
	}

	@OnEvent(SecurityEventType.SECURITY_STATE_CHANGED)
	handleSecurityStateChanged(payload: SecurityStateChangedPayload | null): void {
		if (!payload || (payload.kind !== 'armed' && payload.kind !== 'alarm')) return;

		this.dispatch(this.securityListeners, payload, 'a security state transition');
	}

	// ---- helpers ---------------------------------------------------------------------------------------

	private add<T>(listeners: Set<Listener<T>>, listener: Listener<T>): () => void {
		// Each subscription is its own entry, so the same function subscribed twice is released twice
		const entry: Listener<T> = (payload) => listener(payload);

		listeners.add(entry);

		return () => {
			listeners.delete(entry);
		};
	}

	private dispatch<T>(listeners: Set<Listener<T>>, payload: T, what: string): void {
		for (const listener of [...listeners]) {
			if (!listeners.has(listener)) continue;

			try {
				listener(payload);
			} catch (error) {
				this.logger.warn(`A trigger failed on ${what}: ${describeError(error)}`);
			}
		}
	}
}

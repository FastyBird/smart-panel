import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import {
	DEFAULT_MQTT_BASE_TOPIC,
	DEVICES_ZIGBEE2MQTT_PLUGIN_NAME,
	Z2M_IGNORED_DEVICE_TYPES,
} from '../devices-zigbee2mqtt.constants';
import {
	Z2mAdapterCallbacks,
	Z2mBridgeEvent,
	Z2mBridgeState,
	Z2mDevice,
	Z2mDeviceAvailability,
	Z2mRegisteredDevice,
	Z2mSetPayload,
} from '../interfaces/zigbee2mqtt.interface';

/**
 * Abstract base class for Zigbee2MQTT client adapters.
 *
 * Contains shared device registry, state cache, message routing,
 * and callback management logic. Transport-specific subclasses
 * implement connect, disconnect, publishCommand, and requestState.
 */
export abstract class Z2mBaseClientAdapter {
	protected readonly logger: ExtensionLoggerService;

	protected connected = false;
	protected bridgeOnline = false;
	protected reconnectTimer: NodeJS.Timeout | null = null;
	protected configBaseTopic: string = DEFAULT_MQTT_BASE_TOPIC;

	// Internal device registry (keyed by friendly_name)
	protected readonly deviceRegistry = new Map<string, Z2mRegisteredDevice>();

	// Global state cache - stores ALL state messages by friendly_name
	// This is independent of deviceRegistry and is always populated when state messages arrive
	// Used as the source of truth for current device values during adoption and preview
	protected readonly stateCache = new Map<string, Record<string, unknown>>();

	// Callbacks for adapter events (set by the service)
	protected callbacks: Z2mAdapterCallbacks = {};

	constructor(adapterName: string) {
		this.logger = createExtensionLogger(DEVICES_ZIGBEE2MQTT_PLUGIN_NAME, adapterName);
	}

	/**
	 * Set callbacks for adapter events
	 */
	setCallbacks(callbacks: Z2mAdapterCallbacks): void {
		this.callbacks = callbacks;
	}

	/**
	 * Get the base topic
	 */
	get baseTopic(): string {
		return this.configBaseTopic;
	}

	/**
	 * Check if connected
	 */
	isConnected(): boolean {
		return this.connected;
	}

	/**
	 * Check if Zigbee2MQTT bridge is online
	 */
	isBridgeOnline(): boolean {
		return this.bridgeOnline;
	}

	/**
	 * Get all registered devices
	 */
	getRegisteredDevices(): Z2mRegisteredDevice[] {
		return Array.from(this.deviceRegistry.values());
	}

	/**
	 * Get a device by friendly name
	 */
	getDevice(friendlyName: string): Z2mRegisteredDevice | undefined {
		return this.deviceRegistry.get(friendlyName);
	}

	/**
	 * Get a device by IEEE address
	 */
	getDeviceByIeeeAddress(ieeeAddress: string): Z2mRegisteredDevice | undefined {
		for (const device of this.deviceRegistry.values()) {
			if (device.ieeeAddress === ieeeAddress) {
				return device;
			}
		}
		return undefined;
	}

	/**
	 * Get cached state for a device by friendly name
	 * This returns state from the global cache, which is always populated
	 * regardless of whether the device is in the registry or adopted
	 */
	getCachedState(friendlyName: string): Record<string, unknown> {
		return this.stateCache.get(friendlyName) ?? {};
	}

	/**
	 * Connect to the Zigbee2MQTT instance
	 */
	abstract connect(config: unknown): Promise<void>;

	/**
	 * Disconnect from the Zigbee2MQTT instance
	 */
	abstract disconnect(): Promise<void>;

	/**
	 * Publish a command to a device
	 */
	abstract publishCommand(friendlyName: string, payload: Z2mSetPayload): Promise<boolean>;

	/**
	 * Request current state from a device
	 */
	abstract requestState(friendlyName: string, properties?: string[]): Promise<boolean>;

	// =========================================================================
	// Shared message handling logic
	// =========================================================================

	/**
	 * Handle an incoming message from zigbee2mqtt.
	 * Called by subclasses when a message is received (via MQTT or WebSocket).
	 *
	 * @param topic - The full topic string (e.g. "zigbee2mqtt/bridge/state")
	 *                or relative path (e.g. "bridge/state") depending on transport.
	 * @param message - The message payload as string.
	 * @param isRelative - If true, topic is already relative to baseTopic.
	 */
	protected handleMessage(topic: string, message: string, isRelative = false): void {
		try {
			const relativePath = isRelative ? topic : topic.replace(`${this.baseTopic}/`, '');
			const topicParts = relativePath.split('/');

			if (topicParts.length === 0) {
				return;
			}

			// IMPORTANT: Check device registry FIRST, before bridge routing
			// This handles devices with names starting with "bridge/" (e.g., "bridge/light1")
			if (this.deviceRegistry.has(relativePath)) {
				this.handleDeviceStateMessage(relativePath, message);
				return;
			}

			// Now safe to check for bridge messages (no known device matches this path)
			if (topicParts[0] === 'bridge') {
				this.handleBridgeMessage(topicParts[1], message);
				return;
			}

			const lastPart = topicParts[topicParts.length - 1];
			const pathWithoutSuffix = topicParts.slice(0, -1).join('/');

			if (lastPart === 'availability' && pathWithoutSuffix) {
				this.handleDeviceAvailabilityMessage(pathWithoutSuffix, message);
				return;
			}

			if (lastPart === 'set' || lastPart === 'get') {
				// Command topics - skip
				return;
			}

			// Default: treat as state message for the full path
			this.handleDeviceStateMessage(relativePath, message);
		} catch (error) {
			this.logger.warn(`Failed to handle message on topic ${topic}`, {
				message: error instanceof Error ? error.message : String(error),
			});
		}
	}

	/**
	 * Handle bridge messages (state, devices, events)
	 */
	protected handleBridgeMessage(subtopic: string, message: string): void {
		switch (subtopic) {
			case 'state':
				this.handleBridgeStateMessage(message);
				break;
			case 'devices':
				this.handleBridgeDevicesMessage(message);
				break;
			case 'event':
				this.handleBridgeEventMessage(message);
				break;
			case 'groups':
				this.logger.debug('Received bridge/groups message (not implemented)');
				break;
		}
	}

	/**
	 * Handle bridge state message
	 */
	protected handleBridgeStateMessage(message: string): void {
		try {
			const state = JSON.parse(message) as Z2mBridgeState;
			const wasOnline = this.bridgeOnline;
			this.bridgeOnline = state.state === 'online';

			if (this.bridgeOnline && !wasOnline) {
				this.logger.log('Zigbee2MQTT bridge is online');
				void this.callbacks.onBridgeOnline?.();
			} else if (!this.bridgeOnline && wasOnline) {
				this.logger.warn('Zigbee2MQTT bridge is offline');
				void this.callbacks.onBridgeOffline?.();
			}
		} catch (error) {
			this.logger.warn('Failed to parse bridge/state message', {
				message: error instanceof Error ? error.message : String(error),
			});
		}
	}

	/**
	 * Handle bridge devices message
	 */
	protected handleBridgeDevicesMessage(message: string): void {
		try {
			const devices = JSON.parse(message) as Z2mDevice[];

			this.logger.log(`Received device registry with ${devices.length} devices`);

			for (const device of devices) {
				if (device.definition) {
					this.logger.debug(
						`Device ${device.friendly_name}: ${device.definition.exposes?.length ?? 0} exposes, ` +
							`types: ${device.definition.exposes?.map((e) => e.type).join(', ') ?? 'none'}`,
					);
				}
			}

			// Update internal registry
			for (const device of devices) {
				if (
					Z2M_IGNORED_DEVICE_TYPES.includes(device.type as (typeof Z2M_IGNORED_DEVICE_TYPES)[number]) ||
					!device.supported ||
					device.disabled
				) {
					continue;
				}

				const existing = this.deviceRegistry.get(device.friendly_name);
				const cachedState = this.stateCache.get(device.friendly_name) ?? {};

				const registeredDevice: Z2mRegisteredDevice = {
					ieeeAddress: device.ieee_address,
					friendlyName: device.friendly_name,
					description: device.description,
					type: device.type as 'Router' | 'EndDevice',
					supported: device.supported,
					disabled: device.disabled,
					definition: device.definition,
					powerSource: device.power_source,
					modelId: device.model_id,
					available: existing?.available ?? true,
					lastSeen: existing?.lastSeen,
					currentState: { ...(existing?.currentState ?? {}), ...cachedState },
				};

				this.deviceRegistry.set(device.friendly_name, registeredDevice);

				if (Object.keys(cachedState).length > 0) {
					this.logger.debug(
						`Applied cached state to "${device.friendly_name}": ${Object.keys(cachedState).join(', ')}`,
					);
				}
			}

			// Remove devices no longer in registry
			const currentFriendlyNames = new Set(devices.map((d) => d.friendly_name));
			for (const friendlyName of this.deviceRegistry.keys()) {
				if (!currentFriendlyNames.has(friendlyName)) {
					this.deviceRegistry.delete(friendlyName);
				}
			}

			// Request state for devices that don't have currentState
			this.requestMissingStates();

			// Invoke callback with filtered devices
			const filteredDevices = devices.filter(
				(d) =>
					!Z2M_IGNORED_DEVICE_TYPES.includes(d.type as (typeof Z2M_IGNORED_DEVICE_TYPES)[number]) &&
					d.supported &&
					!d.disabled,
			);
			void this.callbacks.onDevicesReceived?.(filteredDevices);
		} catch (error) {
			this.logger.error('Failed to parse bridge/devices message', {
				message: error instanceof Error ? error.message : String(error),
			});
		}
	}

	/**
	 * Request state for devices that don't have currentState populated
	 */
	protected requestMissingStates(): void {
		for (const [friendlyName, device] of this.deviceRegistry.entries()) {
			if (Object.keys(device.currentState).length === 0) {
				this.logger.debug(`Requesting state for device without current state: ${friendlyName}`);
				this.requestState(friendlyName).catch(() => {
					// Ignore errors - device might be offline
				});
			}
		}
	}

	/**
	 * Handle bridge event message
	 */
	protected handleBridgeEventMessage(message: string): void {
		try {
			const event = JSON.parse(message) as Z2mBridgeEvent;

			switch (event.type) {
				case 'device_joined':
				case 'device_announce':
					this.logger.log(`Device joined: ${event.data.friendly_name}`);
					void this.callbacks.onDeviceJoined?.(event.data.ieee_address ?? '', event.data.friendly_name ?? '');
					break;

				case 'device_leave':
					this.logger.log(`Device left: ${event.data.friendly_name}`);

					if (event.data.friendly_name) {
						this.deviceRegistry.delete(event.data.friendly_name);
					}

					void this.callbacks.onDeviceLeft?.(event.data.ieee_address ?? '', event.data.friendly_name ?? '');
					break;

				case 'device_interview':
					this.logger.debug(`Device interview: ${event.data.friendly_name} - ${event.data.status}`);
					break;
			}
		} catch (error) {
			this.logger.warn('Failed to parse bridge/event message', {
				message: error instanceof Error ? error.message : String(error),
			});
		}
	}

	/**
	 * Handle device state message
	 */
	protected handleDeviceStateMessage(friendlyName: string, message: string): void {
		try {
			const state = JSON.parse(message) as Record<string, unknown>;

			this.logger.debug(`Received state for "${friendlyName}": ${Object.keys(state).join(', ')}`);

			// ALWAYS store state in the global cache
			const existingCachedState = this.stateCache.get(friendlyName) ?? {};
			this.stateCache.set(friendlyName, { ...existingCachedState, ...state });

			// Also update internal registry if device exists there
			const device = this.deviceRegistry.get(friendlyName);
			if (device) {
				device.currentState = { ...device.currentState, ...state };
				device.lastSeen = new Date();
				this.logger.debug(`Updated registry and cache for "${friendlyName}"`);
			} else {
				this.logger.debug(`Updated cache for "${friendlyName}" (not yet in registry)`);
			}

			void this.callbacks.onDeviceStateChanged?.(friendlyName, state);
		} catch (error) {
			this.logger.warn(`Failed to parse state for device ${friendlyName}`, {
				message: error instanceof Error ? error.message : String(error),
			});
		}
	}

	/**
	 * Handle device availability message
	 */
	protected handleDeviceAvailabilityMessage(friendlyName: string, message: string): void {
		this.logger.debug(`Received availability for "${friendlyName}": ${message}`);

		try {
			let available: boolean;

			try {
				const availability = JSON.parse(message) as Z2mDeviceAvailability;
				available = availability.state === 'online';
			} catch {
				available = message === 'online';
			}

			const device = this.deviceRegistry.get(friendlyName);
			if (device) {
				device.available = available;
			}

			void this.callbacks.onDeviceAvailabilityChanged?.(friendlyName, available);
		} catch (error) {
			this.logger.warn(`Failed to parse availability for device ${friendlyName}`, {
				message: error instanceof Error ? error.message : String(error),
			});
		}
	}

	/**
	 * Clear reconnection timer
	 */
	protected clearReconnectTimer(): void {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
	}

	/**
	 * Reset adapter state on disconnect
	 */
	protected resetState(): void {
		this.connected = false;
		this.bridgeOnline = false;
		this.deviceRegistry.clear();
		this.stateCache.clear();
	}
}

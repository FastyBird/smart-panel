import * as mqtt from 'mqtt';

import { Injectable } from '@nestjs/common';

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
	Z2mMqttConfig,
	Z2mRegisteredDevice,
	Z2mSetPayload,
} from '../interfaces/zigbee2mqtt.interface';

/**
 * Zigbee2MQTT MQTT Client Adapter Service
 *
 * Handles MQTT connection to Zigbee2MQTT broker, topic subscriptions,
 * message parsing, and command publishing.
 */
@Injectable()
export class Z2mMqttClientAdapterService {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_ZIGBEE2MQTT_PLUGIN_NAME,
		'MqttClientAdapter',
	);

	private client: mqtt.MqttClient | null = null;
	private config: Z2mMqttConfig | null = null;
	private connected = false;
	private bridgeOnline = false;
	private reconnectTimer: NodeJS.Timeout | null = null;

	// Internal device registry (keyed by friendly_name)
	private readonly deviceRegistry = new Map<string, Z2mRegisteredDevice>();

	// Global state cache - stores ALL state messages by friendly_name
	// This is independent of deviceRegistry and is always populated when state messages arrive
	// Used as the source of truth for current device values during adoption and preview
	private readonly stateCache = new Map<string, Record<string, unknown>>();

	// Callbacks for adapter events (set by the service)
	private callbacks: Z2mAdapterCallbacks = {};

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
		return this.config?.baseTopic ?? DEFAULT_MQTT_BASE_TOPIC;
	}

	/**
	 * Check if connected to MQTT broker
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
	 * Connect to the MQTT broker
	 */
	async connect(config: Z2mMqttConfig): Promise<void> {
		this.config = config;

		// Clear any existing reconnect timer
		this.clearReconnectTimer();

		// Disconnect existing client if any
		await this.disconnect();

		const brokerUrl = this.buildBrokerUrl(config);

		this.logger.log(`Connecting to MQTT broker: ${brokerUrl}`);

		return new Promise((resolve, reject) => {
			try {
				const options: mqtt.IClientOptions = {
					clientId: config.clientId ?? `smart-panel-z2m-${Date.now()}`,
					clean: config.cleanSession,
					keepalive: config.keepalive,
					connectTimeout: config.connectTimeout,
					reconnectPeriod: 0, // We handle reconnection manually
					username: config.username ?? undefined,
					password: config.password ?? undefined,
				};

				// Add TLS options if configured
				if (config.tls?.enabled) {
					options.rejectUnauthorized = config.tls.rejectUnauthorized;
					if (config.tls.ca) {
						options.ca = config.tls.ca;
					}
					if (config.tls.cert) {
						options.cert = config.tls.cert;
					}
					if (config.tls.key) {
						options.key = config.tls.key;
					}
				}

				this.client = mqtt.connect(brokerUrl, options);

				this.client.on('connect', () => {
					this.logger.log('Connected to MQTT broker');
					this.connected = true;

					// Subscribe to all necessary topics
					this.subscribeToTopics();

					resolve();
				});

				this.client.on('error', (error) => {
					this.logger.error('MQTT client error', {
						message: error.message,
					});

					if (!this.connected) {
						reject(error);
					}
				});

				this.client.on('close', () => {
					const wasConnected = this.connected;
					this.connected = false;
					this.bridgeOnline = false;

					this.logger.log('Disconnected from MQTT broker');

					if (wasConnected) {
						// Schedule reconnection
						this.scheduleReconnect();
					}
				});

				this.client.on('offline', () => {
					this.logger.warn('MQTT client is offline');
				});

				this.client.on('message', (topic, payload) => {
					this.handleMessage(topic, payload);
				});
			} catch (error) {
				this.logger.error('Failed to create MQTT client', {
					message: error instanceof Error ? error.message : String(error),
				});
				reject(error instanceof Error ? error : new Error(String(error)));
			}
		});
	}

	/**
	 * Disconnect from the MQTT broker
	 */
	async disconnect(): Promise<void> {
		this.clearReconnectTimer();

		if (this.client) {
			this.logger.log('Disconnecting from MQTT broker');

			// Set connected to false BEFORE calling end() to prevent the 'close' event handler
			// from scheduling a reconnect. The 'close' event fires during end() and checks
			// wasConnected - by setting this first, wasConnected will be false.
			this.connected = false;
			this.bridgeOnline = false;

			// Also clear config to prevent any reconnection attempts
			this.config = null;

			return new Promise((resolve) => {
				this.client?.end(true, {}, () => {
					this.client = null;
					this.deviceRegistry.clear();
					this.stateCache.clear();
					resolve();
				});
			});
		}
	}

	/**
	 * Publish a command to a device
	 */
	async publishCommand(friendlyName: string, payload: Z2mSetPayload): Promise<boolean> {
		if (!this.client || !this.connected) {
			this.logger.warn('Cannot publish: not connected to MQTT broker');
			return false;
		}

		const topic = `${this.baseTopic}/${friendlyName}/set`;
		const message = JSON.stringify(payload);

		this.logger.debug(`Publishing to ${topic}: ${message}`);

		return new Promise((resolve) => {
			this.client?.publish(topic, message, { qos: 1 }, (error) => {
				if (error) {
					this.logger.error(`Failed to publish to ${topic}`, {
						message: error.message,
					});
					resolve(false);
				} else {
					resolve(true);
				}
			});
		});
	}

	/**
	 * Request current state from a device
	 */
	async requestState(friendlyName: string, properties: string[] = []): Promise<boolean> {
		if (!this.client || !this.connected) {
			return false;
		}

		const topic = `${this.baseTopic}/${friendlyName}/get`;
		const payload = properties.length > 0 ? Object.fromEntries(properties.map((p) => [p, ''])) : { state: '' };
		const message = JSON.stringify(payload);

		return new Promise((resolve) => {
			this.client?.publish(topic, message, { qos: 1 }, (error) => {
				resolve(!error);
			});
		});
	}

	/**
	 * Build the MQTT broker URL
	 */
	private buildBrokerUrl(config: Z2mMqttConfig): string {
		const protocol = config.tls?.enabled ? 'mqtts' : 'mqtt';
		return `${protocol}://${config.host}:${config.port}`;
	}

	/**
	 * Subscribe to all necessary Zigbee2MQTT topics
	 */
	private subscribeToTopics(): void {
		if (!this.client) {
			return;
		}

		const topics = [
			`${this.baseTopic}/bridge/state`,
			`${this.baseTopic}/bridge/devices`,
			`${this.baseTopic}/bridge/event`,
			`${this.baseTopic}/bridge/groups`,
			`${this.baseTopic}/#`, // All device topics (state, availability, etc.) - supports friendly names with slashes
		];

		for (const topic of topics) {
			this.client.subscribe(topic, { qos: 1 }, (error) => {
				if (error) {
					this.logger.error(`Failed to subscribe to ${topic}`, {
						message: error.message,
					});
				} else {
					this.logger.debug(`Subscribed to ${topic}`);
				}
			});
		}
	}

	/**
	 * Handle incoming MQTT messages
	 *
	 * Topic routing handles devices with slashes in friendly names correctly.
	 * We check the device registry FIRST to disambiguate edge cases:
	 *
	 * 1. Devices starting with "bridge/" (e.g., "bridge/light1"):
	 *    - State: zigbee2mqtt/bridge/light1 → routed as device state, not bridge message
	 *
	 * 2. Devices ending with "/availability", "/set", "/get":
	 *    - State: zigbee2mqtt/sensor/availability → routed as state for "sensor/availability"
	 *    - Availability: zigbee2mqtt/sensor/availability/availability
	 */
	private handleMessage(topic: string, payload: Buffer): void {
		const message = payload.toString();

		try {
			// Parse topic to determine message type
			// Remove baseTopic prefix to get the remaining path
			const relativePath = topic.replace(`${this.baseTopic}/`, '');
			const topicParts = relativePath.split('/');

			if (topicParts.length === 0) {
				return;
			}

			// IMPORTANT: Check device registry FIRST, before bridge routing
			// This handles devices with names starting with "bridge/" (e.g., "bridge/light1")
			// Without this check, "zigbee2mqtt/bridge/light1" would be misrouted to handleBridgeMessage
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
				// Check if path without suffix is a known device
				// e.g., "sensor/availability" topic for device "sensor"
				if (this.deviceRegistry.has(pathWithoutSuffix)) {
					this.handleDeviceAvailabilityMessage(pathWithoutSuffix, message);
				} else {
					// Unknown device, might be availability for a new device not yet in registry
					// or state message for device ending with /availability not yet registered
					this.handleDeviceAvailabilityMessage(pathWithoutSuffix, message);
				}
				return;
			}

			if (lastPart === 'set' || lastPart === 'get') {
				// Command topics - skip unless it's a device with that name
				// Commands are outbound only, we don't receive meaningful data here
				return;
			}

			// Default: treat as state message for the full path
			// This handles devices not yet in registry
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
	private handleBridgeMessage(subtopic: string, message: string): void {
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
				// Groups not implemented yet
				this.logger.debug('Received bridge/groups message (not implemented)');
				break;
		}
	}

	/**
	 * Handle bridge state message
	 */
	private handleBridgeStateMessage(message: string): void {
		try {
			const state = JSON.parse(message) as Z2mBridgeState;
			const wasOnline = this.bridgeOnline;
			this.bridgeOnline = state.state === 'online';

			if (this.bridgeOnline && !wasOnline) {
				this.logger.log('Zigbee2MQTT bridge is online');
				this.callbacks.onBridgeOnline?.();
			} else if (!this.bridgeOnline && wasOnline) {
				this.logger.warn('Zigbee2MQTT bridge is offline');
				this.callbacks.onBridgeOffline?.();
			}
		} catch {
			// Try legacy format (just "online" or "offline" string)
			const wasOnline = this.bridgeOnline;
			this.bridgeOnline = message === 'online';

			if (this.bridgeOnline !== wasOnline) {
				if (this.bridgeOnline) {
					this.logger.log('Zigbee2MQTT bridge is online');
					this.callbacks.onBridgeOnline?.();
				} else {
					this.logger.warn('Zigbee2MQTT bridge is offline');
					this.callbacks.onBridgeOffline?.();
				}
			}
		}
	}

	/**
	 * Handle bridge devices message
	 */
	private handleBridgeDevicesMessage(message: string): void {
		try {
			const devices = JSON.parse(message) as Z2mDevice[];

			this.logger.log(`Received device registry with ${devices.length} devices`);

			// Debug: Log device definitions for troubleshooting
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
				// Skip coordinator and unsupported devices
				if (
					Z2M_IGNORED_DEVICE_TYPES.includes(device.type as (typeof Z2M_IGNORED_DEVICE_TYPES)[number]) ||
					!device.supported ||
					device.disabled
				) {
					continue;
				}

				const existing = this.deviceRegistry.get(device.friendly_name);

				// Get cached state from the global state cache
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
					// Use cached state as the source of truth for current values
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
			// This ensures we have initial values even if Z2M hasn't sent state updates
			this.requestMissingStates();

			// Invoke callback with filtered devices
			const filteredDevices = devices.filter(
				(d) =>
					!Z2M_IGNORED_DEVICE_TYPES.includes(d.type as (typeof Z2M_IGNORED_DEVICE_TYPES)[number]) &&
					d.supported &&
					!d.disabled,
			);
			this.callbacks.onDevicesReceived?.(filteredDevices);
		} catch (error) {
			this.logger.error('Failed to parse bridge/devices message', {
				message: error instanceof Error ? error.message : String(error),
			});
		}
	}

	/**
	 * Request state for devices that don't have currentState populated
	 */
	private requestMissingStates(): void {
		for (const [friendlyName, device] of this.deviceRegistry.entries()) {
			// Check if device has any state values
			if (Object.keys(device.currentState).length === 0) {
				this.logger.debug(`Requesting state for device without current state: ${friendlyName}`);
				// Fire and forget - responses will be handled by handleDeviceStateMessage
				this.requestState(friendlyName).catch(() => {
					// Ignore errors - device might be offline
				});
			}
		}
	}

	/**
	 * Handle bridge event message
	 */
	private handleBridgeEventMessage(message: string): void {
		try {
			const event = JSON.parse(message) as Z2mBridgeEvent;

			switch (event.type) {
				case 'device_joined':
				case 'device_announce':
					this.logger.log(`Device joined: ${event.data.friendly_name}`);
					this.callbacks.onDeviceJoined?.(event.data.ieee_address ?? '', event.data.friendly_name ?? '');
					break;

				case 'device_leave':
					this.logger.log(`Device left: ${event.data.friendly_name}`);

					// Remove from registry
					if (event.data.friendly_name) {
						this.deviceRegistry.delete(event.data.friendly_name);
					}

					this.callbacks.onDeviceLeft?.(event.data.ieee_address ?? '', event.data.friendly_name ?? '');
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
	 *
	 * Note: No filtering for "bridge" or "bridge/" names here.
	 * The routing in handleMessage() checks the device registry first,
	 * so if we reach this function, the friendlyName is a legitimate device.
	 */
	private handleDeviceStateMessage(friendlyName: string, message: string): void {
		try {
			const state = JSON.parse(message) as Record<string, unknown>;

			this.logger.debug(`Received state for "${friendlyName}": ${Object.keys(state).join(', ')}`);

			// ALWAYS store state in the global cache (independent of device registry)
			// This ensures state is available for adoption preview even if device isn't registered yet
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

			// Invoke callback for state change
			this.callbacks.onDeviceStateChanged?.(friendlyName, state);
		} catch (error) {
			this.logger.warn(`Failed to parse state for device ${friendlyName}`, {
				message: error instanceof Error ? error.message : String(error),
			});
		}
	}

	/**
	 * Handle device availability message
	 */
	private handleDeviceAvailabilityMessage(friendlyName: string, message: string): void {
		this.logger.debug(`Received availability for "${friendlyName}": ${message}`);

		try {
			let available: boolean;

			// Try JSON format first
			try {
				const availability = JSON.parse(message) as Z2mDeviceAvailability;
				available = availability.state === 'online';
			} catch {
				// Fall back to plain string
				available = message === 'online';
			}

			// Update internal registry
			const device = this.deviceRegistry.get(friendlyName);
			if (device) {
				device.available = available;
			}

			// Invoke callback for availability change
			this.callbacks.onDeviceAvailabilityChanged?.(friendlyName, available);
		} catch (error) {
			this.logger.warn(`Failed to parse availability for device ${friendlyName}`, {
				message: error instanceof Error ? error.message : String(error),
			});
		}
	}

	/**
	 * Schedule reconnection to MQTT broker
	 */
	private scheduleReconnect(): void {
		if (this.reconnectTimer || !this.config) {
			return;
		}

		const interval = this.config.reconnectInterval;
		this.logger.log(`Scheduling reconnection in ${interval}ms`);

		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null;

			if (!this.connected && this.config) {
				this.connect(this.config).catch((error: unknown) => {
					const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
					this.logger.error('Reconnection failed', {
						message: errorMessage,
					});
					// Schedule another reconnection
					this.scheduleReconnect();
				});
			}
		}, interval);
	}

	/**
	 * Clear reconnection timer
	 */
	private clearReconnectTimer(): void {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
	}
}

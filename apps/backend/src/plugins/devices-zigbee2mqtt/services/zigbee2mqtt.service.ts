import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { ConfigService } from '../../../modules/config/services/config.service';
import { ConnectionState } from '../../../modules/devices/devices.constants';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { BaseManagedPluginService } from '../../../modules/extensions/services/base-managed-plugin.service';
import {
	ConfigChangeResult,
	ServiceState,
} from '../../../modules/extensions/services/managed-plugin-service.interface';
import { PluginServiceManagerService } from '../../../modules/extensions/services/plugin-service-manager.service';
import { DEVICES_ZIGBEE2MQTT_PLUGIN_NAME, DEVICES_ZIGBEE2MQTT_TYPE } from '../devices-zigbee2mqtt.constants';
import { Zigbee2mqttDeviceEntity } from '../entities/devices-zigbee2mqtt.entity';
import { Z2mDevice, Z2mMqttConfig, Z2mRegisteredDevice, Z2mWsConfig } from '../interfaces/zigbee2mqtt.interface';
import { Zigbee2mqttConfigModel } from '../models/config.model';

import { Z2mBaseClientAdapter } from './base-client-adapter';
import { Z2mDeviceMapperService } from './device-mapper.service';
import { Z2mMqttClientAdapterService } from './mqtt-client-adapter.service';
import { Z2mWsClientAdapterService } from './ws-client-adapter.service';

/**
 * Main Zigbee2MQTT Service
 *
 * Manages the lifecycle of Zigbee2MQTT integration, connection
 * (via MQTT or WebSocket), device synchronization, and event handling.
 */
@Injectable()
export class Zigbee2mqttService extends BaseManagedPluginService {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_ZIGBEE2MQTT_PLUGIN_NAME,
		'Zigbee2mqttService',
	);

	readonly pluginName = DEVICES_ZIGBEE2MQTT_PLUGIN_NAME;
	readonly serviceId = 'connector';

	private pluginConfig: Zigbee2mqttConfigModel | null = null;
	private deviceSyncPending = false;
	private bridgeOnline = false;
	private pendingDevices: Z2mDevice[] | null = null;
	private isSyncing = false; // Prevents concurrent sync operations
	private transformersRestored = false; // Tracks if transformers have been restored after restart

	// The active adapter is selected based on connection_type config
	private activeAdapter: Z2mBaseClientAdapter;

	// Subscribers notified when a brand-new Z2M device appears in the registry.
	// Used by the wizard service to react to devices joined during a pairing session.
	private readonly deviceJoinedSubscribers = new Set<(device: Z2mRegisteredDevice) => void>();

	// Friendly names captured from real `device_joined` / `device_announce`
	// bridge events. The bridge follows up with a `bridge/devices` republish
	// once interview completes — at that point we drain this set, look up the
	// full `Z2mRegisteredDevice`, and fire `notifyDeviceJoined` exactly once
	// per truly new device. This avoids the initial-fetch problem where every
	// already-paired device would otherwise look "new" to a freshly-started
	// service.
	private readonly pendingJoinedFriendlyNames = new Set<string>();

	constructor(
		private readonly configService: ConfigService,
		private readonly mqttAdapter: Z2mMqttClientAdapterService,
		private readonly wsAdapter: Z2mWsClientAdapterService,
		private readonly deviceMapper: Z2mDeviceMapperService,
		private readonly devicesService: DevicesService,
		private readonly deviceConnectivityService: DeviceConnectivityService,
		private readonly pluginServiceManager: PluginServiceManagerService,
	) {
		super();

		// Default to MQTT adapter initially
		this.activeAdapter = this.mqttAdapter;
		this.registerCallbacks(this.activeAdapter);
	}

	/**
	 * Get the currently active client adapter.
	 * Used by DevicePlatform and other services that need to send commands.
	 */
	getActiveAdapter(): Z2mBaseClientAdapter {
		return this.activeAdapter;
	}

	/**
	 * Start the service.
	 */
	async start(): Promise<void> {
		await this.withLock(async () => {
			switch (this.state) {
				case 'started':
					return;
				case 'starting':
					return;
				case 'stopping':
					await this.waitUntil('stopped');
					// Clear cached config to ensure fresh values on restart
					this.pluginConfig = null;
					await this.initialize();
					await this.doStart();
					return;
				case 'stopped':
				case 'error':
					// Clear cached config to ensure fresh values on restart
					this.pluginConfig = null;
					await this.initialize();
					await this.doStart();
					return;
			}
		});
	}

	/**
	 * Stop the service.
	 */
	async stop(): Promise<void> {
		await this.withLock(async () => {
			switch (this.state) {
				case 'stopped':
					return;
				case 'stopping':
					return;
				case 'starting':
					await this.waitUntil('started', 'stopped', 'error');
					if (this.getState() !== 'started') {
						return;
					}
				// fallthrough
				case 'started':
					await this.doStop();
					return;
				case 'error':
					await this.doStop();
					return;
			}
		});
	}

	/**
	 * Handle configuration changes.
	 */
	onConfigChanged(): Promise<ConfigChangeResult> {
		// Check if config values actually changed for THIS plugin
		if (this.state === 'started' && this.pluginConfig) {
			const oldConfig = this.pluginConfig;
			const newConfig = this.configService.getPluginConfig<Zigbee2mqttConfigModel>(DEVICES_ZIGBEE2MQTT_PLUGIN_NAME);

			// Connection type change always requires restart
			if (oldConfig.connectionType !== newConfig.connectionType) {
				this.logger.log('Connection type changed, restart required');
				return Promise.resolve({ restartRequired: true });
			}

			if (newConfig.connectionType === 'mqtt') {
				// Compare MQTT connection settings that would require restart
				const mqttChanged =
					oldConfig.mqtt.host !== newConfig.mqtt.host ||
					oldConfig.mqtt.port !== newConfig.mqtt.port ||
					oldConfig.mqtt.username !== newConfig.mqtt.username ||
					oldConfig.mqtt.password !== newConfig.mqtt.password ||
					oldConfig.mqtt.baseTopic !== newConfig.mqtt.baseTopic ||
					oldConfig.mqtt.clientId !== newConfig.mqtt.clientId;

				// Compare TLS settings
				const tlsChanged =
					oldConfig.tls.enabled !== newConfig.tls.enabled ||
					oldConfig.tls.rejectUnauthorized !== newConfig.tls.rejectUnauthorized ||
					oldConfig.tls.ca !== newConfig.tls.ca ||
					oldConfig.tls.cert !== newConfig.tls.cert ||
					oldConfig.tls.key !== newConfig.tls.key;

				if (mqttChanged || tlsChanged) {
					this.logger.log('MQTT config changed, restart required');
					return Promise.resolve({ restartRequired: true });
				}
			} else {
				// Compare WebSocket connection settings
				const wsChanged =
					oldConfig.ws.host !== newConfig.ws.host ||
					oldConfig.ws.port !== newConfig.ws.port ||
					oldConfig.ws.baseTopic !== newConfig.ws.baseTopic ||
					oldConfig.ws.secure !== newConfig.ws.secure ||
					oldConfig.ws.connectTimeout !== newConfig.ws.connectTimeout ||
					oldConfig.ws.reconnectInterval !== newConfig.ws.reconnectInterval;

				if (wsChanged) {
					this.logger.log('WebSocket config changed, restart required');
					return Promise.resolve({ restartRequired: true });
				}
			}

			// Config didn't change for this plugin (or only discovery settings changed), no restart needed
			return Promise.resolve({ restartRequired: false });
		}

		// Clear config only if not running (no handlers active)
		this.pluginConfig = null;

		return Promise.resolve({ restartRequired: false });
	}

	/**
	 * Restart the service.
	 */
	async restart(): Promise<void> {
		const success = await this.pluginServiceManager.restartService(this.pluginName, this.serviceId);

		if (!success) {
			this.logger.debug('Restart skipped (plugin may be disabled)');
		}
	}

	/**
	 * Check if bridge is online
	 */
	isBridgeOnline(): boolean {
		return this.activeAdapter.isBridgeOnline();
	}

	/**
	 * Get all registered Z2M devices
	 */
	getRegisteredDevices() {
		return this.activeAdapter.getRegisteredDevices();
	}

	/**
	 * Request current state from a Z2M device
	 * This triggers Z2M to publish the device's current state
	 */
	async requestDeviceState(friendlyName: string): Promise<boolean> {
		return this.activeAdapter.requestState(friendlyName);
	}

	/**
	 * Toggle the bridge's permit_join state for a bounded number of seconds.
	 * Returns true on successful publish/send, false otherwise.
	 * Pass 0 to disable pairing immediately.
	 *
	 * Returns false if the bridge is offline or no adapter is active.
	 */
	async setPermitJoin(seconds: number): Promise<boolean> {
		if (!this.isBridgeOnline()) {
			return false;
		}

		if (!this.activeAdapter) {
			return false;
		}

		return this.activeAdapter.setPermitJoin(seconds);
	}

	/**
	 * Subscribe to "device joined" notifications.
	 *
	 * The callback is invoked with the new Z2mRegisteredDevice each time a
	 * previously-unknown device is added to the internal registry. It is NOT
	 * invoked for updates to already-registered devices.
	 *
	 * Returns an unsubscribe function.
	 */
	subscribeToDeviceJoined(cb: (device: Z2mRegisteredDevice) => void): () => void {
		this.deviceJoinedSubscribers.add(cb);

		return () => {
			this.deviceJoinedSubscribers.delete(cb);
		};
	}

	/**
	 * Notify all device-joined subscribers of a new device.
	 * Subscriber exceptions are caught and logged so a faulty subscriber
	 * cannot break the others (or the calling sync logic).
	 */
	private notifyDeviceJoined(device: Z2mRegisteredDevice): void {
		for (const cb of this.deviceJoinedSubscribers) {
			try {
				cb(device);
			} catch (e) {
				this.logger.warn('Device-joined subscriber threw', {
					message: e instanceof Error ? e.message : String(e),
				});
			}
		}
	}

	/**
	 * Get cached state for a device by friendly name
	 * This returns state from the global cache, which is always populated
	 * regardless of whether the device is in the registry or adopted
	 */
	getCachedState(friendlyName: string): Record<string, unknown> {
		return this.activeAdapter.getCachedState(friendlyName);
	}

	/**
	 * Initialize device states before starting
	 */
	private async initialize(): Promise<void> {
		const devices = await this.devicesService.findAll<Zigbee2mqttDeviceEntity>(DEVICES_ZIGBEE2MQTT_TYPE);

		for (const device of devices) {
			await this.deviceConnectivityService.setConnectionState(device.id, {
				state: ConnectionState.UNKNOWN,
			});
		}
	}

	/**
	 * Perform the actual start logic
	 */
	private async doStart(): Promise<void> {
		this.state = 'starting';

		this.logger.log('Starting Zigbee2MQTT plugin service');

		try {
			// Select adapter based on connection type
			const config = this.config;
			const previousAdapter = this.activeAdapter;
			this.activeAdapter = config.connectionType === 'ws' ? this.wsAdapter : this.mqttAdapter;

			// If adapter changed, clear stale callbacks on the old adapter and register on the new one
			if (this.activeAdapter !== previousAdapter) {
				previousAdapter.setCallbacks({});
				this.registerCallbacks(this.activeAdapter);
			}

			// Connect using the appropriate config
			if (config.connectionType === 'ws') {
				const wsConfig = this.buildWsConfig();
				this.logger.log('Using WebSocket connection to Zigbee2MQTT');
				await this.activeAdapter.connect(wsConfig);
			} else {
				const mqttConfig = this.buildMqttConfig();
				this.logger.log('Using MQTT connection to Zigbee2MQTT');
				await this.activeAdapter.connect(mqttConfig);
			}

			this.logger.log('Zigbee2MQTT plugin service started successfully');
			this.state = 'started';
		} catch (error) {
			this.logger.error('Failed to start Zigbee2MQTT plugin service', {
				message: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
			});

			this.state = 'error';
			throw error;
		}
	}

	/**
	 * Perform the actual stop logic
	 */
	private async doStop(): Promise<void> {
		this.state = 'stopping';
		this.transformersRestored = false;

		this.logger.log('Stopping Zigbee2MQTT plugin service');

		try {
			// Disconnect the active adapter
			await this.activeAdapter.disconnect();

			// Set all devices to unknown state
			const devices = await this.devicesService.findAll<Zigbee2mqttDeviceEntity>(DEVICES_ZIGBEE2MQTT_TYPE);
			for (const device of devices) {
				await this.deviceConnectivityService.setConnectionState(device.id, {
					state: ConnectionState.UNKNOWN,
				});
			}

			this.logger.log('Zigbee2MQTT plugin service stopped');
			this.state = 'stopped';
		} catch (error) {
			this.logger.error('Failed to stop Zigbee2MQTT plugin service', {
				message: error instanceof Error ? error.message : String(error),
			});

			this.state = 'stopped';
		}
	}

	/**
	 * Register event callbacks on the given adapter
	 */
	private registerCallbacks(adapter: Z2mBaseClientAdapter): void {
		adapter.setCallbacks({
			onBridgeOnline: () => this.handleBridgeOnline(),
			onBridgeOffline: () => this.handleBridgeOffline(),
			onDevicesReceived: (devices) => this.handleDevicesReceived(devices),
			onDeviceStateChanged: (friendlyName, state) => this.handleDeviceStateChanged(friendlyName, state),
			onDeviceAvailabilityChanged: (friendlyName, available) =>
				this.handleDeviceAvailabilityChanged(friendlyName, available),
			onDeviceJoined: (ieeeAddress, friendlyName) => this.handleDeviceJoined(ieeeAddress, friendlyName),
			onDeviceLeft: (ieeeAddress, friendlyName) => this.handleDeviceLeft(ieeeAddress, friendlyName),
		});
	}

	/**
	 * Build MQTT configuration from plugin config
	 */
	private buildMqttConfig(): Z2mMqttConfig {
		const config = this.config;

		return {
			host: config.mqtt.host,
			port: config.mqtt.port,
			username: config.mqtt.username ?? undefined,
			password: config.mqtt.password ?? undefined,
			baseTopic: config.mqtt.baseTopic,
			clientId: config.mqtt.clientId ?? undefined,
			cleanSession: config.mqtt.cleanSession,
			keepalive: config.mqtt.keepalive,
			connectTimeout: config.mqtt.connectTimeout,
			reconnectInterval: config.mqtt.reconnectInterval,
			tls: config.tls.enabled
				? {
						enabled: true,
						rejectUnauthorized: config.tls.rejectUnauthorized,
						ca: config.tls.ca ?? undefined,
						cert: config.tls.cert ?? undefined,
						key: config.tls.key ?? undefined,
					}
				: undefined,
		};
	}

	/**
	 * Build WebSocket configuration from plugin config
	 */
	private buildWsConfig(): Z2mWsConfig {
		const config = this.config;

		return {
			host: config.ws.host,
			port: config.ws.port,
			baseTopic: config.ws.baseTopic,
			secure: config.ws.secure,
			connectTimeout: config.ws.connectTimeout,
			reconnectInterval: config.ws.reconnectInterval,
		};
	}

	/**
	 * Handle bridge online event
	 */
	private async handleBridgeOnline(): Promise<void> {
		this.logger.log('Bridge is online');
		this.bridgeOnline = true;

		// Check if we have pending devices that arrived before bridge came online
		// This handles the race condition where DEVICES_RECEIVED arrives before BRIDGE_ONLINE
		if (this.config.discovery.syncOnStartup && this.pendingDevices !== null) {
			this.logger.log('Processing pending devices that arrived before bridge online');
			await this.syncDevices(this.pendingDevices, this.config.discovery.autoAdd);
			this.pendingDevices = null;
		} else if (this.config.discovery.syncOnStartup) {
			// Set flag for when devices message arrives
			this.deviceSyncPending = true;
		}
	}

	/**
	 * Handle bridge offline event
	 */
	private async handleBridgeOffline(): Promise<void> {
		this.logger.warn('Bridge is offline');
		this.bridgeOnline = false;
		this.pendingDevices = null;
		this.isSyncing = false;
		this.transformersRestored = false;
		this.pendingJoinedFriendlyNames.clear();

		// Set all devices to unknown state
		try {
			const devices = await this.devicesService.findAll<Zigbee2mqttDeviceEntity>(DEVICES_ZIGBEE2MQTT_TYPE);
			for (const device of devices) {
				await this.deviceConnectivityService.setConnectionState(device.id, {
					state: ConnectionState.UNKNOWN,
				});
			}
		} catch (error) {
			this.logger.error('Failed to update device states on bridge offline', {
				message: error instanceof Error ? error.message : String(error),
			});
		}
	}

	/**
	 * Handle devices received event
	 */
	private async handleDevicesReceived(devices: Z2mDevice[]): Promise<void> {
		this.logger.log(`Received ${devices.length} devices from bridge`);

		const shouldSyncExisting = this.deviceSyncPending;
		const shouldAddNew = this.config.discovery.autoAdd;

		// If bridge is not online yet and syncOnStartup is enabled,
		// cache devices for processing when BRIDGE_ONLINE arrives
		if (!this.bridgeOnline && this.config.discovery.syncOnStartup) {
			this.pendingDevices = devices;
			return;
		}

		// Always restore transformers for existing devices when we receive device list
		const registeredDevices = this.activeAdapter.getRegisteredDevices();
		await this.deviceMapper.restoreTransformersForExistingDevices(registeredDevices);
		this.transformersRestored = true;

		// Drain pending joined friendly names. The bridge fires a real
		// `device_joined` / `device_announce` event for new devices, then
		// republishes `bridge/devices` once the interview completes. Here we
		// look up each pending join in the now-populated registry and notify
		// subscribers — exactly once per truly new device. Already-paired
		// devices in this republish are NOT notified, which avoids the
		// initial-fetch problem.
		if (this.pendingJoinedFriendlyNames.size > 0) {
			const registryByName = new Map(registeredDevices.map((d) => [d.friendlyName, d]));
			for (const friendlyName of [...this.pendingJoinedFriendlyNames]) {
				const registered = registryByName.get(friendlyName);
				if (registered) {
					this.pendingJoinedFriendlyNames.delete(friendlyName);
					this.notifyDeviceJoined(registered);
				}
				// If not yet in registry (interview still pending), leave it in
				// the set; the next `bridge/devices` republish will pick it up.
			}
		}

		// Process cached state for all existing devices
		const existingDevices = await this.devicesService.findAll<Zigbee2mqttDeviceEntity>(DEVICES_ZIGBEE2MQTT_TYPE);
		for (const device of existingDevices) {
			const cachedState = this.activeAdapter.getCachedState(device.identifier);
			if (Object.keys(cachedState).length > 0) {
				try {
					await this.deviceMapper.updateDeviceState(device.identifier, cachedState);
				} catch (error) {
					this.logger.debug(`Failed to process cached state for ${device.identifier}: ${error}`);
				}
			}
		}

		// Skip device sync if neither auto-add nor sync is needed
		if (!shouldAddNew && !shouldSyncExisting) {
			return;
		}

		// Prevent concurrent sync operations
		if (this.isSyncing) {
			return;
		}

		await this.syncDevices(devices, shouldAddNew);
	}

	/**
	 * Sync devices from Z2M to Smart Panel
	 */
	private async syncDevices(devices: Z2mDevice[], createIfNotExists: boolean): Promise<void> {
		this.isSyncing = true;

		try {
			for (const z2mDevice of devices) {
				try {
					await this.deviceMapper.mapDevice(z2mDevice, createIfNotExists);
				} catch (error) {
					this.logger.error(`Failed to map device ${z2mDevice.friendly_name}`, {
						message: error instanceof Error ? error.message : String(error),
					});
				}
			}

			this.deviceSyncPending = false;
		} finally {
			this.isSyncing = false;
		}
	}

	/**
	 * Handle device state changed event
	 */
	private async handleDeviceStateChanged(friendlyName: string, state: Record<string, unknown>): Promise<void> {
		if (!this.transformersRestored) {
			this.logger.debug(`Skipping state update for ${friendlyName} - transformers not yet restored`);
			return;
		}

		this.logger.debug(`Device state changed: ${friendlyName}, state keys: ${Object.keys(state).join(', ')}`);

		try {
			await this.deviceMapper.updateDeviceState(friendlyName, state);
		} catch (error) {
			this.logger.error(`Failed to update device state: ${friendlyName}`, {
				message: error instanceof Error ? error.message : String(error),
			});
		}
	}

	/**
	 * Handle device availability changed event
	 */
	private async handleDeviceAvailabilityChanged(friendlyName: string, available: boolean): Promise<void> {
		this.logger.debug(`Device availability changed: ${friendlyName} -> ${available}`);

		try {
			await this.deviceMapper.setDeviceAvailability(friendlyName, available);
		} catch (error) {
			this.logger.error(`Failed to update device availability: ${friendlyName}`, {
				message: error instanceof Error ? error.message : String(error),
			});
		}
	}

	/**
	 * Handle device joined event.
	 *
	 * The bridge sends this for actual `device_joined` / `device_announce`
	 * events — the authoritative signal that a NEW device is pairing. The
	 * bridge then republishes `bridge/devices` once the interview completes
	 * (which is what populates the registry). We record the friendly name
	 * here and let `handleDevicesReceived` drain the pending set once the
	 * full `Z2mRegisteredDevice` is available.
	 */
	private handleDeviceJoined(_ieeeAddress: string, friendlyName: string): void {
		this.logger.log(`Device joined: ${friendlyName}`);
		this.pendingJoinedFriendlyNames.add(friendlyName);
	}

	/**
	 * Handle device left event
	 */
	private async handleDeviceLeft(_ieeeAddress: string, friendlyName: string): Promise<void> {
		this.logger.log(`Device left: ${friendlyName}`);

		try {
			await this.deviceMapper.setDeviceAvailability(friendlyName, false);
		} catch (error) {
			this.logger.error(`Failed to handle device left: ${friendlyName}`, {
				message: error instanceof Error ? error.message : String(error),
			});
		}
	}

	/**
	 * Get plugin configuration
	 */
	private get config(): Zigbee2mqttConfigModel {
		if (!this.pluginConfig) {
			this.pluginConfig = this.configService.getPluginConfig<Zigbee2mqttConfigModel>(DEVICES_ZIGBEE2MQTT_PLUGIN_NAME);
		}

		return this.pluginConfig;
	}

	/**
	 * Wait until service reaches specified state(s)
	 */
	private async waitUntil(...states: ServiceState[]): Promise<void> {
		const maxWait = 10000;
		const interval = 100;
		let elapsed = 0;

		while (!states.includes(this.state) && elapsed < maxWait) {
			await new Promise((resolve) => setTimeout(resolve, interval));
			elapsed += interval;
		}

		if (!states.includes(this.state)) {
			throw new Error(`Timeout waiting for state ${states.join(' or ')}, current state: ${this.state}`);
		}
	}
}

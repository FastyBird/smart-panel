import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { ConfigService } from '../../../modules/config/services/config.service';
import { ConnectionState } from '../../../modules/devices/devices.constants';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import {
	ConfigChangeResult,
	IManagedPluginService,
	ServiceState,
} from '../../../modules/extensions/services/managed-plugin-service.interface';
import { PluginServiceManagerService } from '../../../modules/extensions/services/plugin-service-manager.service';
import { DEVICES_ZIGBEE2MQTT_PLUGIN_NAME, DEVICES_ZIGBEE2MQTT_TYPE } from '../devices-zigbee2mqtt.constants';
import { Zigbee2mqttDeviceEntity } from '../entities/devices-zigbee2mqtt.entity';
import {
	Z2mAdapterEventType,
	Z2mBridgeOfflineEvent,
	Z2mBridgeOnlineEvent,
	Z2mDeviceAvailabilityChangedEvent,
	Z2mDeviceJoinedEvent,
	Z2mDeviceLeftEvent,
	Z2mDeviceStateChangedEvent,
	Z2mDevicesReceivedEvent,
	Z2mMqttConfig,
} from '../interfaces/zigbee2mqtt.interface';
import { Zigbee2mqttConfigModel } from '../models/config.model';

import { Z2mDeviceMapperService } from './device-mapper.service';
import { Z2mMqttClientAdapterService } from './mqtt-client-adapter.service';

/**
 * Main Zigbee2MQTT Service
 *
 * Manages the lifecycle of Zigbee2MQTT integration, MQTT connection,
 * device synchronization, and event handling.
 */
@Injectable()
export class Zigbee2mqttService implements IManagedPluginService {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_ZIGBEE2MQTT_PLUGIN_NAME,
		'Zigbee2mqttService',
	);

	readonly pluginName = DEVICES_ZIGBEE2MQTT_PLUGIN_NAME;
	readonly serviceId = 'connector';

	private pluginConfig: Zigbee2mqttConfigModel | null = null;
	private state: ServiceState = 'stopped';
	private startStopLock: Promise<void> = Promise.resolve();
	private deviceSyncPending = false;

	constructor(
		private readonly configService: ConfigService,
		private readonly mqttAdapter: Z2mMqttClientAdapterService,
		private readonly deviceMapper: Z2mDeviceMapperService,
		private readonly devicesService: DevicesService,
		private readonly deviceConnectivityService: DeviceConnectivityService,
		@Inject(forwardRef(() => PluginServiceManagerService))
		private readonly pluginServiceManager: PluginServiceManagerService,
	) {}

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
					await this.initialize();
					await this.doStart();
					return;
				case 'stopped':
				case 'error':
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
	 * Get current service state.
	 */
	getState(): ServiceState {
		return this.state;
	}

	/**
	 * Handle configuration changes.
	 */
	onConfigChanged(): Promise<ConfigChangeResult> {
		this.pluginConfig = null;

		if (this.state === 'started') {
			this.logger.log('Config changed, restart required');
			return Promise.resolve({ restartRequired: true });
		}

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
		return this.mqttAdapter.isBridgeOnline();
	}

	/**
	 * Get all registered Z2M devices
	 */
	getRegisteredDevices() {
		return this.mqttAdapter.getRegisteredDevices();
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
			// Build MQTT config
			const mqttConfig = this.buildMqttConfig();

			// Connect to MQTT broker
			await this.mqttAdapter.connect(mqttConfig);

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

		this.logger.log('Stopping Zigbee2MQTT plugin service');

		try {
			// Disconnect from MQTT
			await this.mqttAdapter.disconnect();

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
	 * Handle bridge online event
	 */
	@OnEvent(Z2mAdapterEventType.BRIDGE_ONLINE)
	handleBridgeOnline(_event: Z2mBridgeOnlineEvent): void {
		this.logger.log('Bridge is online');

		// Sync devices if configured
		if (this.config.discovery.syncOnStartup && !this.deviceSyncPending) {
			this.deviceSyncPending = true;
		}
	}

	/**
	 * Handle bridge offline event
	 */
	@OnEvent(Z2mAdapterEventType.BRIDGE_OFFLINE)
	async handleBridgeOffline(_event: Z2mBridgeOfflineEvent): Promise<void> {
		this.logger.warn('Bridge is offline');

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
	@OnEvent(Z2mAdapterEventType.DEVICES_RECEIVED)
	async handleDevicesReceived(event: Z2mDevicesReceivedEvent): Promise<void> {
		this.logger.log(`Received ${event.devices.length} devices from bridge`);

		const shouldSyncExisting = this.deviceSyncPending;
		const shouldAddNew = this.config.discovery.autoAdd;

		// Skip if neither auto-add nor sync is needed
		if (!shouldAddNew && !shouldSyncExisting) {
			this.logger.debug('Auto-add disabled and no sync pending, skipping device mapping');
			return;
		}

		// Map each device
		// createIfNotExists: true if autoAdd is enabled, false if only syncing existing devices
		for (const z2mDevice of event.devices) {
			try {
				await this.deviceMapper.mapDevice(z2mDevice, shouldAddNew);
			} catch (error) {
				this.logger.error(`Failed to map device ${z2mDevice.friendly_name}`, {
					message: error instanceof Error ? error.message : String(error),
				});
			}
		}

		this.deviceSyncPending = false;
	}

	/**
	 * Handle device state changed event
	 */
	@OnEvent(Z2mAdapterEventType.DEVICE_STATE_CHANGED)
	async handleDeviceStateChanged(event: Z2mDeviceStateChangedEvent): Promise<void> {
		this.logger.debug(
			`Device state changed: ${event.friendlyName}, state keys: ${Object.keys(event.state).join(', ')}`,
		);

		try {
			await this.deviceMapper.updateDeviceState(event.friendlyName, event.state);
		} catch (error) {
			this.logger.error(`Failed to update device state: ${event.friendlyName}`, {
				message: error instanceof Error ? error.message : String(error),
			});
		}
	}

	/**
	 * Handle device availability changed event
	 */
	@OnEvent(Z2mAdapterEventType.DEVICE_AVAILABILITY_CHANGED)
	async handleDeviceAvailabilityChanged(event: Z2mDeviceAvailabilityChangedEvent): Promise<void> {
		this.logger.debug(`Device availability changed: ${event.friendlyName} -> ${event.available}`);

		try {
			await this.deviceMapper.setDeviceAvailability(event.friendlyName, event.available);
		} catch (error) {
			this.logger.error(`Failed to update device availability: ${event.friendlyName}`, {
				message: error instanceof Error ? error.message : String(error),
			});
		}
	}

	/**
	 * Handle device joined event
	 */
	@OnEvent(Z2mAdapterEventType.DEVICE_JOINED)
	handleDeviceJoined(event: Z2mDeviceJoinedEvent): void {
		this.logger.log(`Device joined: ${event.friendlyName}`);

		// Device will be mapped when the full device list is received
	}

	/**
	 * Handle device left event
	 */
	@OnEvent(Z2mAdapterEventType.DEVICE_LEFT)
	async handleDeviceLeft(event: Z2mDeviceLeftEvent): Promise<void> {
		this.logger.log(`Device left: ${event.friendlyName}`);

		// Mark device as disconnected
		try {
			await this.deviceMapper.setDeviceAvailability(event.friendlyName, false);
		} catch (error) {
			this.logger.error(`Failed to handle device left: ${event.friendlyName}`, {
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
	 * Execute function with lock
	 */
	private async withLock<T>(fn: () => Promise<T>): Promise<T> {
		const previousLock = this.startStopLock;

		let releaseLock: () => void;

		this.startStopLock = new Promise((resolve) => {
			releaseLock = resolve;
		});

		try {
			await previousLock;
			return await fn();
		} finally {
			releaseLock();
		}
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

import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';

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
import { DEVICES_WLED_PLUGIN_NAME, DEVICES_WLED_TYPE } from '../devices-wled.constants';
import { WledDeviceEntity } from '../entities/devices-wled.entity';
import {
	WledAdapterEventType,
	WledDeviceConnectedEvent,
	WledDeviceDisconnectedEvent,
	WledDeviceErrorEvent,
	WledDeviceStateChangedEvent,
	WledMdnsDiscoveredDevice,
	WledMdnsEventType,
} from '../interfaces/wled.interface';
import { WledConfigModel } from '../models/config.model';

import { WledDeviceMapperService } from './device-mapper.service';
import { WledClientAdapterService } from './wled-client-adapter.service';
import { WledMdnsDiscovererService } from './wled-mdns-discoverer.service';

/**
 * Main WLED Service
 *
 * Manages the lifecycle of WLED device connections, state synchronization,
 * and event handling. Implements IManagedPluginService for centralized
 * lifecycle management by PluginServiceManagerService.
 */
@Injectable()
export class WledService implements IManagedPluginService {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(DEVICES_WLED_PLUGIN_NAME, 'WledService');

	readonly pluginName = DEVICES_WLED_PLUGIN_NAME;
	readonly serviceId = 'connector';

	private pluginConfig: WledConfigModel | null = null;
	private state: ServiceState = 'stopped';
	private startStopLock: Promise<void> = Promise.resolve();
	private pollingInterval: NodeJS.Timeout | null = null;

	constructor(
		private readonly configService: ConfigService,
		private readonly wledAdapter: WledClientAdapterService,
		private readonly deviceMapper: WledDeviceMapperService,
		private readonly devicesService: DevicesService,
		private readonly mdnsDiscoverer: WledMdnsDiscovererService,
		private readonly deviceConnectivityService: DeviceConnectivityService,
		@Inject(forwardRef(() => PluginServiceManagerService))
		private readonly pluginServiceManager: PluginServiceManagerService,
	) {}

	/**
	 * Start the service.
	 * Called by PluginServiceManagerService when the plugin is enabled.
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
	 * Stop the service gracefully.
	 * Called by PluginServiceManagerService when the plugin is disabled or app shuts down.
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
					this.doStop();
					return;
				case 'error':
					this.doStop();
					return;
			}
		});
	}

	/**
	 * Get the current service state.
	 */
	getState(): ServiceState {
		return this.state;
	}

	/**
	 * Handle configuration changes.
	 * Called by PluginServiceManagerService when config updates occur.
	 */
	onConfigChanged(): Promise<ConfigChangeResult> {
		// Check if config values actually changed for THIS plugin
		if (this.state === 'started' && this.pluginConfig) {
			const oldConfig = this.pluginConfig;
			const newConfig = this.configService.getPluginConfig<WledConfigModel>(DEVICES_WLED_PLUGIN_NAME);

			// Compare relevant settings that would require restart
			const configChanged =
				oldConfig.polling.interval !== newConfig.polling.interval ||
				oldConfig.websocket.enabled !== newConfig.websocket.enabled ||
				oldConfig.websocket.reconnectInterval !== newConfig.websocket.reconnectInterval ||
				oldConfig.mdns.enabled !== newConfig.mdns.enabled ||
				oldConfig.mdns.interface !== newConfig.mdns.interface ||
				oldConfig.mdns.autoAdd !== newConfig.mdns.autoAdd ||
				oldConfig.timeouts.connectionTimeout !== newConfig.timeouts.connectionTimeout ||
				oldConfig.timeouts.commandDebounce !== newConfig.timeouts.commandDebounce;

			if (configChanged) {
				this.logger.log('Config changed, restart required');
				return Promise.resolve({ restartRequired: true });
			}

			// Config didn't change for this plugin, no restart needed
			this.logger.debug('Config event received but no relevant changes for this plugin');
			return Promise.resolve({ restartRequired: false });
		}

		// Clear config only if not running (no handlers active)
		this.pluginConfig = null;

		return Promise.resolve({ restartRequired: false });
	}

	/**
	 * Restart the service through the PluginServiceManagerService.
	 */
	async restart(): Promise<void> {
		const success = await this.pluginServiceManager.restartService(this.pluginName, this.serviceId);

		if (!success) {
			this.logger.debug('Restart skipped (plugin may be disabled)');
		}
	}

	/**
	 * Initialize device states before starting
	 */
	private async initialize(): Promise<void> {
		const devices = await this.devicesService.findAll<WledDeviceEntity>(DEVICES_WLED_TYPE);

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

		this.logger.log('Starting WLED plugin service');

		try {
			// Configure WebSocket
			this.wledAdapter.configureWebSocket(this.config.websocket.enabled, this.config.websocket.reconnectInterval);

			// Connect to enabled WLED devices from database
			await this.connectToDatabaseDevices();

			// Start mDNS discovery if enabled
			this.startMdnsDiscovery();

			// Start state polling
			this.startPolling();

			this.logger.log('WLED plugin service started successfully');
			this.state = 'started';
		} catch (error) {
			this.logger.error('Failed to start WLED plugin service', {
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
	private doStop(): void {
		this.state = 'stopping';

		this.logger.log('Stopping WLED plugin service');

		try {
			// Stop polling
			this.stopPolling();

			// Stop mDNS discovery
			this.mdnsDiscoverer.stop();

			// Disconnect all devices
			this.wledAdapter.disconnectAll();

			this.logger.log('WLED plugin service stopped');
			this.state = 'stopped';
		} catch (error) {
			this.logger.error('Failed to stop WLED plugin service', {
				message: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
			});

			this.state = 'stopped';
		}
	}

	/**
	 * Connect to all enabled WLED devices from database
	 */
	private async connectToDatabaseDevices(): Promise<void> {
		const devices = await this.devicesService.findAll<WledDeviceEntity>(DEVICES_WLED_TYPE);
		const enabledDevices = devices.filter((d) => d.enabled && d.hostname);

		if (enabledDevices.length === 0) {
			this.logger.log('No enabled WLED devices found in database');
			return;
		}

		this.logger.log(`Connecting to ${enabledDevices.length} enabled WLED device(s)`);

		for (const device of enabledDevices) {
			await this.connectToDevice(device);
		}
	}

	/**
	 * Connect to a single WLED device
	 */
	private async connectToDevice(device: WledDeviceEntity): Promise<void> {
		if (!device.hostname || !device.identifier) {
			this.logger.warn(`Device ${device.id} missing hostname or identifier, skipping`);
			return;
		}

		try {
			this.logger.debug(`Connecting to WLED device at ${device.hostname}`);

			await this.wledAdapter.connect(device.hostname, device.identifier, this.config.timeouts.connectionTimeout);

			// Get the device context and update state
			const registeredDevice = this.wledAdapter.getDevice(device.hostname);

			if (registeredDevice?.context) {
				await this.deviceMapper.updateDeviceState(device.identifier, registeredDevice.context.state);
			}
		} catch (error) {
			this.logger.error(`Failed to connect to WLED device at ${device.hostname}`, {
				message: error instanceof Error ? error.message : String(error),
			});
		}
	}

	/**
	 * Handle device connected event
	 */
	@OnEvent(WledAdapterEventType.DEVICE_CONNECTED)
	async handleDeviceConnected(event: WledDeviceConnectedEvent): Promise<void> {
		this.logger.log(`Device connected: ${event.host} (${event.info.name})`);

		const device = this.wledAdapter.getDevice(event.host);

		if (device) {
			await this.deviceMapper.setDeviceConnectionState(device.identifier, ConnectionState.CONNECTED);
		}
	}

	/**
	 * Handle device disconnected event
	 */
	@OnEvent(WledAdapterEventType.DEVICE_DISCONNECTED)
	async handleDeviceDisconnected(event: WledDeviceDisconnectedEvent): Promise<void> {
		this.logger.log(`Device disconnected: ${event.host} (${event.reason || 'unknown reason'})`);

		await this.deviceMapper.setDeviceConnectionState(event.identifier, ConnectionState.DISCONNECTED);
	}

	/**
	 * Handle device state changed event
	 */
	@OnEvent(WledAdapterEventType.DEVICE_STATE_CHANGED)
	async handleDeviceStateChanged(event: WledDeviceStateChangedEvent): Promise<void> {
		this.logger.debug(`Device state changed: ${event.host}`);

		const device = this.wledAdapter.getDevice(event.host);

		if (device) {
			await this.deviceMapper.updateDeviceState(device.identifier, event.state);
		}
	}

	/**
	 * Handle device error event
	 */
	@OnEvent(WledAdapterEventType.DEVICE_ERROR)
	handleDeviceError(event: WledDeviceErrorEvent): void {
		this.logger.error(`Device error: ${event.host}`, {
			message: event.error.message,
		});
	}

	/**
	 * Start state polling
	 */
	private startPolling(): void {
		if (this.pollingInterval) {
			clearInterval(this.pollingInterval);
		}

		const interval = this.config.polling.interval;

		this.logger.debug(`Starting state polling with interval: ${interval}ms`);

		this.pollingInterval = setInterval(() => {
			void this.pollDeviceStates();
		}, interval);
	}

	/**
	 * Stop state polling
	 */
	private stopPolling(): void {
		if (this.pollingInterval) {
			clearInterval(this.pollingInterval);
			this.pollingInterval = null;
		}
	}

	/**
	 * Poll state from all connected devices
	 */
	private async pollDeviceStates(): Promise<void> {
		if (this.state !== 'started') {
			return;
		}

		const devices = this.wledAdapter.getRegisteredDevices();

		for (const device of devices) {
			if (!device.enabled || !device.connected) {
				continue;
			}

			try {
				await this.wledAdapter.refreshState(device.host, this.config.timeouts.connectionTimeout);
			} catch (error) {
				this.logger.warn(`Failed to poll state from device ${device.host}`, {
					message: error instanceof Error ? error.message : String(error),
				});
			}
		}
	}

	/**
	 * Periodic state refresh (every 5 minutes as a backup to polling)
	 */
	@Cron(CronExpression.EVERY_5_MINUTES)
	private async periodicStateRefresh(): Promise<void> {
		if (this.state !== 'started') {
			return;
		}

		this.logger.debug('Running periodic state refresh');

		await this.pollDeviceStates();
	}

	/**
	 * Start mDNS discovery if enabled
	 */
	private startMdnsDiscovery(): void {
		if (!this.config.mdns.enabled) {
			this.logger.debug('mDNS discovery is disabled');
			return;
		}

		try {
			this.mdnsDiscoverer.start(this.config.mdns.interface ?? undefined);
			this.logger.log('mDNS discovery started');
		} catch (error) {
			this.logger.error('Failed to start mDNS discovery', {
				message: error instanceof Error ? error.message : String(error),
			});
		}
	}

	/**
	 * Handle mDNS device discovered event
	 */
	@OnEvent(WledMdnsEventType.DEVICE_DISCOVERED)
	async handleMdnsDeviceDiscovered(device: WledMdnsDiscoveredDevice): Promise<void> {
		this.logger.log(`mDNS discovered device: ${device.name} at ${device.host}`);

		// Check if we already have this device configured by hostname
		const devices = await this.devicesService.findAll<WledDeviceEntity>(DEVICES_WLED_TYPE);
		const existingDevice = devices.find((d) => d.hostname === device.host);

		if (existingDevice) {
			this.logger.debug(`Device at ${device.host} already exists in database`);

			// If device is enabled and not connected, try to connect
			if (existingDevice.enabled && !this.wledAdapter.isConnected(device.host)) {
				this.logger.debug(`Connecting to existing device at ${device.host}`);
				await this.connectToDevice(existingDevice);
			}
			return;
		}

		// Auto-add device if enabled
		if (this.config.mdns.autoAdd) {
			this.logger.log(`Auto-adding discovered device: ${device.name} at ${device.host}`);
			await this.connectAndMapDiscoveredDevice(device);
		} else {
			this.logger.log(`Discovered device ${device.name} at ${device.host} - auto-add disabled, add manually`);
		}
	}

	/**
	 * Connect to a newly discovered device and map it to the database
	 */
	private async connectAndMapDiscoveredDevice(device: WledMdnsDiscoveredDevice): Promise<void> {
		const identifier = device.mac
			? `wled-${device.mac.replace(/:/g, '').toLowerCase()}`
			: `wled-${device.host.replace(/\./g, '-')}`;

		try {
			await this.wledAdapter.connect(device.host, identifier, this.config.timeouts.connectionTimeout);

			const registeredDevice = this.wledAdapter.getDevice(device.host);

			if (registeredDevice?.context) {
				await this.deviceMapper.mapDevice(device.host, registeredDevice.context, device.name, identifier);
			}
		} catch (error) {
			this.logger.error(`Failed to connect to discovered device at ${device.host}`, {
				message: error instanceof Error ? error.message : String(error),
			});
		}
	}

	/**
	 * Get discovered devices from mDNS
	 */
	getDiscoveredDevices(): WledMdnsDiscoveredDevice[] {
		return this.mdnsDiscoverer.getDiscoveredDevices();
	}

	/**
	 * Get discovered devices that haven't been added to the database yet
	 */
	async getUnadedDiscoveredDevices(): Promise<WledMdnsDiscoveredDevice[]> {
		const discoveredDevices = this.mdnsDiscoverer.getDiscoveredDevices();
		const databaseDevices = await this.devicesService.findAll<WledDeviceEntity>(DEVICES_WLED_TYPE);

		// Get hostnames of devices already in database
		const existingHostnames = new Set(databaseDevices.map((d) => d.hostname));

		// Filter out devices that are already in the database
		return discoveredDevices.filter((device) => !existingHostnames.has(device.host));
	}

	/**
	 * Get plugin configuration
	 */
	private get config(): WledConfigModel {
		if (!this.pluginConfig) {
			this.pluginConfig = this.configService.getPluginConfig<WledConfigModel>(DEVICES_WLED_PLUGIN_NAME);
		}

		return this.pluginConfig;
	}

	/**
	 * Execute function with lock to prevent concurrent start/stop operations
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
	 * Wait until service reaches one of the specified states
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

import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';

import { EventType as ConfigModuleEventType } from '../../../modules/config/config.constants';
import { ConfigService } from '../../../modules/config/services/config.service';
import { ConnectionState } from '../../../modules/devices/devices.constants';
import { DevicesService } from '../../../modules/devices/services/devices.service';
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
import { WledConfigModel, WledDeviceHostConfigModel } from '../models/config.model';

import { WledDeviceMapperService } from './device-mapper.service';
import { WledClientAdapterService } from './wled-client-adapter.service';
import { WledMdnsDiscovererService } from './wled-mdns-discoverer.service';

type ServiceState = 'stopped' | 'starting' | 'started' | 'stopping';

/**
 * Main WLED Service
 *
 * Manages the lifecycle of WLED device connections, state synchronization,
 * and event handling.
 */
@Injectable()
export class WledService {
	private readonly logger = new Logger(WledService.name);

	private pluginConfig: WledConfigModel | null = null;
	private state: ServiceState = 'stopped';
	private startTimer: NodeJS.Timeout | null = null;
	private desiredEnabled = false;
	private startStopLock: Promise<void> = Promise.resolve();
	private pollingInterval: NodeJS.Timeout | null = null;

	constructor(
		private readonly configService: ConfigService,
		private readonly wledAdapter: WledClientAdapterService,
		private readonly deviceMapper: WledDeviceMapperService,
		private readonly devicesService: DevicesService,
		private readonly mdnsDiscoverer: WledMdnsDiscovererService,
	) {}

	/**
	 * Request service start with optional delay
	 */
	async requestStart(delayMs = 1000): Promise<void> {
		this.desiredEnabled = this.config.enabled === true;

		if (!this.desiredEnabled) {
			if (this.startTimer) {
				clearTimeout(this.startTimer);
				this.startTimer = null;
			}

			await this.ensureStopped();
			return;
		}

		if (this.startTimer) {
			clearTimeout(this.startTimer);
		}

		this.startTimer = setTimeout(() => {
			this.startTimer = null;
			void this.ensureStarted();
		}, delayMs);
	}

	/**
	 * Stop the service
	 */
	async stop(): Promise<void> {
		if (this.startTimer) {
			clearTimeout(this.startTimer);
			this.startTimer = null;
		}

		await this.ensureStopped();
	}

	/**
	 * Restart the service
	 */
	async restart(): Promise<void> {
		await this.stop();
		await this.requestStart();
	}

	/**
	 * Ensure service is started
	 */
	private async ensureStarted(): Promise<void> {
		await this.withLock(async () => {
			if (this.config.enabled !== true) {
				return;
			}

			switch (this.state) {
				case 'started':
					return;
				case 'starting':
					return;
				case 'stopping':
					await this.waitUntil('stopped');
					break;
				case 'stopped':
					break;
			}

			this.state = 'starting';

			this.logger.log('[WLED][SERVICE] Starting WLED plugin service');

			try {
				// Configure WebSocket
				this.wledAdapter.configureWebSocket(
					this.config.websocket.enabled,
					this.config.websocket.reconnectInterval,
				);

				// Initialize all devices to UNKNOWN connection state
				await this.initializeDeviceStates();

				// Connect to configured WLED devices
				await this.connectToConfiguredDevices();

				// Start mDNS discovery if enabled
				await this.startMdnsDiscovery();

				// Start state polling
				this.startPolling();

				this.logger.log('[WLED][SERVICE] WLED plugin service started successfully');
				this.state = 'started';
			} catch (error) {
				this.logger.error('[WLED][SERVICE] Failed to start WLED plugin service', {
					message: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined,
				});

				this.state = 'stopped';
				throw error;
			}
		});
	}

	/**
	 * Ensure service is stopped
	 */
	private async ensureStopped(): Promise<void> {
		await this.withLock(async () => {
			switch (this.state) {
				case 'stopped':
					return;
				case 'stopping':
					await this.waitUntil('stopped');
					return;
				case 'starting':
					await this.waitUntil('started', 'stopped');
					break;
				case 'started':
					break;
			}

			if (this.state !== 'started') {
				return;
			}

			this.state = 'stopping';

			this.logger.log('[WLED][SERVICE] Stopping WLED plugin service');

			try {
				// Stop polling
				this.stopPolling();

				// Stop mDNS discovery
				this.mdnsDiscoverer.stop();

				// Disconnect all devices
				this.wledAdapter.disconnectAll();

				this.logger.log('[WLED][SERVICE] WLED plugin service stopped');
				this.state = 'stopped';
			} catch (error) {
				this.logger.error('[WLED][SERVICE] Failed to stop WLED plugin service', {
					message: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined,
				});

				this.state = 'stopped';
				throw error;
			}
		});
	}

	/**
	 * Connect to all configured WLED devices
	 */
	private async connectToConfiguredDevices(): Promise<void> {
		const deviceConfigs = this.config.devices || [];

		if (deviceConfigs.length === 0) {
			this.logger.log('[WLED][SERVICE] No WLED devices configured');
			return;
		}

		this.logger.log(`[WLED][SERVICE] Connecting to ${deviceConfigs.length} configured WLED device(s)`);

		for (const deviceConfig of deviceConfigs) {
			await this.connectToDevice(deviceConfig);
		}
	}

	/**
	 * Connect to a single WLED device
	 */
	private async connectToDevice(deviceConfig: WledDeviceHostConfigModel): Promise<void> {
		try {
			this.logger.debug(`[WLED][SERVICE] Connecting to WLED device at ${deviceConfig.host}`);

			// Generate identifier if not provided
			const identifier = deviceConfig.identifier || `wled-${deviceConfig.host.replace(/\./g, '-')}`;

			await this.wledAdapter.connect(deviceConfig.host, identifier, this.config.timeouts.connectionTimeout);

			// Get the device context and map it
			const device = this.wledAdapter.getDevice(deviceConfig.host);

			if (device?.context) {
				await this.deviceMapper.mapDevice(
					deviceConfig.host,
					device.context,
					deviceConfig.name,
					deviceConfig.identifier,
				);
			}
		} catch (error) {
			this.logger.error(`[WLED][SERVICE] Failed to connect to WLED device at ${deviceConfig.host}`, {
				message: error instanceof Error ? error.message : String(error),
			});
		}
	}

	/**
	 * Handle device connected event
	 */
	@OnEvent(WledAdapterEventType.DEVICE_CONNECTED)
	async handleDeviceConnected(event: WledDeviceConnectedEvent): Promise<void> {
		this.logger.log(`[WLED][SERVICE] Device connected: ${event.host} (${event.info.name})`);

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
		this.logger.log(`[WLED][SERVICE] Device disconnected: ${event.host} (${event.reason || 'unknown reason'})`);

		const device = this.wledAdapter.getDevice(event.host);

		if (device) {
			await this.deviceMapper.setDeviceConnectionState(device.identifier, ConnectionState.DISCONNECTED);
		}
	}

	/**
	 * Handle device state changed event
	 */
	@OnEvent(WledAdapterEventType.DEVICE_STATE_CHANGED)
	async handleDeviceStateChanged(event: WledDeviceStateChangedEvent): Promise<void> {
		this.logger.debug(`[WLED][SERVICE] Device state changed: ${event.host}`);

		const device = this.wledAdapter.getDevice(event.host);

		if (device) {
			await this.deviceMapper.updateDeviceState(device.identifier, event.state);
		}
	}

	/**
	 * Handle device error event
	 */
	@OnEvent(WledAdapterEventType.DEVICE_ERROR)
	async handleDeviceError(event: WledDeviceErrorEvent): Promise<void> {
		this.logger.error(`[WLED][SERVICE] Device error: ${event.host}`, {
			message: event.error.message,
		});
	}

	/**
	 * Handle config updated event
	 */
	@OnEvent(`${ConfigModuleEventType.CONFIG_UPDATED}.${DEVICES_WLED_PLUGIN_NAME}`)
	async handleConfigUpdated(): Promise<void> {
		this.logger.log('[WLED][SERVICE] Config updated, restarting service');
		this.pluginConfig = null; // Clear cached config
		await this.restart();
	}

	/**
	 * Start state polling
	 */
	private startPolling(): void {
		if (this.pollingInterval) {
			clearInterval(this.pollingInterval);
		}

		const interval = this.config.polling.interval;

		this.logger.debug(`[WLED][SERVICE] Starting state polling with interval: ${interval}ms`);

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
				this.logger.warn(`[WLED][SERVICE] Failed to poll state from device ${device.host}`, {
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

		this.logger.debug('[WLED][SERVICE] Running periodic state refresh');

		await this.pollDeviceStates();
	}

	/**
	 * Initialize all devices to UNKNOWN connection state on service start
	 */
	private async initializeDeviceStates(): Promise<void> {
		try {
			const devices = await this.devicesService.findAll<WledDeviceEntity>(DEVICES_WLED_TYPE);

			this.logger.log(`[WLED][SERVICE] Initializing connection state for ${devices.length} WLED devices`);

			for (const device of devices) {
				await this.deviceMapper.setDeviceConnectionState(device.identifier!, ConnectionState.UNKNOWN);
			}
		} catch (error) {
			this.logger.error('[WLED][SERVICE] Failed to initialize device states', {
				message: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
			});
		}
	}

	/**
	 * Start mDNS discovery if enabled
	 */
	private async startMdnsDiscovery(): Promise<void> {
		if (!this.config.mdns.enabled) {
			this.logger.debug('[WLED][SERVICE] mDNS discovery is disabled');
			return;
		}

		try {
			await this.mdnsDiscoverer.start(this.config.mdns.interface ?? undefined);
			this.logger.log('[WLED][SERVICE] mDNS discovery started');
		} catch (error) {
			this.logger.error('[WLED][SERVICE] Failed to start mDNS discovery', {
				message: error instanceof Error ? error.message : String(error),
			});
		}
	}

	/**
	 * Handle mDNS device discovered event
	 */
	@OnEvent(WledMdnsEventType.DEVICE_DISCOVERED)
	async handleMdnsDeviceDiscovered(device: WledMdnsDiscoveredDevice): Promise<void> {
		this.logger.log(`[WLED][SERVICE] mDNS discovered device: ${device.name} at ${device.host}`);

		// Check if we already have this device configured
		const existingDevice = await this.devicesService.findOneBy<WledDeviceEntity>(
			'hostname',
			device.host,
			DEVICES_WLED_TYPE,
		);

		if (existingDevice) {
			this.logger.debug(`[WLED][SERVICE] Device at ${device.host} already exists in database`);

			// If device is not connected, try to connect
			if (!this.wledAdapter.isConnected(device.host)) {
				this.logger.debug(`[WLED][SERVICE] Connecting to existing device at ${device.host}`);
				await this.connectToDevice({
					host: device.host,
					name: existingDevice.name,
					identifier: existingDevice.identifier,
				});
			}
			return;
		}

		// Auto-add device if enabled
		if (this.config.mdns.autoAdd) {
			this.logger.log(`[WLED][SERVICE] Auto-adding discovered device: ${device.name} at ${device.host}`);
			await this.connectToDevice({
				host: device.host,
				name: device.name,
				identifier: device.mac ? `wled-${device.mac.replace(/:/g, '').toLowerCase()}` : undefined,
			});
		} else {
			this.logger.log(
				`[WLED][SERVICE] Discovered device ${device.name} at ${device.host} - auto-add disabled, add manually`,
			);
		}
	}

	/**
	 * Get discovered devices from mDNS
	 */
	getDiscoveredDevices(): WledMdnsDiscoveredDevice[] {
		return this.mdnsDiscoverer.getDiscoveredDevices();
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
			releaseLock!();
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

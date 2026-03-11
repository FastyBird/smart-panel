import { Device, DeviceId, DeviceOptions, MdnsDeviceDiscoverer, Shellies } from 'shellies-ds9';

import { Injectable } from '@nestjs/common';

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
import { DelegatesManagerService } from '../delegates/delegates-manager.service';
import { DEVICES_SHELLY_NG_PLUGIN_NAME, DEVICES_SHELLY_NG_TYPE } from '../devices-shelly-ng.constants';
import { ShellyNgDeviceEntity } from '../entities/devices-shelly-ng.entity';
import { ShellyNgConfigModel } from '../models/config.model';

import { DatabaseDiscovererService } from './database-discoverer.service';
import { DeviceManagerService } from './device-manager.service';

/**
 * Shelly NG device discovery and synchronization service.
 *
 * This service is managed by PluginServiceManagerService and implements
 * the IManagedPluginService interface for centralized lifecycle management.
 */
@Injectable()
export class ShellyNgService implements IManagedPluginService {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_SHELLY_NG_PLUGIN_NAME,
		'ShellyService',
	);

	readonly pluginName = DEVICES_SHELLY_NG_PLUGIN_NAME;
	readonly serviceId = 'connector';

	private shellies?: Shellies;

	private pluginConfig: ShellyNgConfigModel | null = null;

	private state: ServiceState = 'stopped';
	private startStopLock: Promise<void> = Promise.resolve();
	private pendingRestart: Promise<void> | null = null;
	private restartTimer: NodeJS.Timeout | null = null;

	/**
	 * Global sequential queue for processing discovered devices.
	 * SQLite uses a single QueryRunner, so concurrent device provisioning
	 * causes query serialization issues. Processing one device at a time
	 * eliminates cross-device contention.
	 */
	private readonly discoveryQueue: Device[] = [];
	private processingDiscovery = false;
	private discoveryGeneration = 0;

	constructor(
		private readonly configService: ConfigService,
		private readonly databaseDiscovererService: DatabaseDiscovererService,
		private readonly delegatesRegistryService: DelegatesManagerService,
		private readonly deviceManagerService: DeviceManagerService,
		private readonly devicesService: DevicesService,
		private readonly deviceConnectivityService: DeviceConnectivityService,
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
					// Both stopped and error states can be started
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
					// If start failed, we're already stopped/error - just return
					if (this.getState() !== 'started') {
						return;
					}
				// fallthrough
				case 'started':
					this.doStop();
					return;
				case 'error':
					// Clean up and transition to stopped state
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
	 *
	 * For Shelly NG service, config changes (mDNS interface, WebSocket settings)
	 * require a full restart to apply. Returns restartRequired: true to signal
	 * the manager to perform the restart, ensuring proper runtime tracking.
	 */
	onConfigChanged(): Promise<ConfigChangeResult> {
		// Check if config values actually changed for THIS plugin
		if (this.state === 'started' && this.pluginConfig) {
			const oldConfig = this.pluginConfig;
			const newConfig = this.configService.getPluginConfig<ShellyNgConfigModel>(DEVICES_SHELLY_NG_PLUGIN_NAME);

			// Compare relevant settings that would require restart
			const mdnsChanged =
				oldConfig.mdns.enabled !== newConfig.mdns.enabled || oldConfig.mdns.interface !== newConfig.mdns.interface;

			const websocketsChanged =
				oldConfig.websockets.requestTimeout !== newConfig.websockets.requestTimeout ||
				oldConfig.websockets.pingInterval !== newConfig.websockets.pingInterval ||
				JSON.stringify(oldConfig.websockets.reconnectInterval) !==
					JSON.stringify(newConfig.websockets.reconnectInterval);

			if (mdnsChanged || websocketsChanged) {
				this.logger.log('Config changed, restart required');
				return Promise.resolve({ restartRequired: true });
			}

			// Config didn't change for this plugin, no restart needed
			return Promise.resolve({ restartRequired: false });
		}

		// Clear config only if not running (no handlers active)
		this.pluginConfig = null;

		return Promise.resolve({ restartRequired: false });
	}

	/**
	 * Restart the service through the PluginServiceManagerService.
	 * Used by entity subscribers when device configuration changes.
	 *
	 * Delegates to the manager to ensure runtime tracking (lastStartedAt,
	 * startCount, etc.) is properly updated.
	 */
	async restart(): Promise<void> {
		const success = await this.pluginServiceManager.restartService(this.pluginName, this.serviceId);

		if (!success) {
			this.logger.debug('Restart skipped (plugin may be disabled)');
		}
	}

	/**
	 * Debounced restart to avoid rapid stop/start loops that disconnect devices.
	 */
	async requestRestart(delayMs: number = 750): Promise<void> {
		if (this.pendingRestart !== null) {
			return this.pendingRestart;
		}

		this.pendingRestart = new Promise((resolve) => {
			if (this.restartTimer) {
				clearTimeout(this.restartTimer);
			}

			this.restartTimer = setTimeout(() => {
				this.restartTimer = null;

				void this.restart()
					.catch((): void => {
						// restart errors are logged inside restart(); swallow to resolve promise
					})
					.finally(() => {
						this.pendingRestart = null;
						resolve();
					});
			}, delayMs);
		});

		return this.pendingRestart;
	}

	private withLock<T>(fn: () => Promise<T>): Promise<T> {
		const run = async () => fn();
		this.startStopLock = this.startStopLock.then(run, run) as Promise<void>;
		return this.startStopLock as unknown as Promise<T>;
	}

	private async doStart(): Promise<void> {
		if (typeof this.shellies !== 'undefined') {
			this.state = 'started';

			return;
		}

		this.state = 'starting';

		this.logger.log('Starting Shelly NG plugin service');

		try {
			const devices = await this.devicesService.findAll<ShellyNgDeviceEntity>(DEVICES_SHELLY_NG_TYPE);

			const deviceOptions = new Map<DeviceId, Partial<DeviceOptions>>();

			for (const d of devices) {
				deviceOptions.set(d.identifier, {
					exclude: !d.enabled,
					password: d.password ?? undefined,
				});
			}

			this.shellies = new Shellies({
				websocket: {
					requestTimeout: this.config.websockets.requestTimeout,
					pingInterval: this.config.websockets.pingInterval,
					reconnectInterval: this.config.websockets.reconnectInterval,
					clientId: 'fb-smart-panel-shelly-ng-' + Math.round(Math.random() * 1000000),
				},
				autoLoadStatus: true,
				autoLoadConfig: true,
				deviceOptions,
			});

			this.shellies
				.on('add', this.handleAddedDevice)
				.on('remove', this.handleRemovedDevice)
				.on('exclude', this.handleExcludedDevice)
				.on('unknown', this.handleUnknownDevice)
				.on('error', this.handleError);

			this.shellies.registerDiscoverer(this.databaseDiscovererService);

			await this.databaseDiscovererService.run();

			if (this.config.mdns.enabled) {
				const discoverer = new MdnsDeviceDiscoverer({
					interface: this.config.mdns.interface ?? undefined,
				});

				this.shellies.registerDiscoverer(discoverer);

				discoverer.on('error', (error: Error): void => {
					this.logger.error('An error occurred in the mDNS device discovery service', {
						message: error.message,
						stack: error.stack,
					});
				});

				try {
					await discoverer.start();

					this.logger.log('mDNS device discovery started');
				} catch (error) {
					const err = error as Error;

					this.logger.error('Failed to start the mDNS device discovery service', {
						message: err.message,
						stack: err.stack,
					});
				}
			}

			this.state = 'started';
		} catch (e) {
			this.state = 'error';
			this.shellies = undefined;
			throw e;
		}
	}

	private doStop(): void {
		if (!this.shellies) {
			this.state = 'stopped';
			return;
		}

		this.state = 'stopping';

		if (!this.shellies) {
			return;
		}

		this.shellies
			.off('add', this.handleAddedDevice)
			.off('remove', this.handleRemovedDevice)
			.off('exclude', this.handleExcludedDevice)
			.off('unknown', this.handleUnknownDevice)
			.off('error', this.handleError);

		this.shellies.removeAllListeners();

		this.shellies.clear();

		this.shellies = undefined;

		this.discoveryQueue.length = 0;
		this.discoveryGeneration++;
		this.processingDiscovery = false;

		this.delegatesRegistryService.detach();

		this.state = 'stopped';
	}

	private get config(): ShellyNgConfigModel {
		if (!this.pluginConfig) {
			this.pluginConfig = this.configService.getPluginConfig<ShellyNgConfigModel>(DEVICES_SHELLY_NG_PLUGIN_NAME);
		}

		return this.pluginConfig;
	}

	/**
	 * Handles 'add' events from the shellies-ng library.
	 * Enqueues device for sequential processing to avoid SQLite contention.
	 */
	protected handleAddedDevice = (device: Device): void => {
		this.discoveryQueue.push(device);

		if (!this.processingDiscovery) {
			void this.processDiscoveryQueue();
		}
	};

	/**
	 * Drains the discovery queue one device at a time.
	 */
	private async processDiscoveryQueue(): Promise<void> {
		if (this.processingDiscovery) {
			return;
		}

		this.processingDiscovery = true;

		const generation = this.discoveryGeneration;

		try {
			while (this.discoveryQueue.length > 0 && this.discoveryGeneration === generation) {
				const device = this.discoveryQueue.shift();

				if (!device) {
					continue;
				}

				try {
					await this.processDiscoveredDevice(device);
				} catch (err) {
					const error = err as Error;

					this.logger.error(`Failed to process discovered device=${device.id}`, {
						resource: device.id,
						message: error.message,
						stack: error.stack,
					});
				}
			}
		} finally {
			// Only clear the flag if this is still the active generation.
			// If doStop() incremented the generation and reset the flag,
			// a stale finally must not overwrite the new processor's state.
			if (this.discoveryGeneration === generation) {
				this.processingDiscovery = false;
			}
		}
	}

	/**
	 * Processes a single discovered device: looks it up in the database,
	 * provisions channels/properties if needed, and attaches the delegate.
	 */
	private async processDiscoveredDevice(device: Device): Promise<void> {
		const sysDevice = await this.devicesService.findOneBy<ShellyNgDeviceEntity>(
			'identifier',
			device.id,
			DEVICES_SHELLY_NG_TYPE,
		);

		if (sysDevice !== null) {
			await this.deviceManagerService.createOrUpdate(sysDevice.id);
		}

		await this.delegatesRegistryService.insert(device);
	}

	/**
	 * Handles 'remove' events from the shellies-ng library
	 */
	protected handleRemovedDevice = (device: Device): void => {
		this.delegatesRegistryService.remove(device.id).catch((err: Error): void => {
			this.logger.error(`Failed to remove Shelly device delegate for device=${device.id}`, {
				resource: device.id,
				message: err.message,
				stack: err.stack,
			});
		});
	};

	/**
	 * Handles 'exclude' events from the shellies-ng library
	 */
	protected handleExcludedDevice = (deviceId: DeviceId): void => {
		this.delegatesRegistryService.remove(deviceId).catch((err: Error): void => {
			this.logger.error(`Failed to remove excluded Shelly device delegate for device=${deviceId}`, {
				resource: deviceId,
				message: err.message,
				stack: err.stack,
			});
		});
	};

	/**
	 * Handles 'unknown' events from the shellies-ng library
	 */
	protected handleUnknownDevice = (deviceId: DeviceId, model: string): void => {
		this.logger.log(`Discovered device=${deviceId} with unknown model=${model}`, { resource: deviceId });
	};

	/**
	 * Handles 'error' events from the shellies-ng library
	 */
	protected handleError = (deviceId: DeviceId, error: Error): void => {
		this.logger.error(`An error occurred for device=${deviceId}`, {
			resource: deviceId,
			message: error.message,
			stack: error.stack,
		});
	};

	private async initialize(): Promise<void> {
		const devices = await this.devicesService.findAll<ShellyNgDeviceEntity>(DEVICES_SHELLY_NG_TYPE);

		for (const device of devices) {
			await this.deviceConnectivityService.setConnectionState(device.id, {
				state: ConnectionState.UNKNOWN,
			});
		}
	}

	private async waitUntil(...states: ServiceState[]): Promise<void> {
		const maxWait = 10_000;
		const interval = 25;
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

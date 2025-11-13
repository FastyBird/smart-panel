import { Device, DeviceId, DeviceOptions, MdnsDeviceDiscoverer, Shellies } from 'shellies-ds9';

import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { EventType as ConfigModuleEventType } from '../../../modules/config/config.constants';
import { ConfigService } from '../../../modules/config/services/config.service';
import { ConnectionState } from '../../../modules/devices/devices.constants';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DelegatesManagerService } from '../delegates/delegates-manager.service';
import { DEVICES_SHELLY_NG_PLUGIN_NAME, DEVICES_SHELLY_NG_TYPE } from '../devices-shelly-ng.constants';
import { ShellyNgDeviceEntity } from '../entities/devices-shelly-ng.entity';
import { ShellyNgConfigModel } from '../models/config.model';

import { DatabaseDiscovererService } from './database-discoverer.service';
import { DeviceManagerService } from './device-manager.service';

type ServiceState = 'stopped' | 'starting' | 'started' | 'stopping';

@Injectable()
export class ShellyNgService {
	private readonly logger = new Logger(ShellyNgService.name);

	private shellies?: Shellies;

	private pluginConfig: ShellyNgConfigModel | null = null;

	private state: ServiceState = 'stopped';
	private startTimer: NodeJS.Timeout | null = null;

	// Optional: if config updates can flip enabled on/off quickly
	private desiredEnabled = false;
	private startStopLock: Promise<void> = Promise.resolve();

	constructor(
		private readonly configService: ConfigService,
		private readonly databaseDiscovererService: DatabaseDiscovererService,
		private readonly delegatesRegistryService: DelegatesManagerService,
		private readonly deviceManagerService: DeviceManagerService,
		private readonly devicesService: DevicesService,
		private readonly deviceConnectivityService: DeviceConnectivityService,
	) {}

	async requestStart(delayMs = 1000): Promise<void> {
		this.desiredEnabled = this.config.enabled === true;

		await this.initialize();

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

	async stop(): Promise<void> {
		if (this.startTimer) {
			clearTimeout(this.startTimer);

			this.startTimer = null;
		}

		await this.ensureStopped();
	}

	async restart(): Promise<void> {
		await this.stop();
		await this.requestStart();
	}

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
					if (this.config.enabled === true) {
						await this.doStart();
					}
					return;
				case 'stopped':
					await this.doStart();
					return;
			}
		});
	}

	private async ensureStopped(): Promise<void> {
		await this.withLock(async () => {
			switch (this.state) {
				case 'stopped':
					return;
				case 'stopping':
					return;
				case 'starting':
					await this.waitUntil('started');
				// fallthrough
				case 'started':
					this.doStop();
					return;
			}
		});
	}

	private withLock<T>(fn: () => Promise<T>): Promise<T> {
		const run = async () => fn();
		this.startStopLock = this.startStopLock.then(run, run) as Promise<void>;
		return this.startStopLock as unknown as Promise<T>;
	}

	private async doStart(): Promise<void> {
		if (typeof this.shellies !== 'undefined') {
			this.logger.debug('[SHELLY NG][SHELLY SERVICE] Shellies already started.');

			this.state = 'started';

			return;
		}

		if (this.config.enabled !== true) {
			this.logger.debug('[SHELLY NG][SHELLY SERVICE] Plugin disabled, skipping start.');

			return;
		}

		this.state = 'starting';

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
					this.logger.error('[SHELLY NG][SHELLY SERVICE] An error occurred in the mDNS device discovery service', {
						message: error.message,
						stack: error.stack,
					});
				});

				try {
					await discoverer.start();

					this.logger.log('[SHELLY NG][SHELLY SERVICE] mDNS device discovery started');
				} catch (error) {
					const err = error as Error;

					this.logger.error('[SHELLY NG][SHELLY SERVICE] Failed to start the mDNS device discovery service', {
						message: err.message,
						stack: err.stack,
					});
				}
			}

			this.state = 'started';
		} catch (e) {
			this.state = 'stopped';
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

		this.delegatesRegistryService.detach();

		this.state = 'stopped';
	}

	@OnEvent(ConfigModuleEventType.CONFIG_UPDATED)
	async handleConfigurationUpdatedEvent() {
		this.pluginConfig = null;

		await this.restart();
	}

	private get config(): ShellyNgConfigModel {
		if (!this.pluginConfig) {
			this.pluginConfig = this.configService.getPluginConfig<ShellyNgConfigModel>(DEVICES_SHELLY_NG_PLUGIN_NAME);
		}

		return this.pluginConfig;
	}

	/**
	 * Handles 'add' events from the shellies-ng library
	 */
	protected handleAddedDevice = (device: Device): void => {
		this.devicesService
			.findOneBy<ShellyNgDeviceEntity>('identifier', device.id, DEVICES_SHELLY_NG_TYPE)
			.then((sysDevice: ShellyNgDeviceEntity | null): void => {
				if (sysDevice !== null) {
					this.deviceManagerService
						.createOrUpdate(sysDevice.id)
						.then((): void => {
							this.logger.debug(`[SHELLY NG][SHELLY SERVICE] Device=${sysDevice.id} was updated in system`);

							this.delegatesRegistryService
								.insert(device)
								.then((): void => {
									this.logger.debug(
										`[SHELLY NG][SHELLY SERVICE] Device=${sysDevice.id} was added to delegates registry`,
									);
								})
								.catch((err: Error): void => {
									this.logger.error(
										`[SHELLY NG][SHELLY SERVICE] Failed to create Shelly device delegate for device=${sysDevice.id}`,
										{
											message: err.message,
											stack: err.stack,
										},
									);
								});
						})
						.catch((err: Error): void => {
							this.logger.error(
								`[SHELLY NG][SHELLY SERVICE] Failed to re-create Shelly device delegate for device=${device.id}`,
								{
									message: err.message,
									stack: err.stack,
								},
							);
						});
				} else {
					this.delegatesRegistryService
						.insert(device)
						.then((): void => {
							this.logger.debug(`[SHELLY NG][SHELLY SERVICE] New device=${device.id} was added to delegates registry`);
						})
						.catch((err: Error): void => {
							this.logger.error(
								`[SHELLY NG][SHELLY SERVICE] Failed to create new Shelly device delegate for device=${device.id}`,
								{
									message: err.message,
									stack: err.stack,
								},
							);
						});
				}
			})
			.catch((err: Error): void => {
				this.logger.error(`[SHELLY NG][SHELLY SERVICE] Failed to find Shelly device in database device=${device.id}`, {
					message: err.message,
					stack: err.stack,
				});
			});
	};

	/**
	 * Handles 'remove' events from the shellies-ng library
	 */
	protected handleRemovedDevice = (device: Device): void => {
		this.delegatesRegistryService.remove(device.id);

		this.logger.debug(`[SHELLY NG][SHELLY SERVICE] Device=${device.id} was removed from delegates registry`);
	};

	/**
	 * Handles 'exclude' events from the shellies-ng library
	 */
	protected handleExcludedDevice = (deviceId: DeviceId): void => {
		this.delegatesRegistryService.remove(deviceId);

		this.logger.debug(
			`[SHELLY NG][SHELLY SERVICE] Device=${deviceId} was set as excluded and removed from delegates registry`,
		);
	};

	/**
	 * Handles 'unknown' events from the shellies-ng library
	 */
	protected handleUnknownDevice = (deviceId: DeviceId, model: string): void => {
		this.logger.log(`[SHELLY NG][SHELLY SERVICE] Discovered device=${deviceId} with unknown model=${model}`);
	};

	/**
	 * Handles 'error' events from the shellies-ng library
	 */
	protected handleError = (deviceId: DeviceId, error: Error): void => {
		this.logger.error(`[SHELLY NG][SHELLY SERVICE] An error occurred for device=${deviceId}`, {
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

	private waitUntil(target: ServiceState, timeoutMs = 10_000): Promise<void> {
		return new Promise((resolve, reject) => {
			const start = Date.now();

			const check = () => {
				if (this.state === target) {
					return resolve();
				}

				if (Date.now() - start > timeoutMs) {
					return reject(new Error(`Timeout waiting for state "${target}"`));
				}

				setTimeout(check, 25);
			};
			check();
		});
	}
}

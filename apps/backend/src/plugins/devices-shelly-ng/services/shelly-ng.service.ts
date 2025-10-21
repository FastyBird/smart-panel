import { Device, DeviceId, DeviceOptions, MdnsDeviceDiscoverer, Shellies } from 'shellies-ds9';

import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { EventType as ConfigModuleEventType } from '../../../modules/config/config.constants';
import { ConfigService } from '../../../modules/config/services/config.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DelegatesManagerService } from '../delegates/delegates-manager.service';
import { ShellyDeviceDelegate } from '../delegates/shelly-device.delegate';
import { DEVICES_SHELLY_NG_PLUGIN_NAME, DEVICES_SHELLY_NG_TYPE } from '../devices-shelly-ng.constants';
import { DevicesShellyNgException } from '../devices-shelly-ng.exceptions';
import { ShellyNgDeviceEntity } from '../entities/devices-shelly-ng.entity';
import { ShellyNgConfigModel } from '../models/config.model';

import { DatabaseDiscovererService } from './database-discoverer.service';

@Injectable()
export class ShellyNgService {
	private readonly logger = new Logger(ShellyNgService.name);

	private shellies?: Shellies;

	private pluginConfig: ShellyNgConfigModel | null = null;

	constructor(
		private readonly configService: ConfigService,
		private readonly databaseDiscovererService: DatabaseDiscovererService,
		private readonly delegatesRegistryService: DelegatesManagerService,
		private readonly devicesService: DevicesService,
	) {}

	async start(): Promise<void> {
		if (typeof this.shellies !== 'undefined') {
			throw new DevicesShellyNgException('Shellies instance is already started');
		}

		if (this.config.enabled !== true) {
			this.logger.debug('[SHELLY NG][SHELLY SERVICE] Shelly Next-Generation plugin is disabled.');

			return;
		}

		const deviceOptions = new Map<DeviceId, Partial<DeviceOptions>>();

		for (const d of await this.devicesService.findAll<ShellyNgDeviceEntity>(DEVICES_SHELLY_NG_TYPE)) {
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
	}

	stop(): void {
		if (!this.shellies) {
			return;
		}

		this.shellies
			.off('add', this.handleAddedDevice)
			.off('remove', this.handleRemovedDevice)
			.off('exclude', this.handleExcludedDevice)
			.off('unknown', this.handleUnknownDevice)
			.off('error', this.handleError);

		this.shellies = undefined;

		this.delegatesRegistryService.detach();
	}

	async restart(): Promise<void> {
		this.stop();
		await this.start();
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
		this.delegatesRegistryService
			.insert(device)
			.then((delegate: ShellyDeviceDelegate): void => {
				this.logger.debug(`[SHELLY NG][SHELLY SERVICE] Device=${delegate.id} was added to delegates registry`);
			})
			.catch((err: Error): void => {
				this.logger.error(
					`[SHELLY NG][SHELLY SERVICE] Failed to create Shelly device delegate for device=${device.id}`,
					{
						message: err.message,
						stack: err.stack,
					},
				);
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
}

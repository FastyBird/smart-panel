import { instanceToPlain } from 'class-transformer';

import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { toInstance } from '../../../common/utils/transform.utils';
import { EventType as ConfigModuleEventType } from '../../../modules/config/config.constants';
import { ConfigService } from '../../../modules/config/services/config.service';
import { ConnectionState } from '../../../modules/devices/devices.constants';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DEVICES_SHELLY_V1_PLUGIN_NAME, DEVICES_SHELLY_V1_TYPE } from '../devices-shelly-v1.constants';
import { UpdateShellyV1ChannelPropertyDto } from '../dto/update-channel-property.dto';
import {
	ShellyV1ChannelEntity,
	ShellyV1ChannelPropertyEntity,
	ShellyV1DeviceEntity,
} from '../entities/devices-shelly-v1.entity';
import {
	NormalizedDeviceChangeEvent,
	NormalizedDeviceEvent,
	ShelliesAdapterEventType,
} from '../interfaces/shellies.interface';
import { ShellyV1ConfigModel } from '../models/config.model';

import { DeviceMapperService } from './device-mapper.service';
import { ShelliesAdapterService } from './shellies-adapter.service';

type ServiceState = 'stopped' | 'starting' | 'started' | 'stopping';

@Injectable()
export class ShellyV1Service {
	private readonly logger = new Logger(ShellyV1Service.name);

	private pluginConfig: ShellyV1ConfigModel | null = null;

	private state: ServiceState = 'stopped';
	private startTimer: NodeJS.Timeout | null = null;

	private desiredEnabled = false;
	private startStopLock: Promise<void> = Promise.resolve();

	constructor(
		private readonly configService: ConfigService,
		private readonly shelliesAdapter: ShelliesAdapterService,
		private readonly deviceMapper: DeviceMapperService,
		private readonly devicesService: DevicesService,
		private readonly channelsService: ChannelsService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly deviceConnectivityService: DeviceConnectivityService,
	) {}

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
					break;
				case 'stopped':
					break;
			}

			this.state = 'starting';

			this.logger.log('Starting Shelly V1 plugin service');

			try {
				// Initialize all devices to UNKNOWN connection state
				await this.initializeDeviceStates();

				// Start the shellies adapter for device discovery
				this.shelliesAdapter.start();

				this.logger.log('Shelly V1 plugin service started successfully');

				this.state = 'started';
			} catch (error) {
				this.logger.error('Failed to start Shelly V1 plugin service', error);

				this.state = 'stopped';

				throw error;
			}
		});
	}

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

			this.logger.log('Stopping Shelly V1 plugin service');

			try {
				// Stop the shellies adapter
				this.shelliesAdapter.stop();

				this.logger.log('Shelly V1 plugin service stopped');

				this.state = 'stopped';
			} catch (error) {
				this.logger.error('Failed to stop Shelly V1 plugin service', error);

				this.state = 'stopped';

				throw error;
			}
		});
	}

	/**
	 * Handle device discovered event from the shellies adapter
	 */
	@OnEvent(ShelliesAdapterEventType.DEVICE_DISCOVERED)
	async handleDeviceDiscovered(event: NormalizedDeviceEvent): Promise<void> {
		this.logger.log(`Device discovered: ${event.id} (${event.type}) at ${event.host}`);

		try {
			// Map and create the device with its channels and properties
			const device = await this.deviceMapper.mapDevice(event);

			this.logger.log(`Device mapped successfully: ${device.identifier} (${device.id})`);
		} catch (error) {
			this.logger.error(`Failed to map device ${event.id}:`, error);
		}
	}

	/**
	 * Handle device property change event from the shellies adapter
	 */
	@OnEvent(ShelliesAdapterEventType.DEVICE_CHANGED)
	async handleDeviceChanged(event: NormalizedDeviceChangeEvent): Promise<void> {
		this.logger.debug(`Device ${event.id} property changed: ${event.property} = ${JSON.stringify(event.newValue)}`);

		try {
			// Find the device
			const device = await this.devicesService.findOne<ShellyV1DeviceEntity>(event.id, DEVICES_SHELLY_V1_TYPE);

			if (!device) {
				this.logger.debug(`Device not found in database: ${event.id}, skipping property update`);

				return;
			}

			// Parse the property path (e.g., "relay_0.state", "light_0.brightness")
			const { channelIdentifier, propertyIdentifier } = this.parsePropertyPath(event.property);

			if (!channelIdentifier || !propertyIdentifier) {
				this.logger.debug(`Unable to parse property path: ${event.property}, skipping`);

				return;
			}

			// Find the channel
			const channel = await this.channelsService.findOne<ShellyV1ChannelEntity>(
				device.id,
				channelIdentifier,
				DEVICES_SHELLY_V1_TYPE,
			);

			if (!channel) {
				this.logger.debug(
					`Channel not found: ${channelIdentifier} for device ${device.identifier}, skipping property update`,
				);

				return;
			}

			// Find the property
			const property = await this.channelsPropertiesService.findOne<ShellyV1ChannelPropertyEntity>(
				channel.id,
				propertyIdentifier,
				DEVICES_SHELLY_V1_TYPE,
			);

			if (!property) {
				this.logger.debug(
					`Property not found: ${propertyIdentifier} for channel ${channel.identifier}, skipping property update`,
				);

				return;
			}

			// Update the property value
			await this.channelsPropertiesService.update<ShellyV1ChannelPropertyEntity, UpdateShellyV1ChannelPropertyDto>(
				property.id,
				toInstance(UpdateShellyV1ChannelPropertyDto, {
					...instanceToPlain(property),
					value: event.newValue,
				}),
			);

			this.logger.debug(
				`Updated property ${property.identifier} for channel ${channel.identifier} to ${JSON.stringify(event.newValue)}`,
			);
		} catch (error) {
			this.logger.error(`Failed to update property for device ${event.id}:`, error);
		}
	}

	/**
	 * Handle device offline event from the shellies adapter
	 */
	@OnEvent(ShelliesAdapterEventType.DEVICE_OFFLINE)
	async handleDeviceOffline(event: NormalizedDeviceEvent): Promise<void> {
		this.logger.debug(`Device went offline: ${event.id}`);

		try {
			// Find the device
			const device = await this.devicesService.findOne<ShellyV1DeviceEntity>(event.id, DEVICES_SHELLY_V1_TYPE);

			if (!device) {
				this.logger.debug(`Device not found in database: ${event.id}, skipping offline state update`);

				return;
			}

			// Update connection state to DISCONNECTED
			await this.deviceConnectivityService.setConnectionState(device.id, {
				state: ConnectionState.DISCONNECTED,
			});

			this.logger.debug(`Device ${device.identifier} marked as offline`);
		} catch (error) {
			this.logger.error(`Failed to mark device ${event.id} as offline:`, error);
		}
	}

	/**
	 * Handle device online event from the shellies adapter
	 */
	@OnEvent(ShelliesAdapterEventType.DEVICE_ONLINE)
	async handleDeviceOnline(event: NormalizedDeviceEvent): Promise<void> {
		this.logger.debug(`Device came online: ${event.id}`);

		try {
			// Find the device
			const device = await this.devicesService.findOne<ShellyV1DeviceEntity>(event.id, DEVICES_SHELLY_V1_TYPE);

			if (!device) {
				this.logger.debug(`Device not found in database: ${event.id}, skipping online state update`);

				return;
			}

			// Update connection state to CONNECTED
			await this.deviceConnectivityService.setConnectionState(device.id, {
				state: ConnectionState.CONNECTED,
			});

			this.logger.debug(`Device ${device.identifier} marked as online`);
		} catch (error) {
			this.logger.error(`Failed to mark device ${event.id} as online:`, error);
		}
	}

	/**
	 * Parse a property path from the shellies library into channel and property identifiers
	 * Examples:
	 * - "relay_0.state" -> { channelIdentifier: "relay_0", propertyIdentifier: "state" }
	 * - "light_0.brightness" -> { channelIdentifier: "light_0", propertyIdentifier: "brightness" }
	 */
	private parsePropertyPath(propertyPath: string): {
		channelIdentifier: string | null;
		propertyIdentifier: string | null;
	} {
		const parts = propertyPath.split('.');

		if (parts.length !== 2) {
			return { channelIdentifier: null, propertyIdentifier: null };
		}

		return {
			channelIdentifier: parts[0],
			propertyIdentifier: parts[1],
		};
	}

	/**
	 * Handle error event from the shellies adapter
	 */
	@OnEvent(ShelliesAdapterEventType.ERROR)
	handleAdapterError(error: Error): void {
		this.logger.error('Shellies adapter error', error);
	}

	@OnEvent(`${ConfigModuleEventType.CONFIG_UPDATED}.${DEVICES_SHELLY_V1_PLUGIN_NAME}`)
	async handleConfigUpdated(): Promise<void> {
		this.logger.log('Config updated, restarting service');

		await this.restart();
	}

	private get config(): ShellyV1ConfigModel {
		if (!this.pluginConfig) {
			this.pluginConfig = this.configService.getPluginConfig<ShellyV1ConfigModel>(DEVICES_SHELLY_V1_PLUGIN_NAME);
		}

		return this.pluginConfig;
	}

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

	/**
	 * Initialize all existing devices to UNKNOWN connection state on service start
	 */
	private async initializeDeviceStates(): Promise<void> {
		try {
			const devices = await this.devicesService.findAll<ShellyV1DeviceEntity>(DEVICES_SHELLY_V1_TYPE);

			this.logger.log(`Initializing connection state for ${devices.length} Shelly V1 devices`);

			for (const device of devices) {
				await this.deviceConnectivityService.setConnectionState(device.id, {
					state: ConnectionState.UNKNOWN,
				});
			}
		} catch (error) {
			this.logger.error('Failed to initialize device states', error);
		}
	}
}

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
import {
	DESCRIPTORS,
	DEVICES_SHELLY_V1_PLUGIN_NAME,
	DEVICES_SHELLY_V1_TYPE,
	PropertyBinding,
} from '../devices-shelly-v1.constants';
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

			this.logger.log('[SHELLY V1][SERVICE] Starting Shelly V1 plugin service');

			try {
				// Initialize all devices to UNKNOWN connection state
				await this.initializeDeviceStates();

				// Start the shellies adapter for device discovery
				this.shelliesAdapter.start();

				this.logger.log('[SHELLY V1][SERVICE] Shelly V1 plugin service started successfully');

				this.state = 'started';
			} catch (error) {
				this.logger.error('[SHELLY V1][SERVICE] Failed to start Shelly V1 plugin service', {
					message: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined,
				});

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

			this.logger.log('[SHELLY V1][SERVICE] Stopping Shelly V1 plugin service');

			try {
				// Stop the shellies adapter
				this.shelliesAdapter.stop();

				this.logger.log('[SHELLY V1][SERVICE] Shelly V1 plugin service stopped');

				this.state = 'stopped';
			} catch (error) {
				this.logger.error('[SHELLY V1][SERVICE] Failed to stop Shelly V1 plugin service', {
					message: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined,
				});

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
		this.logger.log(`[SHELLY V1][SERVICE] Device discovered: ${event.id} (${event.type}) at ${event.host}`);

		try {
			// Map and create the device with its channels and properties
			const device = await this.deviceMapper.mapDevice(event);

			this.logger.log(`[SHELLY V1][SERVICE] Device mapped successfully: ${device.identifier} (${device.id})`);
		} catch (error) {
			this.logger.error(`[SHELLY V1][SERVICE] Failed to map device ${event.id}:`, {
				message: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
			});
		}
	}

	/**
	 * Handle device property change event from the shellies adapter
	 */
	@OnEvent(ShelliesAdapterEventType.DEVICE_CHANGED)
	async handleDeviceChanged(event: NormalizedDeviceChangeEvent): Promise<void> {
		this.logger.debug(
			`[SHELLY V1][SERVICE] Device ${event.id} property changed: ${event.property} = ${JSON.stringify(event.newValue)}`,
		);

		try {
			// Find the device
			const device = await this.devicesService.findOneBy<ShellyV1DeviceEntity>(
				'identifier',
				event.id,
				DEVICES_SHELLY_V1_TYPE,
			);

			if (!device) {
				this.logger.debug(`[SHELLY V1][SERVICE] Device not found in database: ${event.id}, skipping property update`);

				return;
			}

			// Look up the property binding using the shelliesProperty from the event
			const binding = await this.findPropertyBinding(device, event.property);

			if (!binding) {
				this.logger.debug(
					`[SHELLY V1][SERVICE] No binding found for property: ${event.property} on device ${device.identifier}, skipping`,
				);

				return;
			}

			const channelIdentifier = binding.channelIdentifier;
			const propertyIdentifier = binding.propertyIdentifier;

			// Find the channel
			const channel = await this.channelsService.findOneBy<ShellyV1ChannelEntity>(
				'identifier',
				channelIdentifier,
				device.id,
				DEVICES_SHELLY_V1_TYPE,
			);

			if (!channel) {
				this.logger.debug(
					`Channel not found: ${channelIdentifier} for device ${device.identifier}, skipping property update`,
				);
				return;
			}

			// Find the property
			const property = await this.channelsPropertiesService.findOneBy<ShellyV1ChannelPropertyEntity>(
				'identifier',
				propertyIdentifier,
				channel.id,
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
				`[SHELLY V1][SERVICE] Updated property ${property.identifier} for channel ${channel.identifier} to ${JSON.stringify(event.newValue)}`,
			);
		} catch (error) {
			this.logger.error(`[SHELLY V1][SERVICE] Failed to update property for device ${event.id}:`, {
				message: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
			});
		}
	}

	/**
	 * Handle device offline event from the shellies adapter
	 */
	@OnEvent(ShelliesAdapterEventType.DEVICE_OFFLINE)
	async handleDeviceOffline(event: NormalizedDeviceEvent): Promise<void> {
		this.logger.debug(`[SHELLY V1][SERVICE] Device went offline: ${event.id}`);

		try {
			// Find the device
			const device = await this.devicesService.findOneBy<ShellyV1DeviceEntity>(
				'identifier',
				event.id,
				DEVICES_SHELLY_V1_TYPE,
			);

			if (!device) {
				this.logger.debug(
					`[SHELLY V1][SERVICE] Device not found in database: ${event.id}, skipping offline state update`,
				);

				return;
			}

			// Update connection state to DISCONNECTED
			await this.deviceConnectivityService.setConnectionState(device.id, {
				state: ConnectionState.DISCONNECTED,
			});

			this.logger.debug(`[SHELLY V1][SERVICE] Device ${device.identifier} marked as offline`);
		} catch (error) {
			this.logger.error(`[SHELLY V1][SERVICE] Failed to mark device ${event.id} as offline:`, {
				message: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
			});
		}
	}

	/**
	 * Handle device online event from the shellies adapter
	 */
	@OnEvent(ShelliesAdapterEventType.DEVICE_ONLINE)
	async handleDeviceOnline(event: NormalizedDeviceEvent): Promise<void> {
		this.logger.debug(`[SHELLY V1][SERVICE] Device came online: ${event.id}`);

		try {
			// Find the device
			const device = await this.devicesService.findOneBy<ShellyV1DeviceEntity>(
				'identifier',
				event.id,
				DEVICES_SHELLY_V1_TYPE,
			);

			if (!device) {
				this.logger.debug(
					`[SHELLY V1][SERVICE] Device not found in database: ${event.id}, skipping online state update`,
				);

				return;
			}

			// Update connection state to CONNECTED
			await this.deviceConnectivityService.setConnectionState(device.id, {
				state: ConnectionState.CONNECTED,
			});

			this.logger.debug(`[SHELLY V1][SERVICE] Device ${device.identifier} marked as online`);
		} catch (error) {
			this.logger.error(`[SHELLY V1][SERVICE] Failed to mark device ${event.id} as online:`, {
				message: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
			});
		}
	}

	/**
	 * Find the property binding for a given shelliesProperty
	 * This looks up the device descriptor and finds which channel/property
	 * the Shelly property maps to
	 */
	private async findPropertyBinding(device: ShellyV1DeviceEntity, shelliesProperty: string): Promise<PropertyBinding | null> {
		// Find the device descriptor
		const descriptor = await this.findDescriptor(device);

		if (!descriptor) {
			this.logger.warn(`[SHELLY V1][SERVICE] No descriptor found for device: ${device.identifier}`);

			return null;
		}

		// Get bindings based on device mode (if applicable)
		let bindings: PropertyBinding[] = [];

		if (descriptor.instance?.modeProperty && descriptor.modes) {
			// Device has mode-based configuration - need to get current mode from adapter
			// Use the model type from descriptor to get the device from adapter
			const deviceModel = descriptor.models[0]; // Use first model as the type
			const shellyDevice = this.shelliesAdapter.getDevice(deviceModel, device.identifier);

			if (!shellyDevice) {
				this.logger.warn(
					`[SHELLY V1][SERVICE] Device ${device.identifier} not found in adapter, cannot determine mode`,
				);

				return null;
			}

			const modeValue = shellyDevice[descriptor.instance.modeProperty];
			const modeProfile = descriptor.modes.find((mode) => mode.modeValue === modeValue);

			if (modeProfile) {
				bindings = modeProfile.bindings;
			} else {
				this.logger.warn(
					`[SHELLY V1][SERVICE] No mode profile found for mode value: ${modeValue} on device ${device.identifier}`,
				);

				return null;
			}
		} else if (descriptor.bindings) {
			// Device has static bindings
			bindings = descriptor.bindings;
		}

		// Find the binding that matches the shelliesProperty
		const binding = bindings.find((b) => b.shelliesProperty === shelliesProperty);

		if (!binding) {
			this.logger.debug(
				`[SHELLY V1][SERVICE] No binding found for shelliesProperty: ${shelliesProperty} on device ${device.identifier}`,
			);

			return null;
		}

		return binding;
	}

	/**
	 * Find the descriptor for a device entity by querying the model from device_information channel
	 */
	private async findDescriptor(device: ShellyV1DeviceEntity): Promise<(typeof DESCRIPTORS)[keyof typeof DESCRIPTORS] | null> {
		// Get the device_information channel
		const deviceInfoChannel = await this.channelsService.findOneBy<ShellyV1ChannelEntity>(
			'identifier',
			'device_information',
			device.id,
			DEVICES_SHELLY_V1_TYPE,
		);

		if (!deviceInfoChannel) {
			this.logger.warn(`[SHELLY V1][SERVICE] No device_information channel found for device: ${device.identifier}`);

			return null;
		}

		// Get the model property from device_information channel
		const modelProperty = await this.channelsPropertiesService.findOneBy<ShellyV1ChannelPropertyEntity>(
			'identifier',
			'model',
			deviceInfoChannel.id,
			DEVICES_SHELLY_V1_TYPE,
		);

		if (!modelProperty || !modelProperty.value) {
			this.logger.warn(`[SHELLY V1][SERVICE] No model property found for device: ${device.identifier}`);

			return null;
		}

		const deviceModel = String(modelProperty.value).toUpperCase();

		// Try to find by device model match
		for (const descriptor of Object.values(DESCRIPTORS)) {
			if (descriptor.models.some((model) => deviceModel.includes(model))) {
				return descriptor;
			}
		}

		// Fallback: try to match by partial name
		for (const [key, descriptor] of Object.entries(DESCRIPTORS)) {
			if (deviceModel.includes(key) || descriptor.name.toUpperCase().includes(deviceModel)) {
				return descriptor;
			}
		}

		this.logger.warn(`[SHELLY V1][SERVICE] No descriptor found for device model: ${deviceModel}`);

		return null;
	}

	/**
	 * Handle error event from the shellies adapter
	 */
	@OnEvent(ShelliesAdapterEventType.ERROR)
	handleAdapterError(error: Error): void {
		this.logger.error('[SHELLY V1][SERVICE] Shellies adapter error', {
			message: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
		});
	}

	@OnEvent(`${ConfigModuleEventType.CONFIG_UPDATED}.${DEVICES_SHELLY_V1_PLUGIN_NAME}`)
	async handleConfigUpdated(): Promise<void> {
		this.logger.log('[SHELLY V1][SERVICE] Config updated, restarting service');

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

			this.logger.log(`[SHELLY V1][SERVICE] Initializing connection state for ${devices.length} Shelly V1 devices`);

			for (const device of devices) {
				await this.deviceConnectivityService.setConnectionState(device.id, {
					state: ConnectionState.UNKNOWN,
				});
			}
		} catch (error) {
			this.logger.error('[SHELLY V1][SERVICE] Failed to initialize device states', {
				message: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
			});
		}
	}
}

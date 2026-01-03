import { instanceToPlain } from 'class-transformer';

import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import { ConfigService } from '../../../modules/config/services/config.service';
import { ConnectionState } from '../../../modules/devices/devices.constants';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import {
	ConfigChangeResult,
	IManagedPluginService,
	ServiceState,
} from '../../../modules/extensions/services/managed-plugin-service.interface';
import {
	DESCRIPTORS,
	DEVICES_SHELLY_V1_PLUGIN_NAME,
	DEVICES_SHELLY_V1_TYPE,
	PropertyBinding,
	SHELLY_AUTH_USERNAME,
	SHELLY_V1_CHANNEL_IDENTIFIERS,
	SHELLY_V1_DEVICE_INFO_PROPERTY_IDENTIFIERS,
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
import { ShellyV1HttpClientService } from './shelly-v1-http-client.service';

/**
 * Shelly V1 device discovery and synchronization service.
 *
 * This service is managed by PluginServiceManagerService and implements
 * the IManagedPluginService interface for centralized lifecycle management.
 *
 * The service handles:
 * - Device discovery via mDNS/CoAP
 * - Device state synchronization
 * - Property change handling
 * - Periodic device information updates
 */
@Injectable()
export class ShellyV1Service implements IManagedPluginService {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_SHELLY_V1_PLUGIN_NAME,
		'ShellyV1Service',
	);

	readonly pluginName = DEVICES_SHELLY_V1_PLUGIN_NAME;
	readonly serviceId = 'connector';

	private pluginConfig: ShellyV1ConfigModel | null = null;

	private state: ServiceState = 'stopped';
	private startStopLock: Promise<void> = Promise.resolve();

	constructor(
		private readonly configService: ConfigService,
		private readonly shelliesAdapter: ShelliesAdapterService,
		private readonly deviceMapper: DeviceMapperService,
		private readonly devicesService: DevicesService,
		private readonly channelsService: ChannelsService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly deviceConnectivityService: DeviceConnectivityService,
		private readonly httpClient: ShellyV1HttpClientService,
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
					break;
				case 'stopped':
				case 'error':
					// Both stopped and error states can be started
					// Clear cached config to ensure fresh values on restart
					this.pluginConfig = null;
					break;
			}

			this.state = 'starting';

			this.logger.log('Starting Shelly V1 plugin service');

			try {
				// Initialize all devices to UNKNOWN connection state
				await this.initializeDeviceStates();

				// Start the shellies adapter for device discovery
				await this.shelliesAdapter.start();

				this.logger.log('Shelly V1 plugin service started successfully');

				this.state = 'started';
			} catch (error) {
				this.logger.error('Failed to start Shelly V1 plugin service', {
					message: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined,
				});

				this.state = 'error';

				throw error;
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
					await this.waitUntil('stopped');

					return;
				case 'starting':
					await this.waitUntil('started', 'stopped');
					break;
				case 'started':
				case 'error':
					// Both started and error states need cleanup
					break;
			}

			if (this.state !== 'started' && this.state !== 'error') {
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
				this.logger.error('Failed to stop Shelly V1 plugin service', {
					message: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined,
				});

				this.state = 'stopped';

				throw error;
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
	 * For Shelly V1 service, config changes (mDNS interface, polling settings)
	 * require a full restart to apply. Returns restartRequired: true to signal
	 * the manager to perform the restart, ensuring proper runtime tracking.
	 */
	onConfigChanged(): Promise<ConfigChangeResult> {
		// Check if config values actually changed for THIS plugin
		if (this.state === 'started' && this.pluginConfig) {
			const oldConfig = this.pluginConfig;
			const newConfig = this.configService.getPluginConfig<ShellyV1ConfigModel>(DEVICES_SHELLY_V1_PLUGIN_NAME);

			// Compare relevant settings that would require restart
			const configChanged =
				oldConfig.discovery.enabled !== newConfig.discovery.enabled ||
				oldConfig.discovery.interface !== newConfig.discovery.interface ||
				oldConfig.timeouts.requestTimeout !== newConfig.timeouts.requestTimeout ||
				oldConfig.timeouts.staleTimeout !== newConfig.timeouts.staleTimeout;

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
	 * Handle device discovered event from the shellies adapter
	 */
	@OnEvent(ShelliesAdapterEventType.DEVICE_DISCOVERED)
	async handleDeviceDiscovered(event: NormalizedDeviceEvent): Promise<void> {
		this.logger.log(`Device discovered: ${event.id} (${event.type}) at ${event.host}`);

		try {
			// Check if discovery is enabled
			if (!this.config.discovery.enabled) {
				// Discovery is disabled, only process devices that already exist in the database
				const existingDevice = await this.devicesService.findOneBy<ShellyV1DeviceEntity>(
					'identifier',
					event.id,
					DEVICES_SHELLY_V1_TYPE,
				);

				if (!existingDevice) {
					this.logger.debug(`Discovery is disabled, ignoring new device: ${event.id} (${event.type})`);

					return;
				}

				this.logger.debug(`Discovery is disabled, but device ${event.id} already exists, processing update`);
			}

			// Map and create the device with its channels and properties
			const device = await this.deviceMapper.mapDevice(event);

			this.logger.log(`Device mapped successfully: ${device.identifier} (${device.id})`, { resource: device.id });
		} catch (error) {
			this.logger.error(`Failed to map device ${event.id}:`, {
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
		// Property change event - too verbose for debug level (runs on every property update)

		try {
			// Check if a device is enabled in the registry
			const registeredDevice = this.shelliesAdapter.getRegisteredDevice(event.id);

			if (registeredDevice && !registeredDevice.enabled) {
				this.logger.debug(`Device ${event.id} is disabled, ignoring property change`);

				return;
			}

			// Find the device
			const device = await this.devicesService.findOneBy<ShellyV1DeviceEntity>(
				'identifier',
				event.id,
				DEVICES_SHELLY_V1_TYPE,
			);

			if (!device) {
				this.logger.debug(`Device not found in database: ${event.id}, skipping property update`);

				return;
			}

			// Look up the property binding using the shelliesProperty from the event
			const binding = await this.findPropertyBinding(device, event.property);

			if (!binding) {
				this.logger.debug(`No binding found for property: ${event.property} on device ${device.identifier}, skipping`, {
					resource: device.id,
				});

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
					{ resource: device.id },
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
					{ resource: device.id },
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
				{ resource: device.id },
			);
		} catch (error) {
			this.logger.error(`Failed to update property for device ${event.id}:`, {
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
		this.logger.debug(`Device went offline: ${event.id}`);

		try {
			// Check if a device is enabled in the registry
			const registeredDevice = this.shelliesAdapter.getRegisteredDevice(event.id);

			if (registeredDevice && !registeredDevice.enabled) {
				this.logger.debug(`Device ${event.id} is disabled, ignoring offline event`);

				return;
			}

			// Find the device
			const device = await this.devicesService.findOneBy<ShellyV1DeviceEntity>(
				'identifier',
				event.id,
				DEVICES_SHELLY_V1_TYPE,
			);

			if (!device) {
				this.logger.debug(`Device not found in database: ${event.id}, skipping offline state update`);

				return;
			}

			// Update connection state to DISCONNECTED
			await this.deviceConnectivityService.setConnectionState(device.id, {
				state: ConnectionState.DISCONNECTED,
			});

			this.logger.debug(`Device ${device.identifier} marked as offline`, { resource: device.id });
		} catch (error) {
			this.logger.error(`Failed to mark device ${event.id} as offline:`, {
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
		this.logger.debug(`Device came online: ${event.id}`);

		try {
			// Check if a device is enabled in the registry
			const registeredDevice = this.shelliesAdapter.getRegisteredDevice(event.id);

			if (registeredDevice && !registeredDevice.enabled) {
				this.logger.debug(`Device ${event.id} is disabled, ignoring online event`);

				return;
			}

			// Find the device
			const device = await this.devicesService.findOneBy<ShellyV1DeviceEntity>(
				'identifier',
				event.id,
				DEVICES_SHELLY_V1_TYPE,
			);

			if (!device) {
				this.logger.debug(`Device not found in database: ${event.id}, skipping online state update`);

				return;
			}

			// Update connection state to CONNECTED
			await this.deviceConnectivityService.setConnectionState(device.id, {
				state: ConnectionState.CONNECTED,
			});

			this.logger.debug(`Device ${device.identifier} marked as online`, { resource: device.id });
		} catch (error) {
			this.logger.error(`Failed to mark device ${event.id} as online:`, {
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
	private async findPropertyBinding(
		device: ShellyV1DeviceEntity,
		shelliesProperty: string,
	): Promise<PropertyBinding | null> {
		// Find the device descriptor
		const descriptor = await this.findDescriptor(device);

		if (!descriptor) {
			this.logger.warn(`No descriptor found for device: ${device.identifier}`, { resource: device.id });

			return null;
		}

		// Get bindings based on device mode (if applicable)
		let bindings: PropertyBinding[] = [];

		if (descriptor.instance?.modeProperty && descriptor.modes) {
			// Device has mode-based configuration - need to get current mode from adapter
			// Use the model type from descriptor to get the device from adapter
			const deviceModel = descriptor.models[0]; // Use the first model as the type
			const shellyDevice = this.shelliesAdapter.getDevice(deviceModel, device.identifier);

			if (!shellyDevice) {
				this.logger.warn(`Device ${device.identifier} not found in adapter, cannot determine mode`, {
					resource: device.id,
				});

				return null;
			}

			const modeValue = shellyDevice[descriptor.instance.modeProperty];
			const modeProfile = descriptor.modes.find((mode) => mode.modeValue === modeValue);

			if (modeProfile) {
				bindings = modeProfile.bindings;
			} else {
				this.logger.warn(`No mode profile found for mode value: ${String(modeValue)} on device ${device.identifier}`, {
					resource: device.id,
				});

				return null;
			}
		} else if (descriptor.bindings) {
			// Device has static bindings
			bindings = descriptor.bindings;
		}

		// Find the binding that matches the shelliesProperty
		const binding = bindings.find((b) => b.shelliesProperty === shelliesProperty);

		if (!binding) {
			this.logger.debug(`No binding found for shelliesProperty: ${shelliesProperty} on device ${device.identifier}`, {
				resource: device.id,
			});

			return null;
		}

		return binding;
	}

	/**
	 * Find the descriptor for a device entity by querying the model from a device_information channel
	 */
	private async findDescriptor(
		device: ShellyV1DeviceEntity,
	): Promise<(typeof DESCRIPTORS)[keyof typeof DESCRIPTORS] | null> {
		// Get the device_information channel
		const deviceInfoChannel = await this.channelsService.findOneBy<ShellyV1ChannelEntity>(
			'identifier',
			SHELLY_V1_CHANNEL_IDENTIFIERS.DEVICE_INFORMATION,
			device.id,
			DEVICES_SHELLY_V1_TYPE,
		);

		if (!deviceInfoChannel) {
			this.logger.warn(`No device_information channel found for device: ${device.identifier}`, { resource: device.id });

			return null;
		}

		// Get the model property from a device_information channel
		const modelProperty = await this.channelsPropertiesService.findOneBy<ShellyV1ChannelPropertyEntity>(
			'identifier',
			SHELLY_V1_DEVICE_INFO_PROPERTY_IDENTIFIERS.MODEL,
			deviceInfoChannel.id,
			DEVICES_SHELLY_V1_TYPE,
		);

		if (!modelProperty || !modelProperty.value) {
			this.logger.warn(`No model property found for device: ${device.identifier}`, { resource: device.id });

			return null;
		}

		const deviceModel = String(modelProperty.value).toUpperCase();

		// Try to find by exact device model match first
		for (const descriptor of Object.values(DESCRIPTORS)) {
			if (descriptor.models.some((model) => deviceModel === model)) {
				return descriptor;
			}
		}
		// Fallback: try to find by partial device model match
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

		this.logger.warn(`No descriptor found for device model: ${deviceModel}`);

		return null;
	}

	/**
	 * Handle error event from the shellies adapter
	 */
	@OnEvent(ShelliesAdapterEventType.ERROR)
	handleAdapterError(error: Error): void {
		this.logger.error('Shellies adapter error', {
			message: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
		});
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
			this.logger.error('Failed to initialize device states', {
				message: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
			});
		}
	}

	/**
	 * Periodically update signal strength (RSSI) and firmware version for all devices
	 * Runs every minute to keep device information up to date
	 */
	@Cron(CronExpression.EVERY_5_MINUTES)
	private async updateDevicesSignalStrength(): Promise<void> {
		if (this.state !== 'started') {
			return;
		}

		try {
			const registeredDevices = this.shelliesAdapter.getRegisteredDevices();

			if (registeredDevices.length === 0) {
				return;
			}

			this.logger.debug(`Updating device information for ${registeredDevices.length} devices`);

			for (const registeredDevice of registeredDevices) {
				// Skip disabled devices
				if (!registeredDevice.enabled) {
					continue;
				}

				try {
					// Find the device in a database first to get credentials
					const device = await this.devicesService.findOneBy<ShellyV1DeviceEntity>(
						'identifier',
						registeredDevice.id,
						DEVICES_SHELLY_V1_TYPE,
					);

					if (!device) {
						continue;
					}

					// Get credentials if the password is set
					let username: string | undefined;
					let password: string | undefined;

					if (device.password) {
						try {
							const loginSettings = await this.httpClient.getLoginSettings(registeredDevice.host);
							username = loginSettings.username || SHELLY_AUTH_USERNAME;
							password = device.password;
						} catch {
							// Fallback to default username if login endpoint fails
							username = SHELLY_AUTH_USERNAME;
							password = device.password;
						}
					}

					// Fetch device info and status from HTTP API in parallel
					const [info, status] = await Promise.all([
						this.httpClient.getDeviceInfo(registeredDevice.host),
						this.httpClient.getDeviceStatus(registeredDevice.host, undefined, username, password),
					]);

					// Get the device_information channel
					const deviceInfoChannel = await this.channelsService.findOneBy<ShellyV1ChannelEntity>(
						'identifier',
						SHELLY_V1_CHANNEL_IDENTIFIERS.DEVICE_INFORMATION,
						device.id,
						DEVICES_SHELLY_V1_TYPE,
					);

					if (!deviceInfoChannel) {
						continue;
					}

					// Update RSSI (signal strength)
					if (status.wifi_sta?.rssi) {
						const linkQualityProperty = await this.channelsPropertiesService.findOneBy<ShellyV1ChannelPropertyEntity>(
							'identifier',
							SHELLY_V1_DEVICE_INFO_PROPERTY_IDENTIFIERS.LINK_QUALITY,
							deviceInfoChannel.id,
							DEVICES_SHELLY_V1_TYPE,
						);

						if (linkQualityProperty) {
							await this.channelsPropertiesService.update<
								ShellyV1ChannelPropertyEntity,
								UpdateShellyV1ChannelPropertyDto
							>(linkQualityProperty.id, {
								type: DEVICES_SHELLY_V1_TYPE,
								value: status.wifi_sta.rssi,
							});

							this.logger.debug(`Updated signal strength for ${registeredDevice.id}: ${status.wifi_sta.rssi} dBm`, {
								resource: device.id,
							});
						}
					}

					// Update firmware version
					if (info.fw) {
						const firmwareProperty = await this.channelsPropertiesService.findOneBy<ShellyV1ChannelPropertyEntity>(
							'identifier',
							SHELLY_V1_DEVICE_INFO_PROPERTY_IDENTIFIERS.FIRMWARE_VERSION,
							deviceInfoChannel.id,
							DEVICES_SHELLY_V1_TYPE,
						);

						if (firmwareProperty) {
							await this.channelsPropertiesService.update<
								ShellyV1ChannelPropertyEntity,
								UpdateShellyV1ChannelPropertyDto
							>(firmwareProperty.id, {
								type: DEVICES_SHELLY_V1_TYPE,
								value: info.fw,
							});

							this.logger.debug(`Updated firmware version for ${registeredDevice.id}: ${info.fw}`, {
								resource: device.id,
							});
						}
					}
				} catch (error) {
					this.logger.warn(`Failed to update device information for ${registeredDevice.id}`, {
						message: error instanceof Error ? error.message : String(error),
					});
				}
			}
		} catch (error) {
			this.logger.error('Failed to update devices information', {
				message: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
			});
		}
	}
}

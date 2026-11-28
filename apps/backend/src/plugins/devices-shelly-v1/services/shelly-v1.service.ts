import { Injectable, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { ConfigService } from '../../../modules/config/services/config.service';
import { ConnectionState, DataTypeType, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelInputOccurrencesService } from '../../../modules/devices/services/channel-input-occurrences.service';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { BaseManagedExtensionService } from '../../../modules/extensions/services/base-managed-extension.service';
import {
	ConfigChangeResult,
	ServiceState,
} from '../../../modules/extensions/services/managed-extension-service.interface';
import {
	DEVICES_SHELLY_V1_PLUGIN_NAME,
	DEVICES_SHELLY_V1_TYPE,
	DeviceDescriptor,
	PropertyBinding,
	SHELLY_AUTH_USERNAME,
	SHELLY_V1_CHANNEL_IDENTIFIERS,
	SHELLY_V1_DEVICE_INFO_PROPERTY_IDENTIFIERS,
	SHELLY_V1_TO_PANEL_EVENT_MAP,
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
	RegisteredDevice,
	ShellyDevice,
} from '../interfaces/shellies.interface';
import { ShellyV1ConfigModel } from '../models/config.model';
import { findShellyV1Descriptor, getShellyV1Bindings } from '../utils/descriptor.utils';

import { DeviceMapperService } from './device-mapper.service';
import { ShelliesAdapterService } from './shellies-adapter.service';
import {
	ShellyV1AdoptedIdentityService,
	shellyV1Address,
	shellyV1PinMatches,
	shellyV1RegistrationMatchesPin,
	shellyV1ReportedMac,
} from './shelly-v1-adopted-identity.service';
import { ShellyV1HttpClientService } from './shelly-v1-http-client.service';
import { ShellyV1InputTrackerService } from './shelly-v1-input-tracker.service';
import { ShellyV1PropertyReportsService } from './shelly-v1-property-reports.service';

/**
 * Shelly V1 device discovery and synchronization service.
 *
 * This service implements the generic managed-extension contract for centralized lifecycle management.
 *
 * The service handles:
 * - Device discovery via mDNS/CoAP
 * - Device state synchronization
 * - Property change handling
 * - Periodic device information updates
 */
@Injectable()
export class ShellyV1Service extends BaseManagedExtensionService {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_SHELLY_V1_PLUGIN_NAME,
		'ShellyV1Service',
	);

	readonly owner = { kind: 'plugin', type: DEVICES_SHELLY_V1_PLUGIN_NAME } as const;
	readonly serviceId = 'connector';

	private pluginConfig: ShellyV1ConfigModel | null = null;
	private readonly tracker: ShellyV1InputTrackerService;

	constructor(
		private readonly configService: ConfigService,
		private readonly shelliesAdapter: ShelliesAdapterService,
		private readonly deviceMapper: DeviceMapperService,
		private readonly devicesService: DevicesService,
		private readonly channelsService: ChannelsService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly deviceConnectivityService: DeviceConnectivityService,
		private readonly httpClient: ShellyV1HttpClientService,
		private readonly reports: ShellyV1PropertyReportsService,
		private readonly identities: ShellyV1AdoptedIdentityService,
		@Optional() private readonly channelInputOccurrencesService?: ChannelInputOccurrencesService,
		@Optional() private readonly inputTracker?: ShellyV1InputTrackerService,
	) {
		super();
		this.tracker = this.inputTracker ?? new ShellyV1InputTrackerService();

		// Set up adapter callbacks
		this.shelliesAdapter.setCallbacks({
			onDeviceDiscovered: (event) => this.handleDeviceDiscovered(event),
			onDeviceChanged: (event) => this.handleDeviceChanged(event),
			onTemperatureReport: (report) => this.reports.temperature(report),
			onDeviceOffline: (event) => this.handleConnectionChange(event),
			onDeviceOnline: (event) => this.handleConnectionChange(event),
			onError: (error) => this.handleAdapterError(error),
		});
	}

	/**
	 * Start the service.
	 * Called by ManagedServiceManagerService when the plugin is enabled.
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
	 * Called by ManagedServiceManagerService when the plugin is disabled or app shuts down.
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

	isHealthy(): Promise<boolean> {
		return Promise.resolve(this.state === 'started' && this.shelliesAdapter.isRunning());
	}

	/**
	 * Handle configuration changes.
	 * Called by ManagedServiceManagerService when config updates occur.
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
	private async handleDeviceDiscovered(event: NormalizedDeviceEvent): Promise<void> {
		this.logger.log(`Device discovered: ${event.id} (${event.type}) at ${event.host}`);

		try {
			const device = await this.deviceMapper.mapDevice(event, this.config.discovery.enabled);
			if (!device) return;

			this.logger.log(`Device mapped successfully: ${device.identifier} (${device.id})`, { resource: device.id });
		} catch (error) {
			this.logger.error(`Failed to map device ${event.id}:`, {
				message: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
			});
		}
	}

	private async resolveRegisteredDevice(registration: RegisteredDevice, peer: ShellyDevice, includePin = false) {
		const { id, type, host, catalog } = registration;
		const device = await this.devicesService.findOneBy<ShellyV1DeviceEntity>(
			catalog ? 'id' : 'identifier',
			catalog?.deviceId ?? id,
			DEVICES_SHELLY_V1_TYPE,
		);
		if (!device?.enabled) return null;
		const isCurrent = (): boolean =>
			device.enabled &&
			registration.enabled &&
			this.shelliesAdapter.isRunning() &&
			this.shelliesAdapter.getRegisteredDevice(id) === registration &&
			this.shelliesAdapter.getRegisteredDeviceForCatalog(device) === registration &&
			this.shelliesAdapter.getDevice(type, id) === peer &&
			registration.host === host &&
			peer.id === id &&
			peer.type === type &&
			peer.host === host;
		if (!isCurrent()) return null;
		const pin = includePin || registration.catalog ? await this.identities.findPin(device.id) : null;
		return isCurrent() && shellyV1RegistrationMatchesPin(registration, device, pin) ? { device, pin, isCurrent } : null;
	}

	/**
	 * Handle device property change event from the shellies adapter
	 */
	private async handleDeviceChanged(event: NormalizedDeviceChangeEvent): Promise<void> {
		this.logger.debug(`Device ${event.id} property changed: ${event.property} = ${JSON.stringify(event.newValue)}`);

		try {
			const registeredDevice = this.shelliesAdapter.getRegisteredDevice(event.id);
			if (!registeredDevice?.enabled || registeredDevice.id !== event.id) return;
			const peer = this.shelliesAdapter.getDevice(registeredDevice.type, registeredDevice.id);
			if (!peer) return;

			// Snapshot raw inputEvent before asynchronous device lookup to prevent race conditions
			const counterMatch = event.property.match(/^inputEventCounter(\d+)$/);
			const rawEvent = counterMatch ? String(peer[`inputEvent${Number(counterMatch[1])}`] ?? '') : '';
			const source = await this.resolveRegisteredDevice(registeredDevice, peer);
			if (!source || !source.isCurrent()) return;
			const { device, isCurrent } = source;

			// Handle input event counters for hardware button/input occurrence publishing
			if (counterMatch) {
				await this.handleInputEventCounter(
					device,
					Number(counterMatch[1]),
					Number(event.newValue),
					rawEvent,
					isCurrent,
				);

				return;
			}

			// Suppress raw inputEvent property changes since occurrences are dispatched via inputEventCounter
			if (/^inputEvent\d+$/.test(event.property)) {
				return;
			}

			// Look up the property binding using the shelliesProperty from the event
			const binding = await this.findPropertyBinding(device, peer, event.property);

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

			if (!isCurrent()) return;
			let propValue = event.newValue;
			if (property.dataType === DataTypeType.BOOL && typeof event.newValue === 'number') {
				propValue = Boolean(event.newValue);
			}

			// The library's change event coerces raw values and can replay cached state. Verify
			// thermostat measurements against the original device's independent status endpoint.
			await this.channelsPropertiesService.update<ShellyV1ChannelPropertyEntity, UpdateShellyV1ChannelPropertyDto>(
				property.id,
				{ type: DEVICES_SHELLY_V1_TYPE, value: propValue },
				{ valueIsCurrent: isCurrent },
			);

			if (isCurrent() && binding.category === PropertyCategory.ON && this.reports.supports(binding))
				await this.reports.refresh(device, isCurrent);

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
	 * Handle input event counter changes from Shelly Gen 1 devices
	 */
	private async handleInputEventCounter(
		device: ShellyV1DeviceEntity,
		channelIndex: number,
		counter: number,
		rawEvent: string,
		isCurrent: () => boolean,
	): Promise<void> {
		const trackResult = this.tracker.trackEvent(device.id, channelIndex, counter, rawEvent);

		if (!trackResult.shouldPublish) {
			this.logger.debug(
				`Input event suppressed (counter=${counter}, rawEvent=${rawEvent}) on device ${device.identifier} channel ${channelIndex}`,
			);

			return;
		}

		const mappedEvent = SHELLY_V1_TO_PANEL_EVENT_MAP[rawEvent];
		if (!mappedEvent) {
			this.logger.warn(
				`Unrecognized Shelly V1 input event "${rawEvent}" on device ${device.identifier} channel ${channelIndex}`,
			);
			trackResult.commit();

			return;
		}

		const channelIdentifier = `input_${channelIndex}`;
		const channel = await this.channelsService.findOneBy<ShellyV1ChannelEntity>(
			'identifier',
			channelIdentifier,
			device.id,
			DEVICES_SHELLY_V1_TYPE,
		);

		if (!channel) {
			this.logger.debug(`Channel ${channelIdentifier} not found for device ${device.identifier}, skipping occurrence`, {
				resource: device.id,
			});

			return;
		}

		const eventProperty = await this.channelsPropertiesService.findOneBy<ShellyV1ChannelPropertyEntity>(
			'identifier',
			'event',
			channel.id,
			DEVICES_SHELLY_V1_TYPE,
		);

		if (!eventProperty) {
			this.logger.debug(`Event property not found on channel ${channelIdentifier} for device ${device.identifier}`, {
				resource: device.id,
			});

			return;
		}

		// Update property value in database
		if (!isCurrent()) return;
		await this.channelsPropertiesService.update<ShellyV1ChannelPropertyEntity, UpdateShellyV1ChannelPropertyDto>(
			eventProperty.id,
			{ type: DEVICES_SHELLY_V1_TYPE, value: mappedEvent },
			{ valueIsCurrent: isCurrent },
		);
		if (!isCurrent()) return;

		// Publish occurrence independently through ChannelInputOccurrencesService
		if (this.channelInputOccurrencesService) {
			const sourceTimestamp = new Date().toISOString();
			const sourceOccurrenceId = trackResult.isReset
				? `${channel.id}:${rawEvent}:${counter}:reset:${trackResult.resetGeneration}`
				: `${channel.id}:${rawEvent}:${counter}`;

			try {
				await this.channelInputOccurrencesService.publishOccurrence({
					deviceId: device.id,
					channelId: channel.id,
					propertyId: eventProperty.id,
					event: mappedEvent,
					nativeEventType: rawEvent,
					sourceTimestamp,
					sourceOccurrenceId,
				});

				this.logger.log(
					`Published input occurrence ${mappedEvent} (${rawEvent}) for channel ${channel.identifier} on device ${device.identifier}`,
					{ resource: device.id },
				);
			} catch (error) {
				this.logger.error(
					`Failed to publish input occurrence for device ${device.identifier}: ${error instanceof Error ? error.message : String(error)}`,
					{ resource: device.id },
				);

				return;
			}
		}

		// Commit the counter only after channel lookup, property updates, and occurrence publication all succeed
		trackResult.commit();
	}

	private async handleConnectionChange(event: NormalizedDeviceEvent): Promise<void> {
		try {
			const registration = this.shelliesAdapter.getRegisteredDevice(event.id);
			if (!registration?.enabled || registration.type !== event.type || registration.host !== event.host) return;
			const peer = this.shelliesAdapter.getDevice(event.type, event.id);
			if (!peer) return;
			const source = await this.resolveRegisteredDevice(registration, peer);
			if (!source) return;
			const isCurrent = () => source.isCurrent() && peer.online === event.online;
			if (!isCurrent()) return;
			await this.deviceConnectivityService.setConnectionState(
				source.device.id,
				{ state: event.online ? ConnectionState.CONNECTED : ConnectionState.DISCONNECTED },
				isCurrent,
			);
		} catch (error) {
			this.logger.error(`Failed to update connection state for device ${event.id}:`, {
				message: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
			});
		}
	}

	private async findPropertyBinding(
		device: ShellyV1DeviceEntity,
		peer: ShellyDevice,
		shelliesProperty: string,
	): Promise<PropertyBinding | null> {
		const descriptor = await this.findDescriptor(device);
		if (!descriptor) return null;
		return (
			getShellyV1Bindings(descriptor, peer).find((binding) => binding.shelliesProperty === shelliesProperty) ?? null
		);
	}

	/**
	 * Find the descriptor for a device entity by querying the model from a device_information channel
	 */
	private async findDescriptor(device: ShellyV1DeviceEntity): Promise<DeviceDescriptor | null> {
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

		if (!modelProperty || !modelProperty.value?.value) {
			this.logger.warn(`No model property found for device: ${device.identifier}`, { resource: device.id });

			return null;
		}

		const deviceModel = String(modelProperty.value.value);
		const descriptor = findShellyV1Descriptor(deviceModel);

		if (!descriptor) {
			this.logger.warn(`No descriptor found for device model: ${deviceModel.toUpperCase()}`);
		}

		return descriptor;
	}

	/**
	 * Handle error event from the shellies adapter
	 */
	private handleAdapterError(error: Error): void {
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
	 * Runs every five minutes to keep device information up to date.
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

				const host = registeredDevice.host;
				const peer = this.shelliesAdapter.getDevice(registeredDevice.type, registeredDevice.id);
				if (!peer?.online) continue;
				const credentialRevision = registeredDevice.credentialRevision;

				try {
					const source = await this.resolveRegisteredDevice(registeredDevice, peer, true);
					if (!source) continue;
					const { device, pin } = source;
					const isCurrent = (): boolean =>
						this.state === 'started' &&
						peer.online &&
						registeredDevice.credentialRevision === credentialRevision &&
						source.isCurrent();
					if (!isCurrent() || (pin && !shellyV1PinMatches(device.identifier, pin.mac))) continue;
					const address = shellyV1Address(device.identifier);
					const expected = pin?.mac ?? (address?.length === 12 ? address : null);
					// Legacy short IDs can use their configured host only while they have no adopted pin.
					if (expected === null && device.hostname !== host) continue;
					const info = await this.httpClient.getDeviceInfo(host);
					const mac = shellyV1ReportedMac(device.identifier, registeredDevice.type, info);
					if (!mac || (expected !== null && expected !== mac) || !isCurrent()) continue;

					const savedPassword = device.password ?? null;
					const password = savedPassword || undefined;
					let username: string | undefined;
					if (password) {
						const login = await this.httpClient.getLoginSettings(host).catch((): null => null);
						username = login?.username || SHELLY_AUTH_USERNAME;
					}
					if (!isCurrent()) continue;
					const latest = await this.identities.captureDevice(device.identifier);
					if (
						!isCurrent() ||
						!latest ||
						latest.id !== device.id ||
						latest.identifier !== device.identifier ||
						!latest.enabled ||
						latest.password !== savedPassword ||
						latest.hostname !== device.hostname ||
						latest.pin?.mac !== pin?.mac ||
						latest.pin?.verifiedHost !== pin?.verifiedHost ||
						latest.pin?.revision !== pin?.revision
					)
						continue;
					const observation = expected ? this.reports.capture(device) : null;
					const status = await this.httpClient.getDeviceStatus(host, undefined, username, password);
					if (!isCurrent() || typeof status?.mac !== 'string' || status.mac.toUpperCase() !== mac) continue;
					if (observation) await this.reports.publish(observation, status, new Date());
					if (!isCurrent()) continue;

					// Get the device_information channel
					const deviceInfoChannel = await this.channelsService.findOneBy<ShellyV1ChannelEntity>(
						'identifier',
						SHELLY_V1_CHANNEL_IDENTIFIERS.DEVICE_INFORMATION,
						device.id,
						DEVICES_SHELLY_V1_TYPE,
					);

					if (!deviceInfoChannel || !isCurrent()) {
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

						if (linkQualityProperty && isCurrent()) {
							const quality = this.rssiToQuality(status.wifi_sta.rssi);

							await this.channelsPropertiesService.update<
								ShellyV1ChannelPropertyEntity,
								UpdateShellyV1ChannelPropertyDto
							>(
								linkQualityProperty.id,
								{ type: DEVICES_SHELLY_V1_TYPE, value: quality },
								{ valueIsCurrent: isCurrent },
							);

							this.logger.debug(
								`Updated signal strength for ${registeredDevice.id}: ${status.wifi_sta.rssi} dBm (${quality}%)`,
								{ resource: device.id },
							);
						}
					}

					// Update firmware version
					if (info.fw && isCurrent()) {
						const firmwareProperty = await this.channelsPropertiesService.findOneBy<ShellyV1ChannelPropertyEntity>(
							'identifier',
							SHELLY_V1_DEVICE_INFO_PROPERTY_IDENTIFIERS.FIRMWARE_VERSION,
							deviceInfoChannel.id,
							DEVICES_SHELLY_V1_TYPE,
						);

						if (firmwareProperty && isCurrent()) {
							await this.channelsPropertiesService.update<
								ShellyV1ChannelPropertyEntity,
								UpdateShellyV1ChannelPropertyDto
							>(firmwareProperty.id, { type: DEVICES_SHELLY_V1_TYPE, value: info.fw }, { valueIsCurrent: isCurrent });

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

	/**
	 * Convert RSSI (dBm) to signal quality percentage (0-100)
	 */
	private rssiToQuality(rssi: number): number {
		if (rssi <= -100) return 0;
		if (rssi >= -50) return 100;

		return Math.round(2 * (rssi + 100));
	}
}

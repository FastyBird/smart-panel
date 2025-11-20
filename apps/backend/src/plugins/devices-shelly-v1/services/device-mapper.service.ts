import { Injectable, Logger } from '@nestjs/common';

import { toInstance } from '../../../common/utils/transform.utils';
import {
	ChannelCategory,
	ConnectionState,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import {
	DESCRIPTORS,
	DEVICES_SHELLY_V1_TYPE,
	PropertyBinding,
	SHELLY_AUTH_USERNAME,
	SHELLY_V1_CHANNEL_IDENTIFIERS,
	SHELLY_V1_CHANNEL_PREFIX_TO_CATEGORY,
	SHELLY_V1_DEVICE_INFO_PROPERTY_IDENTIFIERS,
} from '../devices-shelly-v1.constants';
import { DevicesShellyV1NotSupportedException } from '../devices-shelly-v1.exceptions';
import { CreateShellyV1ChannelPropertyDto } from '../dto/create-channel-property.dto';
import { CreateShellyV1ChannelDto } from '../dto/create-channel.dto';
import { CreateShellyV1DeviceDto } from '../dto/create-device.dto';
import { UpdateShellyV1ChannelPropertyDto } from '../dto/update-channel-property.dto';
import { UpdateShellyV1DeviceDto } from '../dto/update-device.dto';
import {
	ShellyV1ChannelEntity,
	ShellyV1ChannelPropertyEntity,
	ShellyV1DeviceEntity,
} from '../entities/devices-shelly-v1.entity';
import { ShellyDevicePropertyValue } from '../interfaces/shellies.interface';
import { NormalizedDeviceEvent, ShellyDevice } from '../interfaces/shellies.interface';
import { ShellyInfoResponse, ShellyStatusResponse } from '../interfaces/shelly-http.interface';
import { getPropertyDefaultValue, getPropertyMetadata, getRequiredProperties } from '../../../modules/devices/utils/schema.utils';
import { getSyntheticProperties, isSyntheticProperty } from '../utils/synthetic-properties.utils';
import { mapValueToCanonical, validateEnumValue, VALUE_MAP_REGISTRY } from '../utils/value-mapping.utils';

import { ShelliesAdapterService } from './shellies-adapter.service';
import { ShellyV1HttpClientService } from './shelly-v1-http-client.service';

@Injectable()
export class DeviceMapperService {
	private readonly logger = new Logger(DeviceMapperService.name);

	constructor(
		private readonly devicesService: DevicesService,
		private readonly channelsService: ChannelsService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly deviceConnectivityService: DeviceConnectivityService,
		private readonly shelliesAdapter: ShelliesAdapterService,
		private readonly httpClient: ShellyV1HttpClientService,
	) {}

	/**
	 * Map and create or update a discovered device
	 */
	async mapDevice(event: NormalizedDeviceEvent): Promise<ShellyV1DeviceEntity> {
		this.logger.debug(`[SHELLY V1][MAPPER] Mapping device: ${event.id} (${event.type})`);

		// Get the device instance from the adapter
		const shellyDevice = this.shelliesAdapter.getDevice(event.type, event.id);

		if (!shellyDevice) {
			this.logger.warn(`[SHELLY V1][MAPPER] Device ${event.id} not found in adapter`);
			throw new DevicesShellyV1NotSupportedException(`Device ${event.id} not found in adapter`);
		}

		// Find the device descriptor for this device type
		const descriptor = this.findDescriptor(event.type);

		if (!descriptor) {
			this.logger.warn(`[SHELLY V1][MAPPER] No descriptor found for device type: ${event.type}`);
			throw new DevicesShellyV1NotSupportedException(`Unsupported device type: ${event.type}`);
		}

		// Variables to store credentials for HTTP requests
		let username: string | undefined;
		let password: string | undefined;

		// Fetch device settings to get the device name
		let deviceName = event.id; // Default to device ID

		try {
			const settings = await this.httpClient.getDeviceSettings(shellyDevice.host);

			deviceName = settings.name || event.id;

			this.logger.debug(`[SHELLY V1][MAPPER] Fetched device name: ${deviceName}`);
		} catch (error) {
			this.logger.warn(`[SHELLY V1][MAPPER] Failed to fetch device settings from ${shellyDevice.host}`, {
				message: error instanceof Error ? error.message : String(error),
			});
			// Continue with the default name (device ID) if settings fetch fails
		}

		// Create or update the device entity
		let device = await this.devicesService.findOneBy<ShellyV1DeviceEntity>(
			'identifier',
			event.id,
			DEVICES_SHELLY_V1_TYPE,
		);

		if (!device) {
			this.logger.log(`[SHELLY V1][MAPPER] Creating new device: ${event.id} with name: ${deviceName}`);

			const createDto: CreateShellyV1DeviceDto = {
				type: DEVICES_SHELLY_V1_TYPE,
				identifier: event.id,
				name: deviceName,
				category: descriptor.categories[0] || DeviceCategory.GENERIC,
				enabled: true,
				hostname: event.host,
			};

			device = await this.devicesService.create<ShellyV1DeviceEntity, CreateShellyV1DeviceDto>(createDto);
		} else {
			// If a device is disabled, set to UNKNOWN and skip updates
			if (!device.enabled) {
				this.logger.debug(
					`[SHELLY V1][MAPPER] Device ${event.id} is disabled, setting to UNKNOWN and skipping updates`,
				);

				// Update registry to mark a device as disabled
				this.shelliesAdapter.updateDeviceEnabledStatus(event.id, false);

				// Set connection state to UNKNOWN for disabled devices
				await this.deviceConnectivityService.setConnectionState(device.id, {
					state: ConnectionState.UNKNOWN,
				});

				return device;
			}

			this.logger.debug(`[SHELLY V1][MAPPER] Device already exists: ${event.id}, updating hostname if changed`);

			// Update the registry to ensure a device is marked as enabled
			this.shelliesAdapter.updateDeviceEnabledStatus(event.id, true);

			// Set auth credentials if the password is configured
			if (device.password) {
				this.logger.debug(`[SHELLY V1][MAPPER] Fetching username from login settings for device ${event.id}`);

				try {
					// Get the real username from the login endpoint
					const loginSettings = await this.httpClient.getLoginSettings(shellyDevice.host);
					username = loginSettings.username || SHELLY_AUTH_USERNAME;
					password = device.password;

					this.logger.debug(
						`[SHELLY V1][MAPPER] Setting auth credentials for device ${event.id} (username: ${username})`,
					);
					this.shelliesAdapter.setDeviceAuthCredentials(event.type, event.id, username, password);
				} catch (error) {
					this.logger.warn(
						`[SHELLY V1][MAPPER] Failed to fetch login settings from ${shellyDevice.host}, using default username`,
						{
							message: error instanceof Error ? error.message : String(error),
						},
					);

					// Fallback to default username if login endpoint fails
					username = SHELLY_AUTH_USERNAME;
					password = device.password;
					this.shelliesAdapter.setDeviceAuthCredentials(event.type, event.id, username, password);
				}
			}

			// Update hostname if it changed (a device might have a new IP address)
			if (device.hostname !== event.host) {
				this.logger.log(
					`[SHELLY V1][MAPPER] Updating hostname for device ${event.id}: ${device.hostname} -> ${event.host}`,
				);

				const updateDto: UpdateShellyV1DeviceDto = {
					type: DEVICES_SHELLY_V1_TYPE,
					hostname: event.host,
				};

				device = await this.devicesService.update<ShellyV1DeviceEntity, UpdateShellyV1DeviceDto>(device.id, updateDto);
			}
		}

		// Create a device_information channel
		await this.createDeviceInformationChannel(device, shellyDevice, username, password);

		// Determine which bindings to use based on mode (if applicable)
		let bindings: PropertyBinding[] = [];

		if (descriptor.instance?.modeProperty && descriptor.modes) {
			// Device has mode-based configuration
			const modeValue = shellyDevice[descriptor.instance.modeProperty];

			this.logger.debug(
				`[SHELLY V1][MAPPER] Device ${event.id} has mode property: ${descriptor.instance.modeProperty} = ${modeValue}`,
			);

			const modeProfile = descriptor.modes.find((mode) => mode.modeValue === modeValue);

			if (modeProfile) {
				bindings = modeProfile.bindings;
				this.logger.debug(`[SHELLY V1][MAPPER] Using mode profile: ${modeValue}`);
			} else {
				this.logger.warn(
					`[SHELLY V1][MAPPER] No mode profile found for mode value: ${modeValue}, device will have no channels`,
				);
			}
		} else if (descriptor.bindings) {
			// Device has static bindings
			bindings = descriptor.bindings;
		}

		// Create channels and properties from bindings
		await this.createChannelsFromBindings(device, bindings, shellyDevice);

		// Set device connection state to CONNECTED after successful discovery
		await this.deviceConnectivityService.setConnectionState(device.id, {
			state: ConnectionState.CONNECTED,
		});

		this.logger.log(`[SHELLY V1][MAPPER] Device ${device.identifier} discovery completed and set to CONNECTED`);

		return device;
	}

	/**
	 * Create device_information channel with device metadata properties
	 */
	private async createDeviceInformationChannel(
		device: ShellyV1DeviceEntity,
		shellyDevice: ShellyDevice,
		username?: string,
		password?: string,
	): Promise<void> {
		const channelIdentifier = SHELLY_V1_CHANNEL_IDENTIFIERS.DEVICE_INFORMATION;

		this.logger.debug(`[SHELLY V1][MAPPER] Fetching additional device info from ${shellyDevice.host}`);

		// Fetch additional device information from HTTP API
		let deviceInfo: ShellyInfoResponse | undefined;
		let deviceStatus: ShellyStatusResponse | undefined;

		try {
			[deviceInfo, deviceStatus] = await Promise.all([
				this.httpClient.getDeviceInfo(shellyDevice.host),
				this.httpClient.getDeviceStatus(shellyDevice.host, undefined, username, password),
			]);

			this.logger.debug(
				`[SHELLY V1][MAPPER] Fetched device info: fw=${deviceInfo.fw}, rssi=${deviceStatus.wifi_sta?.rssi}`,
			);
		} catch (error) {
			this.logger.warn(`[SHELLY V1][MAPPER] Failed to fetch device info from ${shellyDevice.host}`, {
				message: error instanceof Error ? error.message : String(error),
			});
			// Continue with discovery even if HTTP requests fail
			deviceInfo = null;
			deviceStatus = null;
		}

		// Check if a channel already exists
		let channel = await this.channelsService.findOneBy<ShellyV1ChannelEntity>(
			'identifier',
			channelIdentifier,
			device.id,
			DEVICES_SHELLY_V1_TYPE,
		);

		if (!channel) {
			this.logger.debug(`[SHELLY V1][MAPPER] Creating device_information channel for device ${device.identifier}`);

			const createChannelDto: CreateShellyV1ChannelDto = {
				type: DEVICES_SHELLY_V1_TYPE,
				device: device.id,
				identifier: channelIdentifier,
				name: 'Device Information',
				category: ChannelCategory.DEVICE_INFORMATION,
			};

			channel = await this.channelsService.create<ShellyV1ChannelEntity, CreateShellyV1ChannelDto>(createChannelDto);
		}

		// Define device information properties
		const deviceInfoProperties: Array<{
			identifier: string;
			name: string;
			category: PropertyCategory;
			dataType: DataTypeType;
			unit?: string;
			format?: number[] | string[];
			value?: string | number | boolean | null;
		}> = [
			{
				identifier: SHELLY_V1_DEVICE_INFO_PROPERTY_IDENTIFIERS.MANUFACTURER,
				name: 'Manufacturer',
				category: PropertyCategory.MANUFACTURER,
				dataType: DataTypeType.STRING,
				value: 'Shelly',
			},
			{
				identifier: SHELLY_V1_DEVICE_INFO_PROPERTY_IDENTIFIERS.MODEL,
				name: 'Model',
				category: PropertyCategory.MODEL,
				dataType: DataTypeType.STRING,
				value: shellyDevice.type,
			},
			{
				identifier: SHELLY_V1_DEVICE_INFO_PROPERTY_IDENTIFIERS.SERIAL_NUMBER,
				name: 'Serial Number',
				category: PropertyCategory.SERIAL_NUMBER,
				dataType: DataTypeType.STRING,
				value: deviceInfo?.mac || shellyDevice.id,
			},
			{
				identifier: SHELLY_V1_DEVICE_INFO_PROPERTY_IDENTIFIERS.FIRMWARE_VERSION,
				name: 'Firmware Version',
				category: PropertyCategory.FIRMWARE_REVISION,
				dataType: DataTypeType.STRING,
				value: deviceInfo?.fw || null,
			},
			{
				identifier: SHELLY_V1_DEVICE_INFO_PROPERTY_IDENTIFIERS.LINK_QUALITY,
				name: 'Link Quality',
				category: PropertyCategory.LINK_QUALITY,
				dataType: DataTypeType.INT,
				value: deviceStatus?.wifi_sta?.rssi || null,
			},
			{
				identifier: SHELLY_V1_DEVICE_INFO_PROPERTY_IDENTIFIERS.STATUS,
				name: 'Status',
				category: PropertyCategory.STATUS,
				dataType: DataTypeType.ENUM,
				value: ConnectionState.CONNECTED,
				format: [ConnectionState.CONNECTED, ConnectionState.DISCONNECTED, ConnectionState.UNKNOWN],
			},
		];

		// Add mode property if a device has it
		if (shellyDevice['mode']) {
			const modeValue = shellyDevice['mode'];

			deviceInfoProperties.push({
				identifier: SHELLY_V1_DEVICE_INFO_PROPERTY_IDENTIFIERS.MODE,
				name: 'Mode',
				category: PropertyCategory.MODE,
				dataType: DataTypeType.STRING,
				value: typeof modeValue === 'function' ? null : modeValue,
			});
		}

		// Create or update device information properties
		for (const propDef of deviceInfoProperties) {
			await this.createOrUpdateProperty(channel, propDef);
		}
	}

	/**
	 * Create channels and properties from bindings
	 */
	private async createChannelsFromBindings(
		device: ShellyV1DeviceEntity,
		bindings: PropertyBinding[],
		shellyDevice: ShellyDevice,
	): Promise<void> {
		// Group bindings by channel
		const channelBindingsMap = new Map<string, PropertyBinding[]>();

		for (const binding of bindings) {
			if (!channelBindingsMap.has(binding.channelIdentifier)) {
				channelBindingsMap.set(binding.channelIdentifier, []);
			}

			channelBindingsMap.get(binding.channelIdentifier)!.push(binding);
		}

		// Create channels and their properties
		for (const [channelIdentifier, channelBindings] of channelBindingsMap) {
			await this.createChannelWithProperties(device, channelIdentifier, channelBindings, shellyDevice);
		}
	}

	/**
	 * Create a channel with its properties
	 */
	private async createChannelWithProperties(
		device: ShellyV1DeviceEntity,
		channelIdentifier: string,
		bindings: PropertyBinding[],
		shellyDevice: ShellyDevice,
	): Promise<void> {
		// Check if a channel already exists
		let channel = await this.channelsService.findOneBy<ShellyV1ChannelEntity>(
			'identifier',
			channelIdentifier,
			device.id,
			DEVICES_SHELLY_V1_TYPE,
		);

		if (!channel) {
			this.logger.debug(`[SHELLY V1][MAPPER] Creating channel: ${channelIdentifier} for device ${device.identifier}`);

			const channelCategory = this.inferChannelCategory(channelIdentifier, bindings);
			const channelName = this.formatChannelName(channelIdentifier);

			const createChannelDto: CreateShellyV1ChannelDto = {
				type: DEVICES_SHELLY_V1_TYPE,
				device: device.id,
				identifier: channelIdentifier,
				name: channelName,
				category: channelCategory,
			};

			channel = await this.channelsService.create<ShellyV1ChannelEntity, CreateShellyV1ChannelDto>(createChannelDto);
		}

		// Create properties for the channel with initial values from the device state
		for (const binding of bindings) {
			const rawValue = shellyDevice[binding.shelliesProperty];
			// Filter out function values (methods on the device object)
			let initialValue: ShellyDevicePropertyValue =
				typeof rawValue === 'function' ? undefined : (rawValue as ShellyDevicePropertyValue);

			// Apply value mapping for ENUM properties (data-driven via binding.valueMap)
			if (
				binding.dataType === DataTypeType.ENUM &&
				binding.valueMap &&
				initialValue !== undefined &&
				initialValue !== null
			) {
				const valueMapConfig = VALUE_MAP_REGISTRY[binding.valueMap];

				if (valueMapConfig) {
					const mappedValue = mapValueToCanonical(
						initialValue,
						valueMapConfig.forward,
						`${channel.identifier}.${binding.propertyIdentifier}`,
					);

					if (mappedValue !== null) {
						// Validate mapped value is in format
						if (binding.format && validateEnumValue(mappedValue, binding.format, binding.propertyIdentifier)) {
							initialValue = mappedValue;
						} else {
							// Invalid mapped value, skip setting it
							this.logger.warn(
								`[SHELLY V1][MAPPER] Mapped value "${mappedValue}" for ${binding.propertyIdentifier} is not in format, skipping`,
							);
							initialValue = null;
						}
					} else {
						// Unknown raw value, skip setting it
						this.logger.warn(
							`[SHELLY V1][MAPPER] Unknown raw value "${rawValue}" for ${binding.propertyIdentifier}, skipping`,
						);
						initialValue = null;
					}
				} else {
					this.logger.warn(
						`[SHELLY V1][MAPPER] Value map "${binding.valueMap}" not found in registry for ${binding.propertyIdentifier}`,
					);
				}
			}

			// For ENUM properties, validate value is in format
			if (
				binding.dataType === DataTypeType.ENUM &&
				binding.format &&
				initialValue !== undefined &&
				initialValue !== null
			) {
				if (!validateEnumValue(initialValue, binding.format, binding.propertyIdentifier)) {
					this.logger.warn(
						`[SHELLY V1][MAPPER] Value "${initialValue}" for ${binding.propertyIdentifier} is not in format, skipping`,
					);
					initialValue = null;
				}
			}

			await this.createOrUpdateProperty(channel, {
				identifier: binding.propertyIdentifier,
				name: this.formatPropertyName(binding.propertyIdentifier),
				category: binding.category,
				dataType: binding.dataType,
				permissions: binding.permissions,
				unit: binding.unit,
				format: binding.format,
				value: initialValue !== undefined ? initialValue : null,
			});
		}

		// Ensure all required properties from schema exist
		await this.ensureRequiredProperties(channel, bindings, shellyDevice);

		// Ensure synthetic properties (e.g., battery status derived from percentage)
		await this.ensureSyntheticProperties(channel, shellyDevice);
	}

	/**
	 * Ensure all required properties from schema exist for the channel
	 * If a required property is missing, create it with schema default value
	 */
	private async ensureRequiredProperties(
		channel: ShellyV1ChannelEntity,
		bindings: PropertyBinding[],
		shellyDevice: ShellyDevice,
	): Promise<void> {
		// Get required properties from schema for this channel category
		const requiredProperties = getRequiredProperties(channel.category);

		this.logger.debug(
			`[SHELLY V1][MAPPER] Checking required properties for channel ${channel.identifier} (${channel.category}): ${requiredProperties.join(', ')}`,
		);

		// Get existing property categories from bindings
		const existingPropertyCategories = bindings.map((b) => b.category);

		// Check each required property
		for (const requiredPropertyCategory of requiredProperties) {
			// Skip if already exists in bindings
			if (existingPropertyCategories.includes(requiredPropertyCategory)) {
				continue;
			}

			// Skip if it's a synthetic property (will be handled separately)
			if (isSyntheticProperty(channel.category, requiredPropertyCategory)) {
				continue;
			}

			// Get property metadata from schema
			const propertyMetadata = getPropertyMetadata(channel.category, requiredPropertyCategory);

			if (!propertyMetadata) {
				this.logger.warn(
					`[SHELLY V1][MAPPER] No schema metadata found for required property ${requiredPropertyCategory} in channel ${channel.category}`,
				);
				continue;
			}

			// Get default value from schema
			const defaultValue = getPropertyDefaultValue(channel.category, requiredPropertyCategory);

			this.logger.debug(
				`[SHELLY V1][MAPPER] Adding missing required property ${requiredPropertyCategory} to channel ${channel.identifier} with default value: ${defaultValue}`,
			);

			// Create the missing required property with schema metadata and default value
			await this.createOrUpdateProperty(channel, {
				identifier: `${requiredPropertyCategory.toLowerCase()}`,
				name: this.formatPropertyName(requiredPropertyCategory.toLowerCase()),
				category: requiredPropertyCategory,
				dataType: propertyMetadata.data_type,
				permissions: propertyMetadata.permissions,
				unit: propertyMetadata.unit ?? undefined,
				format: propertyMetadata.format ?? undefined,
				value: defaultValue,
			});
		}
	}

	/**
	 * Ensure synthetic properties are created and updated
	 * Synthetic properties are derived from other properties (e.g., battery status from percentage)
	 */
	private async ensureSyntheticProperties(channel: ShellyV1ChannelEntity, shellyDevice: ShellyDevice): Promise<void> {
		// Get synthetic properties for this channel category
		const syntheticProperties = getSyntheticProperties(channel.category);

		if (syntheticProperties.length === 0) {
			return;
		}

		this.logger.debug(
			`[SHELLY V1][MAPPER] Processing ${syntheticProperties.length} synthetic properties for channel ${channel.identifier}`,
		);

		// Process each synthetic property
		for (const syntheticProp of syntheticProperties) {
			// Find the source property in the channel
			const sourceProperty = await this.channelsPropertiesService.findOneBy<ShellyV1ChannelPropertyEntity>(
				'category',
				syntheticProp.sourcePropertyCategory,
				channel.id,
			);

			if (!sourceProperty) {
				this.logger.warn(
					`[SHELLY V1][MAPPER] Source property ${syntheticProp.sourcePropertyCategory} not found for synthetic property ${syntheticProp.propertyCategory} in channel ${channel.identifier}`,
				);
				continue;
			}

			// Check if the synthetic property already exists (to preserve user-configured values)
			const existingSyntheticProperty = await this.channelsPropertiesService.findOneBy<ShellyV1ChannelPropertyEntity>(
				'category',
				syntheticProp.propertyCategory,
				channel.id,
			);

			// Derive the synthetic value from the source property (passing existing value to preserve if needed)
			const syntheticValue = syntheticProp.deriveValue(sourceProperty.value, existingSyntheticProperty?.value ?? null);

			// Get property metadata from schema
			const propertyMetadata = getPropertyMetadata(channel.category, syntheticProp.propertyCategory);

			if (!propertyMetadata) {
				this.logger.warn(
					`[SHELLY V1][MAPPER] No schema metadata found for synthetic property ${syntheticProp.propertyCategory} in channel ${channel.category}`,
				);
				continue;
			}

			this.logger.debug(
				`[SHELLY V1][MAPPER] Creating/updating synthetic property ${syntheticProp.propertyCategory} in channel ${channel.identifier} with derived value: ${syntheticValue}`,
			);

			// Create or update the synthetic property
			await this.createOrUpdateProperty(channel, {
				identifier: `${syntheticProp.propertyCategory.toLowerCase()}`,
				name: this.formatPropertyName(syntheticProp.propertyCategory.toLowerCase()),
				category: syntheticProp.propertyCategory,
				dataType: propertyMetadata.data_type,
				permissions: propertyMetadata.permissions,
				unit: propertyMetadata.unit ?? undefined,
				format: propertyMetadata.format ?? undefined,
				value: syntheticValue,
			});
		}
	}

	/**
	 * Create or update a property with its initial value
	 */
	private async createOrUpdateProperty(
		channel: ShellyV1ChannelEntity,
		propDef: {
			identifier: string;
			name: string;
			category: PropertyCategory;
			dataType: DataTypeType;
			permissions?: PermissionType[];
			unit?: string;
			format?: number[] | string[];
			value?: string | number | boolean | null;
		},
	): Promise<void> {
		// Check if a property already exists
		const existingProperty = await this.channelsPropertiesService.findOneBy<ShellyV1ChannelPropertyEntity>(
			'identifier',
			propDef.identifier,
			channel.id,
			DEVICES_SHELLY_V1_TYPE,
		);

		if (!existingProperty) {
			this.logger.debug(
				`[SHELLY V1][MAPPER] Creating property: ${propDef.identifier} for channel ${channel.identifier}`,
			);

			const createPropertyDto: CreateShellyV1ChannelPropertyDto = {
				type: DEVICES_SHELLY_V1_TYPE,
				identifier: propDef.identifier,
				name: propDef.name,
				category: propDef.category,
				data_type: propDef.dataType,
				permissions: propDef.permissions || [PermissionType.READ_ONLY],
				...(propDef.unit !== undefined && { unit: propDef.unit }),
				...(propDef.format !== undefined && { format: propDef.format }),
				...(propDef.value !== undefined && propDef.value !== null && { value: propDef.value }),
			};

			await this.channelsPropertiesService.create<ShellyV1ChannelPropertyEntity, CreateShellyV1ChannelPropertyDto>(
				channel.id,
				createPropertyDto,
			);
		} else {
			// Update existing property metadata and value (preserve name and description)
			this.logger.debug(
				`[SHELLY V1][MAPPER] Updating property metadata: ${propDef.identifier} for channel ${channel.identifier}`,
			);

			await this.channelsPropertiesService.update<ShellyV1ChannelPropertyEntity, UpdateShellyV1ChannelPropertyDto>(
				existingProperty.id,
				toInstance(UpdateShellyV1ChannelPropertyDto, {
					type: DEVICES_SHELLY_V1_TYPE,
					// Don't update identifier or name - preserve user configuration
					category: propDef.category,
					data_type: propDef.dataType,
					permissions: propDef.permissions || [PermissionType.READ_ONLY],
					...(propDef.unit !== undefined && { unit: propDef.unit }),
					...(propDef.format !== undefined && { format: propDef.format }),
					...(propDef.value !== undefined && propDef.value !== null && { value: propDef.value }),
				}),
			);
		}
	}

	/**
	 * Infer a channel category from its property bindings
	 * 1. If channelCategory is defined in PropertyBinding, use that
	 * 2. If not, try to find category in SHELLY_V1_CHANNEL_PREFIX_TO_CATEGORY by prefix
	 * 3. If not found, use default property-based mapping
	 */
	private inferChannelCategory(channelIdentifier: string, bindings: PropertyBinding[]): ChannelCategory {
		// Step 1: Check if any binding has an explicit channelCategory defined
		for (const binding of bindings) {
			if (binding.channelCategory !== undefined) {
				this.logger.debug(
					`[SHELLY V1][MAPPER] Using explicit channelCategory from binding: ${binding.channelCategory}`,
				);
				return binding.channelCategory;
			}
		}

		// Step 2: Try to find category by channel identifier prefix
		const prefix = channelIdentifier.split('_')[0];
		if (SHELLY_V1_CHANNEL_PREFIX_TO_CATEGORY[prefix]) {
			this.logger.debug(
				`[SHELLY V1][MAPPER] Found category by prefix '${prefix}': ${SHELLY_V1_CHANNEL_PREFIX_TO_CATEGORY[prefix]}`,
			);
			return SHELLY_V1_CHANNEL_PREFIX_TO_CATEGORY[prefix];
		}

		// Step 3: Fall back to property-based inference
		for (const binding of bindings) {
			switch (binding.category) {
				case PropertyCategory.ON:
				case PropertyCategory.BRIGHTNESS:
				case PropertyCategory.LEVEL:
					return ChannelCategory.LIGHT;
				case PropertyCategory.POWER:
					return ChannelCategory.ELECTRICAL_POWER;
				case PropertyCategory.CONSUMPTION:
					return ChannelCategory.ELECTRICAL_ENERGY;
				case PropertyCategory.TEMPERATURE:
					return ChannelCategory.TEMPERATURE;
				case PropertyCategory.HUMIDITY:
					return ChannelCategory.HUMIDITY;
				case PropertyCategory.DETECTED:
					return ChannelCategory.CONTACT;
			}
		}

		return ChannelCategory.GENERIC;
	}

	/**
	 * Format channel identifier into a human-readable name
	 */
	private formatChannelName(identifier: string): string {
		// Convert snake_case to Title Case
		return identifier
			.split('_')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	}

	/**
	 * Format property identifier into a human-readable name
	 */
	private formatPropertyName(identifier: string): string {
		// Convert snake_case to Title Case
		return identifier
			.split('_')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	}

	/**
	 * Find the descriptor for a device type
	 */
	private findDescriptor(deviceType: string): (typeof DESCRIPTORS)[keyof typeof DESCRIPTORS] | null {
		// Try to find by exact type match first
		for (const descriptor of Object.values(DESCRIPTORS)) {
			if (descriptor.models.some((model) => deviceType.toUpperCase().includes(model))) {
				return descriptor;
			}
		}

		// Fallback: try to match by partial name
		const typeUpper = deviceType.toUpperCase();

		for (const [key, descriptor] of Object.entries(DESCRIPTORS)) {
			if (typeUpper.includes(key) || descriptor.name.toUpperCase().includes(typeUpper)) {
				return descriptor;
			}
		}

		return null;
	}
}

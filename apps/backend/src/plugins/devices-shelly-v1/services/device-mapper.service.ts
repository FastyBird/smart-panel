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
	SHELLY_V1_CHANNEL_IDENTIFIERS,
	SHELLY_V1_DEVICE_INFO_PROPERTY_IDENTIFIERS,
} from '../devices-shelly-v1.constants';
import { DevicesShellyV1NotSupportedException } from '../devices-shelly-v1.exceptions';
import { CreateShellyV1ChannelPropertyDto } from '../dto/create-channel-property.dto';
import { CreateShellyV1ChannelDto } from '../dto/create-channel.dto';
import { CreateShellyV1DeviceDto } from '../dto/create-device.dto';
import { UpdateShellyV1ChannelPropertyDto } from '../dto/update-channel-property.dto';
import {
	ShellyV1ChannelEntity,
	ShellyV1ChannelPropertyEntity,
	ShellyV1DeviceEntity,
} from '../entities/devices-shelly-v1.entity';
import { NormalizedDeviceEvent, ShellyDevice } from '../interfaces/shellies.interface';

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
			this.logger.debug(`[SHELLY V1][MAPPER] Device already exists: ${event.id}`);
		}

		// Create device_information channel
		await this.createDeviceInformationChannel(device, shellyDevice);

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
	): Promise<void> {
		const channelIdentifier = SHELLY_V1_CHANNEL_IDENTIFIERS.DEVICE_INFORMATION;

		this.logger.debug(`[SHELLY V1][MAPPER] Fetching additional device info from ${shellyDevice.host}`);

		// Fetch additional device information from HTTP API
		let deviceInfo;
		let deviceStatus;

		try {
			[deviceInfo, deviceStatus] = await Promise.all([
				this.httpClient.getDeviceInfo(shellyDevice.host),
				this.httpClient.getDeviceStatus(shellyDevice.host),
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

		// Check if channel already exists
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
			value?: any;
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

		// Add mode property if device has it
		if (shellyDevice['mode']) {
			deviceInfoProperties.push({
				identifier: SHELLY_V1_DEVICE_INFO_PROPERTY_IDENTIFIERS.MODE,
				name: 'Mode',
				category: PropertyCategory.MODE,
				dataType: DataTypeType.STRING,
				value: shellyDevice['mode'],
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
		// Check if channel already exists
		let channel = await this.channelsService.findOneBy<ShellyV1ChannelEntity>(
			'identifier',
			channelIdentifier,
			device.id,
			DEVICES_SHELLY_V1_TYPE,
		);

		if (!channel) {
			this.logger.debug(`[SHELLY V1][MAPPER] Creating channel: ${channelIdentifier} for device ${device.identifier}`);

			const channelCategory = this.inferChannelCategory(bindings);
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

		// Create properties for the channel with initial values from device state
		for (const binding of bindings) {
			const initialValue = shellyDevice[binding.shelliesProperty];

			await this.createOrUpdateProperty(channel, {
				identifier: binding.propertyIdentifier,
				name: this.formatPropertyName(binding.propertyIdentifier),
				category: binding.category,
				dataType: binding.data_type,
				permissions: binding.permissions,
				unit: binding.unit,
				format: binding.format,
				value: initialValue !== undefined ? initialValue : null,
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
			value?: any;
		},
	): Promise<void> {
		// Check if property already exists
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
		} else if (propDef.value !== undefined && propDef.value !== null) {
			// Update existing property with new value if provided
			this.logger.debug(
				`[SHELLY V1][MAPPER] Updating property: ${propDef.identifier} for channel ${channel.identifier} with value: ${propDef.value}`,
			);

			await this.channelsPropertiesService.update<ShellyV1ChannelPropertyEntity, UpdateShellyV1ChannelPropertyDto>(
				existingProperty.id,
				toInstance(UpdateShellyV1ChannelPropertyDto, {
					type: DEVICES_SHELLY_V1_TYPE,
					identifier: propDef.identifier,
					name: propDef.name,
					category: propDef.category,
					data_type: propDef.dataType,
					permissions: propDef.permissions || [PermissionType.READ_ONLY],
					...(propDef.unit !== undefined && { unit: propDef.unit }),
					...(propDef.format !== undefined && { format: propDef.format }),
					value: propDef.value,
				}),
			);
		}
	}

	/**
	 * Infer channel category from its property bindings
	 */
	private inferChannelCategory(bindings: PropertyBinding[]): ChannelCategory {
		// Look for the most specific property category to infer channel category
		for (const binding of bindings) {
			switch (binding.category) {
				case PropertyCategory.ON:
				case PropertyCategory.BRIGHTNESS:
				case PropertyCategory.LEVEL:
					return ChannelCategory.LIGHT;
				case PropertyCategory.POWER:
				case PropertyCategory.CONSUMPTION:
					return ChannelCategory.ELECTRICAL_POWER;
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

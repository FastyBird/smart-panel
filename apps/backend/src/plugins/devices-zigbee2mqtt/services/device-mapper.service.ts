import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import {
	ChannelCategory,
	ConnectionState,
	DataTypeType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import {
	DEVICES_ZIGBEE2MQTT_PLUGIN_NAME,
	DEVICES_ZIGBEE2MQTT_TYPE,
	Z2M_CHANNEL_IDENTIFIERS,
	Z2M_DEVICE_INFO_PROPERTY_IDENTIFIERS,
	mapZ2mCategoryToDeviceCategory,
} from '../devices-zigbee2mqtt.constants';
import { CreateZigbee2mqttChannelPropertyDto } from '../dto/create-channel-property.dto';
import { CreateZigbee2mqttChannelDto } from '../dto/create-channel.dto';
import { CreateZigbee2mqttDeviceDto } from '../dto/create-device.dto';
import { UpdateZigbee2mqttChannelPropertyDto } from '../dto/update-channel-property.dto';
import {
	Zigbee2mqttChannelEntity,
	Zigbee2mqttChannelPropertyEntity,
	Zigbee2mqttDeviceEntity,
} from '../entities/devices-zigbee2mqtt.entity';
import { Z2mDevice, Z2mRegisteredDevice } from '../interfaces/zigbee2mqtt.interface';

import { MappedChannel, MappedProperty, Z2mExposesMapperService } from './exposes-mapper.service';

/**
 * Device Mapper Service
 *
 * Maps Zigbee2MQTT devices to Smart Panel entities (devices, channels, properties).
 *
 * Identifier mapping:
 * - Device identifier = friendly_name (for lookup by MQTT topic)
 * - Channel identifier = channel category or type_endpoint
 * - Property identifier = z2m property name (for matching MQTT state keys)
 */
@Injectable()
export class Z2mDeviceMapperService {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_ZIGBEE2MQTT_PLUGIN_NAME,
		'DeviceMapper',
	);

	// Per-device locks to prevent concurrent mapping of the same device
	private readonly deviceLocks = new Map<string, Promise<Zigbee2mqttDeviceEntity | null>>();

	constructor(
		private readonly devicesService: DevicesService,
		private readonly channelsService: ChannelsService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly deviceConnectivityService: DeviceConnectivityService,
		private readonly exposesMapper: Z2mExposesMapperService,
	) {}

	/**
	 * Map and create or update a device from Z2M registry
	 * @param z2mDevice The Z2M device to map
	 * @param createIfNotExists If true, creates new devices; if false, only updates existing devices
	 */
	async mapDevice(
		z2mDevice: Z2mDevice | Z2mRegisteredDevice,
		createIfNotExists: boolean = true,
	): Promise<Zigbee2mqttDeviceEntity | null> {
		const friendlyName = 'friendly_name' in z2mDevice ? z2mDevice.friendly_name : z2mDevice.friendlyName;

		// Use per-device lock to prevent concurrent mapping of the same device
		const existingLock = this.deviceLocks.get(friendlyName);
		if (existingLock !== undefined) {
			this.logger.debug(`Waiting for existing mapping operation for device: ${friendlyName}`);
			return existingLock;
		}

		const mappingPromise = this.doMapDevice(z2mDevice, createIfNotExists);
		this.deviceLocks.set(friendlyName, mappingPromise);

		try {
			return await mappingPromise;
		} finally {
			this.deviceLocks.delete(friendlyName);
		}
	}

	/**
	 * Internal device mapping logic
	 */
	private async doMapDevice(
		z2mDevice: Z2mDevice | Z2mRegisteredDevice,
		createIfNotExists: boolean,
	): Promise<Zigbee2mqttDeviceEntity | null> {
		const friendlyName = 'friendly_name' in z2mDevice ? z2mDevice.friendly_name : z2mDevice.friendlyName;
		const definition = z2mDevice.definition;

		if (!definition) {
			this.logger.debug(`Skipping device without definition: ${friendlyName}`);
			return null;
		}

		// Device identifier = friendly_name (used for MQTT topic matching)
		const identifier = friendlyName;

		this.logger.log(`Mapping device: ${friendlyName}`);

		// Determine device category from exposes
		const exposeTypes = definition.exposes.map((e) => e.type);
		const propertyNames = definition.exposes.map((e) => e.name ?? e.property).filter((n): n is string => !!n);
		const deviceCategory = mapZ2mCategoryToDeviceCategory(exposeTypes, propertyNames);

		// Create or update device
		let device = await this.devicesService.findOneBy<Zigbee2mqttDeviceEntity>(
			'identifier',
			identifier,
			DEVICES_ZIGBEE2MQTT_TYPE,
		);

		if (!device) {
			if (!createIfNotExists) {
				this.logger.debug(`Skipping new device (auto-add disabled): ${friendlyName}`);
				return null;
			}

			this.logger.log(`Creating new device: ${identifier}`);

			const createDto: CreateZigbee2mqttDeviceDto = {
				type: DEVICES_ZIGBEE2MQTT_TYPE,
				identifier,
				name: friendlyName,
				category: deviceCategory,
				enabled: true,
			};

			device = await this.devicesService.create<Zigbee2mqttDeviceEntity, CreateZigbee2mqttDeviceDto>(createDto);
		}

		// Skip channel/property creation if device is disabled
		if (!device.enabled) {
			this.logger.debug(`Device ${identifier} is disabled, skipping channel creation`);
			return device;
		}

		// Create device information channel
		await this.createDeviceInfoChannel(device, z2mDevice);

		// Map exposes to channels and properties
		const mappedChannels = this.exposesMapper.mapExposes(definition.exposes);
		await this.createChannelsAndProperties(device, mappedChannels);

		return device;
	}

	/**
	 * Update device state from MQTT state message
	 * Device is found by identifier (which equals friendly_name)
	 * Properties are matched by identifier (which equals z2m property name)
	 */
	async updateDeviceState(friendlyName: string, state: Record<string, unknown>): Promise<void> {
		// Find device by identifier (= friendly_name)
		const device = await this.devicesService.findOneBy<Zigbee2mqttDeviceEntity>(
			'identifier',
			friendlyName,
			DEVICES_ZIGBEE2MQTT_TYPE,
		);

		if (!device) {
			this.logger.debug(`Device not found for state update: ${friendlyName}`);
			return;
		}

		if (!device.enabled) {
			return;
		}

		this.logger.debug(`Updating state for ${friendlyName}: ${JSON.stringify(state)}`);

		// Get all channels for this device
		const channels = await this.channelsService.findAll<Zigbee2mqttChannelEntity>(device.id, DEVICES_ZIGBEE2MQTT_TYPE);

		this.logger.debug(`Found ${channels.length} channels for device ${friendlyName}`);

		for (const channel of channels) {
			// Get all properties for this channel
			const properties = await this.channelsPropertiesService.findAll<Zigbee2mqttChannelPropertyEntity>(
				channel.id,
				DEVICES_ZIGBEE2MQTT_TYPE,
			);

			for (const property of properties) {
				// Property identifier = z2m property name
				const z2mProperty = property.identifier;

				if (!(z2mProperty in state)) {
					continue;
				}

				const value = state[z2mProperty];

				// Convert value to appropriate type
				const convertedValue = this.convertValue(value);

				this.logger.debug(`Updating property ${property.identifier} = ${JSON.stringify(value)} -> ${convertedValue}`);

				// Update property value
				await this.channelsPropertiesService.update<
					Zigbee2mqttChannelPropertyEntity,
					UpdateZigbee2mqttChannelPropertyDto
				>(
					property.id,
					toInstance(UpdateZigbee2mqttChannelPropertyDto, {
						type: DEVICES_ZIGBEE2MQTT_TYPE,
						value: convertedValue,
					}),
				);
			}
		}
	}

	/**
	 * Set device availability state
	 * Device is found by identifier (which equals friendly_name)
	 */
	async setDeviceAvailability(friendlyName: string, available: boolean): Promise<void> {
		this.logger.debug(`Setting availability for ${friendlyName}: ${available}`);

		const device = await this.devicesService.findOneBy<Zigbee2mqttDeviceEntity>(
			'identifier',
			friendlyName,
			DEVICES_ZIGBEE2MQTT_TYPE,
		);

		if (device) {
			this.logger.debug(`Found device ${device.identifier} for availability update`);
			await this.deviceConnectivityService.setConnectionState(device.id, {
				state: available ? ConnectionState.CONNECTED : ConnectionState.DISCONNECTED,
			});
		} else {
			this.logger.error(`Device not found for availability update: ${friendlyName}`);
		}
	}

	/**
	 * Set device connection state by identifier
	 */
	async setDeviceConnectionState(identifier: string, state: ConnectionState): Promise<void> {
		const device = await this.devicesService.findOneBy<Zigbee2mqttDeviceEntity>(
			'identifier',
			identifier,
			DEVICES_ZIGBEE2MQTT_TYPE,
		);

		if (device) {
			await this.deviceConnectivityService.setConnectionState(device.id, { state });
		}
	}

	/**
	 * Get all devices
	 */
	async getAllDevices(): Promise<Zigbee2mqttDeviceEntity[]> {
		return this.devicesService.findAll<Zigbee2mqttDeviceEntity>(DEVICES_ZIGBEE2MQTT_TYPE);
	}

	/**
	 * Create device information channel
	 */
	private async createDeviceInfoChannel(
		device: Zigbee2mqttDeviceEntity,
		z2mDevice: Z2mDevice | Z2mRegisteredDevice,
	): Promise<void> {
		const channelIdentifier = Z2M_CHANNEL_IDENTIFIERS.DEVICE_INFORMATION;
		const definition = z2mDevice.definition;
		const ieeeAddress = 'ieee_address' in z2mDevice ? z2mDevice.ieee_address : z2mDevice.ieeeAddress;

		// Find or create channel
		let channel = await this.channelsService.findOneBy<Zigbee2mqttChannelEntity>(
			'identifier',
			channelIdentifier,
			device.id,
			DEVICES_ZIGBEE2MQTT_TYPE,
		);

		if (!channel) {
			const createChannelDto: CreateZigbee2mqttChannelDto = {
				type: DEVICES_ZIGBEE2MQTT_TYPE,
				identifier: channelIdentifier,
				name: 'Device Information',
				category: ChannelCategory.DEVICE_INFORMATION,
				device: device.id,
			};

			channel = await this.channelsService.create<Zigbee2mqttChannelEntity, CreateZigbee2mqttChannelDto>(
				createChannelDto,
			);
		}

		// Create/update device info properties
		// Properties must match the device_information channel spec
		const infoProperties = [
			{
				identifier: Z2M_DEVICE_INFO_PROPERTY_IDENTIFIERS.MANUFACTURER,
				name: 'Manufacturer',
				category: PropertyCategory.MANUFACTURER,
				value: definition?.vendor ?? 'Unknown',
			},
			{
				identifier: Z2M_DEVICE_INFO_PROPERTY_IDENTIFIERS.MODEL,
				name: 'Model',
				category: PropertyCategory.MODEL,
				value: definition?.model ?? 'Unknown',
			},
			{
				identifier: Z2M_DEVICE_INFO_PROPERTY_IDENTIFIERS.SERIAL_NUMBER,
				name: 'Serial Number',
				category: PropertyCategory.SERIAL_NUMBER,
				value: ieeeAddress,
			},
			{
				identifier: Z2M_DEVICE_INFO_PROPERTY_IDENTIFIERS.FIRMWARE_REVISION,
				name: 'Firmware Revision',
				category: PropertyCategory.FIRMWARE_REVISION,
				value: 'Unknown',
			},
		];

		for (const info of infoProperties) {
			await this.createOrUpdateInfoProperty(channel, info.identifier, info.name, info.category, info.value);
		}
	}

	/**
	 * Create or update an info property
	 */
	private async createOrUpdateInfoProperty(
		channel: Zigbee2mqttChannelEntity,
		identifier: string,
		name: string,
		category: PropertyCategory,
		value: string,
	): Promise<void> {
		const property = await this.channelsPropertiesService.findOneBy<Zigbee2mqttChannelPropertyEntity>(
			'identifier',
			identifier,
			channel.id,
			DEVICES_ZIGBEE2MQTT_TYPE,
		);

		if (!property) {
			const createDto: CreateZigbee2mqttChannelPropertyDto = {
				type: DEVICES_ZIGBEE2MQTT_TYPE,
				identifier,
				name,
				category,
				data_type: DataTypeType.STRING,
				permissions: [PermissionType.READ_ONLY],
				value,
			};

			await this.channelsPropertiesService.create<
				Zigbee2mqttChannelPropertyEntity,
				CreateZigbee2mqttChannelPropertyDto
			>(channel.id, createDto);
		} else {
			await this.channelsPropertiesService.update<
				Zigbee2mqttChannelPropertyEntity,
				UpdateZigbee2mqttChannelPropertyDto
			>(
				property.id,
				toInstance(UpdateZigbee2mqttChannelPropertyDto, {
					type: DEVICES_ZIGBEE2MQTT_TYPE,
					value,
				}),
			);
		}
	}

	/**
	 * Create channels and properties from mapped structure
	 */
	private async createChannelsAndProperties(
		device: Zigbee2mqttDeviceEntity,
		mappedChannels: MappedChannel[],
	): Promise<void> {
		// Group properties by channel to merge sensor channels
		const channelMap = new Map<string, MappedChannel>();

		for (const mappedChannel of mappedChannels) {
			const existing = channelMap.get(mappedChannel.identifier);
			if (existing) {
				// Merge properties into existing channel
				// Use z2mProperty for deduplication since multiple Z2M properties can map to the same
				// spec identifier (e.g., local_temperature and current_heating_setpoint both map to 'temperature')
				for (const prop of mappedChannel.properties) {
					if (!existing.properties.find((p) => p.z2mProperty === prop.z2mProperty)) {
						existing.properties.push(prop);
					}
				}
			} else {
				channelMap.set(mappedChannel.identifier, { ...mappedChannel });
			}
		}

		// Create each channel
		for (const mappedChannel of channelMap.values()) {
			await this.createChannel(device, mappedChannel);
		}
	}

	/**
	 * Create a single channel with its properties
	 */
	private async createChannel(device: Zigbee2mqttDeviceEntity, mappedChannel: MappedChannel): Promise<void> {
		// Find or create channel
		let channel = await this.channelsService.findOneBy<Zigbee2mqttChannelEntity>(
			'identifier',
			mappedChannel.identifier,
			device.id,
			DEVICES_ZIGBEE2MQTT_TYPE,
		);

		if (!channel) {
			const createChannelDto: CreateZigbee2mqttChannelDto = {
				type: DEVICES_ZIGBEE2MQTT_TYPE,
				identifier: mappedChannel.identifier,
				name: mappedChannel.name,
				category: mappedChannel.category,
				device: device.id,
			};

			channel = await this.channelsService.create<Zigbee2mqttChannelEntity, CreateZigbee2mqttChannelDto>(
				createChannelDto,
			);
		}

		// Create properties
		for (const mappedProperty of mappedChannel.properties) {
			await this.createProperty(channel, mappedProperty);
		}
	}

	/**
	 * Create a single property
	 * Property identifier = z2mProperty (for matching MQTT state keys)
	 */
	private async createProperty(channel: Zigbee2mqttChannelEntity, mappedProperty: MappedProperty): Promise<void> {
		// Use z2mProperty as identifier for direct MQTT state matching
		const propertyIdentifier = mappedProperty.z2mProperty;

		const property = await this.channelsPropertiesService.findOneBy<Zigbee2mqttChannelPropertyEntity>(
			'identifier',
			propertyIdentifier,
			channel.id,
			DEVICES_ZIGBEE2MQTT_TYPE,
		);

		if (!property) {
			const format =
				mappedProperty.format && mappedProperty.format.length > 0
					? Array.isArray(mappedProperty.format) &&
						mappedProperty.format.length === 2 &&
						typeof mappedProperty.format[0] === 'number'
						? (mappedProperty.format as [number, number])
						: (mappedProperty.format as string[])
					: null;

			const createDto: CreateZigbee2mqttChannelPropertyDto = {
				type: DEVICES_ZIGBEE2MQTT_TYPE,
				identifier: propertyIdentifier,
				name: mappedProperty.name,
				category: mappedProperty.category,
				data_type: mappedProperty.dataType,
				permissions: mappedProperty.permissions,
				unit: mappedProperty.unit ?? null,
				format,
				step: mappedProperty.step ?? null,
			};

			await this.channelsPropertiesService.create<
				Zigbee2mqttChannelPropertyEntity,
				CreateZigbee2mqttChannelPropertyDto
			>(channel.id, createDto);
		}
	}

	/**
	 * Convert value to appropriate type
	 */
	private convertValue(value: unknown): string | number | boolean {
		if (typeof value === 'boolean') {
			return value;
		}
		if (typeof value === 'number') {
			return value;
		}
		if (typeof value === 'string') {
			return value;
		}
		if (typeof value === 'object' && value !== null) {
			return JSON.stringify(value);
		}
		// For null, undefined, or other primitives
		return value === null ? 'null' : value === undefined ? 'undefined' : JSON.stringify(value);
	}
}

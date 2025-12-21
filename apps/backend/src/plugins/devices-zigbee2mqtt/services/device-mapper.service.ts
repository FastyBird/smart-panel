import { Injectable, Logger } from '@nestjs/common';

import { toInstance } from '../../../common/utils/transform.utils';
import {
	ChannelCategory,
	ConnectionState,
	DataTypeType,
	PermissionType,
} from '../../../modules/devices/devices.constants';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import {
	DEVICES_ZIGBEE2MQTT_TYPE,
	Z2M_CHANNEL_IDENTIFIERS,
	Z2M_DEVICE_INFO_PROPERTY_IDENTIFIERS,
	mapZ2mCategoryToDeviceCategory,
} from '../devices-zigbee2mqtt.constants';
import { CreateZigbee2mqttChannelPropertyDto } from '../dto/create-channel-property.dto';
import { CreateZigbee2mqttChannelDto } from '../dto/create-channel.dto';
import { CreateZigbee2mqttDeviceDto } from '../dto/create-device.dto';
import { UpdateZigbee2mqttChannelPropertyDto } from '../dto/update-channel-property.dto';
import { UpdateZigbee2mqttDeviceDto } from '../dto/update-device.dto';
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
 */
@Injectable()
export class Z2mDeviceMapperService {
	private readonly logger = new Logger(Z2mDeviceMapperService.name);

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
		const ieeeAddress = 'ieee_address' in z2mDevice ? z2mDevice.ieee_address : z2mDevice.ieeeAddress;
		const friendlyName = 'friendly_name' in z2mDevice ? z2mDevice.friendly_name : z2mDevice.friendlyName;
		const modelId = 'model_id' in z2mDevice ? z2mDevice.model_id : (z2mDevice as Z2mRegisteredDevice).modelId;
		const definition = z2mDevice.definition;

		if (!definition) {
			this.logger.debug(`[Z2M][MAPPER] Skipping device without definition: ${friendlyName}`);
			return null;
		}

		// Generate identifier from IEEE address
		const identifier = this.generateIdentifier(ieeeAddress);

		this.logger.log(`[Z2M][MAPPER] Mapping device: ${friendlyName} (${identifier})`);

		// Determine device category from exposes
		const exposeTypes = definition.exposes.map((e) => e.type);
		const deviceCategory = mapZ2mCategoryToDeviceCategory(exposeTypes);

		// Create or update device
		let device = await this.devicesService.findOneBy<Zigbee2mqttDeviceEntity>(
			'identifier',
			identifier,
			DEVICES_ZIGBEE2MQTT_TYPE,
		);

		if (!device) {
			if (!createIfNotExists) {
				this.logger.debug(`[Z2M][MAPPER] Skipping new device (auto-add disabled): ${friendlyName}`);
				return null;
			}

			this.logger.log(`[Z2M][MAPPER] Creating new device: ${identifier}`);

			const createDto: CreateZigbee2mqttDeviceDto = {
				type: DEVICES_ZIGBEE2MQTT_TYPE,
				identifier,
				name: friendlyName,
				category: deviceCategory,
				enabled: true,
				ieeeAddress,
				friendlyName,
				modelId: modelId ?? null,
			};

			device = await this.devicesService.create<Zigbee2mqttDeviceEntity, CreateZigbee2mqttDeviceDto>(createDto);
		} else {
			// Update device if friendly name or model changed
			if (device.friendlyName !== friendlyName || device.modelId !== modelId) {
				this.logger.debug(`[Z2M][MAPPER] Updating device: ${identifier}`);

				const updateDto: UpdateZigbee2mqttDeviceDto = {
					type: DEVICES_ZIGBEE2MQTT_TYPE,
					friendlyName,
					modelId: modelId ?? null,
				};

				device = await this.devicesService.update<Zigbee2mqttDeviceEntity, UpdateZigbee2mqttDeviceDto>(
					device.id,
					updateDto,
				);
			}
		}

		// Skip channel/property creation if device is disabled
		if (!device.enabled) {
			this.logger.debug(`[Z2M][MAPPER] Device ${identifier} is disabled, skipping channel creation`);
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
	 */
	async updateDeviceState(friendlyName: string, state: Record<string, unknown>): Promise<void> {
		// Find device by friendly name
		const device = await this.findDeviceByFriendlyName(friendlyName);

		if (!device) {
			this.logger.debug(`[Z2M][MAPPER] Device not found for state update: ${friendlyName}`);
			return;
		}

		if (!device.enabled) {
			return;
		}

		// Get all channels for this device
		const channels = await this.channelsService.findAll<Zigbee2mqttChannelEntity>(device.id, DEVICES_ZIGBEE2MQTT_TYPE);

		for (const channel of channels) {
			// Get all properties for this channel
			const properties = await this.channelsPropertiesService.findAll<Zigbee2mqttChannelPropertyEntity>(
				channel.id,
				DEVICES_ZIGBEE2MQTT_TYPE,
			);

			for (const property of properties) {
				// Check if state contains this property
				const z2mProperty = property.z2mProperty;
				if (z2mProperty && z2mProperty in state) {
					const value = state[z2mProperty];

					// Convert value to appropriate type
					const convertedValue = this.convertValue(value);

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
	}

	/**
	 * Set device availability state
	 */
	async setDeviceAvailability(friendlyName: string, available: boolean): Promise<void> {
		const device = await this.findDeviceByFriendlyName(friendlyName);

		if (device) {
			await this.deviceConnectivityService.setConnectionState(device.id, {
				state: available ? ConnectionState.CONNECTED : ConnectionState.DISCONNECTED,
			});
		}
	}

	/**
	 * Set device connection state
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
	 * Find device by friendly name
	 */
	async findDeviceByFriendlyName(friendlyName: string): Promise<Zigbee2mqttDeviceEntity | null> {
		const devices = await this.devicesService.findAll<Zigbee2mqttDeviceEntity>(DEVICES_ZIGBEE2MQTT_TYPE);
		return devices.find((d) => d.friendlyName === friendlyName) ?? null;
	}

	/**
	 * Get all devices
	 */
	async getAllDevices(): Promise<Zigbee2mqttDeviceEntity[]> {
		return this.devicesService.findAll<Zigbee2mqttDeviceEntity>(DEVICES_ZIGBEE2MQTT_TYPE);
	}

	/**
	 * Generate identifier from IEEE address
	 */
	private generateIdentifier(ieeeAddress: string): string {
		// Remove 0x prefix and convert to lowercase
		const cleanAddress = ieeeAddress.replace('0x', '').toLowerCase();
		return `z2m-${cleanAddress.slice(-8)}`;
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
		const powerSource =
			'power_source' in z2mDevice ? z2mDevice.power_source : (z2mDevice as Z2mRegisteredDevice).powerSource;

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
		const infoProperties = [
			{
				identifier: Z2M_DEVICE_INFO_PROPERTY_IDENTIFIERS.MANUFACTURER,
				name: 'Manufacturer',
				value: definition?.vendor ?? 'Unknown',
			},
			{
				identifier: Z2M_DEVICE_INFO_PROPERTY_IDENTIFIERS.MODEL,
				name: 'Model',
				value: definition?.model ?? 'Unknown',
			},
			{
				identifier: Z2M_DEVICE_INFO_PROPERTY_IDENTIFIERS.IEEE_ADDRESS,
				name: 'IEEE Address',
				value: ieeeAddress,
			},
			{
				identifier: Z2M_DEVICE_INFO_PROPERTY_IDENTIFIERS.POWER_SOURCE,
				name: 'Power Source',
				value: powerSource ?? 'Unknown',
			},
		];

		for (const info of infoProperties) {
			await this.createOrUpdateInfoProperty(channel, info.identifier, info.name, info.value);
		}
	}

	/**
	 * Create or update an info property
	 */
	private async createOrUpdateInfoProperty(
		channel: Zigbee2mqttChannelEntity,
		identifier: string,
		name: string,
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
				category: null,
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
				for (const prop of mappedChannel.properties) {
					if (!existing.properties.find((p) => p.identifier === prop.identifier)) {
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
				endpoint: mappedChannel.endpoint ?? null,
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
	 */
	private async createProperty(channel: Zigbee2mqttChannelEntity, mappedProperty: MappedProperty): Promise<void> {
		const property = await this.channelsPropertiesService.findOneBy<Zigbee2mqttChannelPropertyEntity>(
			'identifier',
			mappedProperty.identifier,
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
				identifier: mappedProperty.identifier,
				name: mappedProperty.name,
				category: mappedProperty.category,
				data_type: mappedProperty.dataType,
				permissions: mappedProperty.permissions,
				unit: mappedProperty.unit ?? null,
				format,
				step: mappedProperty.step ?? null,
				z2mProperty: mappedProperty.z2mProperty,
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

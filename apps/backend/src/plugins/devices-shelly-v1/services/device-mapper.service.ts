import { Injectable, Logger } from '@nestjs/common';

import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { ComponentSpec, ComponentType, DESCRIPTORS, DEVICES_SHELLY_V1_TYPE } from '../devices-shelly-v1.constants';
import { CreateShellyV1ChannelPropertyDto } from '../dto/create-channel-property.dto';
import { CreateShellyV1ChannelDto } from '../dto/create-channel.dto';
import { CreateShellyV1DeviceDto } from '../dto/create-device.dto';
import {
	ShellyV1ChannelEntity,
	ShellyV1ChannelPropertyEntity,
	ShellyV1DeviceEntity,
} from '../entities/devices-shelly-v1.entity';
import { NormalizedDeviceEvent } from '../interfaces/shellies.interface';

interface ChannelPropertyDefinition {
	identifier: string;
	name: string;
	category: PropertyCategory;
	data_type: DataTypeType;
	permissions: PermissionType[];
	unit?: string;
	format?: number[];
}

@Injectable()
export class DeviceMapperService {
	private readonly logger = new Logger(DeviceMapperService.name);

	constructor(
		private readonly devicesService: DevicesService,
		private readonly channelsService: ChannelsService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
	) {}

	/**
	 * Map and create or update a discovered device
	 */
	async mapDevice(event: NormalizedDeviceEvent): Promise<ShellyV1DeviceEntity> {
		this.logger.debug(`Mapping device: ${event.id} (${event.type})`);

		// Find the device descriptor for this device type
		const descriptor = this.findDescriptor(event.type);

		if (!descriptor) {
			this.logger.warn(`No descriptor found for device type: ${event.type}`);
			throw new Error(`Unsupported device type: ${event.type}`);
		}

		// Create or update the device entity
		let device = await this.devicesService.findOne<ShellyV1DeviceEntity>(event.id, DEVICES_SHELLY_V1_TYPE);

		if (!device) {
			this.logger.log(`Creating new device: ${event.id}`);

			const createDto: CreateShellyV1DeviceDto = {
				type: DEVICES_SHELLY_V1_TYPE,
				identifier: event.id,
				name: event.id,
				category: descriptor.categories[0] || DeviceCategory.GENERIC,
				enabled: true,
				hostname: event.host,
			};

			device = await this.devicesService.create<ShellyV1DeviceEntity, CreateShellyV1DeviceDto>(createDto);
		} else {
			this.logger.debug(`Device already exists: ${event.id}`);
		}

		// Create channels for the device
		await this.createChannels(device, descriptor.components);

		return device;
	}

	/**
	 * Create channels for a device based on its components
	 */
	private async createChannels(device: ShellyV1DeviceEntity, components: ComponentSpec[]): Promise<void> {
		for (const component of components) {
			const channelIdentifier = `${component.type}_${component.id}`;

			// Check if channel already exists
			let channel = await this.channelsService.findOne<ShellyV1ChannelEntity>(
				device.id,
				channelIdentifier,
				DEVICES_SHELLY_V1_TYPE,
			);

			if (!channel) {
				this.logger.debug(`Creating channel: ${channelIdentifier} for device ${device.identifier}`);

				const channelCategory = this.getChannelCategory(component.type);
				const channelName = this.getChannelName(component.type, component.id);

				const createChannelDto: CreateShellyV1ChannelDto = {
					type: DEVICES_SHELLY_V1_TYPE,
					device: device.id,
					identifier: channelIdentifier,
					name: channelName,
					category: channelCategory,
				};

				channel = await this.channelsService.create<ShellyV1ChannelEntity, CreateShellyV1ChannelDto>(createChannelDto);
			}

			// Create properties for the channel
			await this.createProperties(channel, component.type);
		}
	}

	/**
	 * Create properties for a channel based on its component type
	 */
	private async createProperties(channel: ShellyV1ChannelEntity, componentType: ComponentType): Promise<void> {
		const properties = this.getPropertiesForComponent(componentType);

		for (const propDef of properties) {
			// Check if property already exists
			const existingProperty = await this.channelsPropertiesService.findOne<ShellyV1ChannelPropertyEntity>(
				channel.id,
				propDef.identifier,
				DEVICES_SHELLY_V1_TYPE,
			);

			if (!existingProperty) {
				this.logger.debug(`Creating property: ${propDef.identifier} for channel ${channel.identifier}`);

				const createPropertyDto: CreateShellyV1ChannelPropertyDto = {
					type: DEVICES_SHELLY_V1_TYPE,
					identifier: propDef.identifier,
					name: propDef.name,
					category: propDef.category,
					data_type: propDef.data_type,
					permissions: propDef.permissions,
					...(propDef.unit !== undefined && { unit: propDef.unit }),
					...(propDef.format !== undefined && { format: propDef.format }),
				};

				await this.channelsPropertiesService.create<ShellyV1ChannelPropertyEntity, CreateShellyV1ChannelPropertyDto>(
					channel.id,
					createPropertyDto,
				);
			}
		}
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

	/**
	 * Get the channel category for a component type
	 */
	private getChannelCategory(componentType: ComponentType): ChannelCategory {
		switch (componentType) {
			case ComponentType.RELAY:
				return ChannelCategory.OUTLET;
			case ComponentType.DIMMER:
			case ComponentType.LIGHT:
				return ChannelCategory.LIGHT;
			case ComponentType.ROLLER:
				return ChannelCategory.WINDOW_COVERING;
			case ComponentType.INPUT:
				return ChannelCategory.CONTACT;
			case ComponentType.TEMPERATURE:
				return ChannelCategory.TEMPERATURE;
			case ComponentType.HUMIDITY:
				return ChannelCategory.HUMIDITY;
			case ComponentType.POWER_METER:
				return ChannelCategory.ELECTRICAL_POWER;
			default:
				return ChannelCategory.GENERIC;
		}
	}

	/**
	 * Get a human-readable channel name
	 */
	private getChannelName(componentType: ComponentType, id: number): string {
		const baseName = componentType.charAt(0).toUpperCase() + componentType.slice(1);

		return `${baseName} ${id}`;
	}

	/**
	 * Create a property definition helper
	 */
	private createPropertyDef(
		identifier: string,
		name: string,
		category: PropertyCategory,
		data_type: DataTypeType,
		permissions: PermissionType[],
		options?: { unit?: string; format?: number[] },
	): ChannelPropertyDefinition {
		return {
			identifier,
			name,
			category,
			data_type,
			permissions,
			...options,
		};
	}

	/**
	 * Get properties for a component type
	 */
	private getPropertiesForComponent(componentType: ComponentType): ChannelPropertyDefinition[] {
		switch (componentType) {
			case ComponentType.RELAY:
				return [
					this.createPropertyDef('state', 'State', PropertyCategory.ON, DataTypeType.BOOL, [PermissionType.READ_WRITE]),
					this.createPropertyDef(
						'power',
						'Power',
						PropertyCategory.POWER,
						DataTypeType.FLOAT,
						[PermissionType.READ_ONLY],
						{
							unit: 'W',
						},
					),
				];

			case ComponentType.DIMMER:
			case ComponentType.LIGHT:
				return [
					this.createPropertyDef('state', 'State', PropertyCategory.ON, DataTypeType.BOOL, [PermissionType.READ_WRITE]),
					this.createPropertyDef(
						'brightness',
						'Brightness',
						PropertyCategory.BRIGHTNESS,
						DataTypeType.UINT,
						[PermissionType.READ_WRITE],
						{ unit: '%', format: [0, 100] },
					),
				];

			case ComponentType.ROLLER:
				return [
					this.createPropertyDef(
						'position',
						'Position',
						PropertyCategory.POSITION,
						DataTypeType.UINT,
						[PermissionType.READ_WRITE],
						{ unit: '%', format: [0, 100] },
					),
					this.createPropertyDef('state', 'State', PropertyCategory.STATUS, DataTypeType.STRING, [
						PermissionType.READ_ONLY,
					]),
				];

			case ComponentType.INPUT:
				return [
					this.createPropertyDef('state', 'State', PropertyCategory.DETECTED, DataTypeType.BOOL, [
						PermissionType.READ_ONLY,
					]),
				];

			case ComponentType.TEMPERATURE:
				return [
					this.createPropertyDef(
						'temperature',
						'Temperature',
						PropertyCategory.TEMPERATURE,
						DataTypeType.FLOAT,
						[PermissionType.READ_ONLY],
						{ unit: '°C' },
					),
				];

			case ComponentType.HUMIDITY:
				return [
					this.createPropertyDef(
						'humidity',
						'Humidity',
						PropertyCategory.HUMIDITY,
						DataTypeType.FLOAT,
						[PermissionType.READ_ONLY],
						{
							unit: '%',
						},
					),
				];

			case ComponentType.POWER_METER:
				return [
					this.createPropertyDef(
						'power',
						'Power',
						PropertyCategory.POWER,
						DataTypeType.FLOAT,
						[PermissionType.READ_ONLY],
						{
							unit: 'W',
						},
					),
					this.createPropertyDef(
						'energy',
						'Energy',
						PropertyCategory.CONSUMPTION,
						DataTypeType.FLOAT,
						[PermissionType.READ_ONLY],
						{ unit: 'Wh' },
					),
				];

			default:
				this.logger.warn(`No properties defined for component type: ${componentType}`);

				return [];
		}
	}
}

import { v4 as uuidv4 } from 'uuid';

import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger/extension-logger.service';
import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { CreateDeviceChannelPropertyDto } from '../../../modules/devices/dto/create-device-channel-property.dto';
import { CreateDeviceChannelDto } from '../../../modules/devices/dto/create-device-channel.dto';
import {
	PropertyMetadata,
	getAllProperties,
	getAllowedChannels,
	getPropertyDefaultValue,
} from '../../../modules/devices/utils/schema.utils';
import { DEVICES_SIMULATOR_PLUGIN_NAME, DEVICES_SIMULATOR_TYPE } from '../devices-simulator.constants';
import { GenerateDeviceDto } from '../dto/generate-device.dto';

interface GeneratedDeviceData {
	id: string;
	type: typeof DEVICES_SIMULATOR_TYPE;
	category: DeviceCategory;
	name: string;
	description: string | null;
	room_id: string | null;
	auto_simulate: boolean;
	simulate_interval: number;
	behavior_mode: string;
	channels: CreateDeviceChannelDto[];
}

@Injectable()
export class DeviceGeneratorService {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_SIMULATOR_PLUGIN_NAME,
		'DeviceGeneratorService',
	);

	/**
	 * Generate a complete device structure based on category
	 */
	generateDevice(dto: GenerateDeviceDto): GeneratedDeviceData {
		const deviceId = uuidv4();

		this.logger.log(`Generating simulated device for category: ${dto.category}`, { resource: deviceId });

		const channels = this.generateChannels(dto.category, dto.required_channels_only, dto.required_properties_only);

		return {
			id: deviceId,
			type: DEVICES_SIMULATOR_TYPE,
			category: dto.category,
			name: dto.name,
			description: dto.description ?? null,
			room_id: dto.room_id ?? null,
			auto_simulate: dto.auto_simulate ?? false,
			simulate_interval: dto.simulate_interval ?? 5000,
			behavior_mode: dto.behavior_mode ?? 'default',
			channels,
		};
	}

	/**
	 * Generate channels for a device category
	 */
	private generateChannels(
		deviceCategory: DeviceCategory,
		requiredOnly: boolean = false,
		requiredPropertiesOnly: boolean = false,
	): CreateDeviceChannelDto[] {
		const allowedChannels = getAllowedChannels(deviceCategory);
		const channels: CreateDeviceChannelDto[] = [];

		for (const channelSpec of allowedChannels) {
			// Skip optional channels if requiredOnly is true
			if (requiredOnly && !channelSpec.required) {
				continue;
			}

			const channelCategory = channelSpec.category;
			const properties = this.generateProperties(channelCategory, requiredPropertiesOnly);

			// Skip channels with no valid properties
			if (properties.length === 0) {
				continue;
			}

			const channel: CreateDeviceChannelDto = {
				id: uuidv4(),
				type: DEVICES_SIMULATOR_TYPE,
				category: channelCategory,
				name: this.formatChannelName(channelCategory),
				properties,
			};

			channels.push(channel);
		}

		return channels;
	}

	/**
	 * Generate properties for a channel category
	 */
	private generateProperties(
		channelCategory: ChannelCategory,
		requiredOnly: boolean = false,
	): CreateDeviceChannelPropertyDto[] {
		const allProperties = getAllProperties(channelCategory);
		const properties: CreateDeviceChannelPropertyDto[] = [];

		for (const propMeta of allProperties) {
			// Skip optional properties if requiredOnly is true
			if (requiredOnly && !propMeta.required) {
				continue;
			}

			// Skip properties with unknown data type
			if (propMeta.data_type === DataTypeType.UNKNOWN) {
				continue;
			}

			const defaultValue = this.generateInitialValue(channelCategory, propMeta);

			const property: CreateDeviceChannelPropertyDto = {
				id: uuidv4(),
				type: DEVICES_SIMULATOR_TYPE,
				category: propMeta.category,
				name: this.formatPropertyName(propMeta.category),
				permissions: propMeta.permissions,
				data_type: propMeta.data_type,
				format: propMeta.format,
				invalid: propMeta.invalid as string | number | boolean | undefined,
				step: propMeta.step,
				value: defaultValue,
			};

			properties.push(property);
		}

		return properties;
	}

	/**
	 * Generate an initial value for a property
	 */
	private generateInitialValue(
		channelCategory: ChannelCategory,
		propMeta: PropertyMetadata,
	): string | number | boolean | null {
		// Use schema default value if available
		const defaultValue = getPropertyDefaultValue(channelCategory, propMeta.category);
		if (defaultValue !== null) {
			return defaultValue;
		}

		// Generate a sensible default based on data type
		switch (propMeta.data_type) {
			case DataTypeType.BOOL:
				return false;

			case DataTypeType.ENUM:
				if (Array.isArray(propMeta.format) && propMeta.format.length > 0) {
					return propMeta.format[0] as string;
				}
				return null;

			case DataTypeType.STRING:
				return this.generateStringValue(propMeta.category);

			case DataTypeType.UCHAR:
			case DataTypeType.USHORT:
			case DataTypeType.UINT:
			case DataTypeType.CHAR:
			case DataTypeType.SHORT:
			case DataTypeType.INT:
			case DataTypeType.FLOAT:
				if (Array.isArray(propMeta.format) && propMeta.format.length === 2) {
					// Return min value from range
					return propMeta.format[0] as number;
				}
				return 0;

			default:
				return null;
		}
	}

	/**
	 * Generate a random value for a property based on its metadata
	 */
	generateRandomValue(propMeta: PropertyMetadata): string | number | boolean | null {
		switch (propMeta.data_type) {
			case DataTypeType.BOOL:
				return Math.random() > 0.5;

			case DataTypeType.ENUM:
				if (Array.isArray(propMeta.format) && propMeta.format.length > 0) {
					const randomIndex = Math.floor(Math.random() * propMeta.format.length);
					return propMeta.format[randomIndex] as string;
				}
				return null;

			case DataTypeType.STRING:
				return this.generateRandomStringValue(propMeta.category);

			case DataTypeType.UCHAR:
			case DataTypeType.CHAR:
				if (Array.isArray(propMeta.format) && propMeta.format.length === 2) {
					const min = propMeta.format[0] as number;
					const max = propMeta.format[1] as number;
					return Math.floor(Math.random() * (max - min + 1)) + min;
				}
				return Math.floor(Math.random() * 256);

			case DataTypeType.USHORT:
			case DataTypeType.SHORT:
				if (Array.isArray(propMeta.format) && propMeta.format.length === 2) {
					const min = propMeta.format[0] as number;
					const max = propMeta.format[1] as number;
					return Math.floor(Math.random() * (max - min + 1)) + min;
				}
				return Math.floor(Math.random() * 65536);

			case DataTypeType.UINT:
			case DataTypeType.INT:
				if (Array.isArray(propMeta.format) && propMeta.format.length === 2) {
					const min = propMeta.format[0] as number;
					const max = propMeta.format[1] as number;
					return Math.floor(Math.random() * (max - min + 1)) + min;
				}
				return Math.floor(Math.random() * 10000);

			case DataTypeType.FLOAT:
				if (Array.isArray(propMeta.format) && propMeta.format.length === 2) {
					const min = propMeta.format[0] as number;
					const max = propMeta.format[1] as number;
					const value = Math.random() * (max - min) + min;
					return Math.round(value * 100) / 100; // Round to 2 decimal places
				}
				return Math.round(Math.random() * 100 * 100) / 100;

			default:
				return null;
		}
	}

	/**
	 * Generate a string value based on property category (static for initial values)
	 */
	private generateStringValue(category: PropertyCategory): string {
		switch (category) {
			case PropertyCategory.MANUFACTURER:
				return 'FastyBird Simulator';
			case PropertyCategory.MODEL:
				return 'SIM-001';
			case PropertyCategory.SERIAL_NUMBER:
				return `SIM-${Date.now().toString(36).toUpperCase()}`;
			case PropertyCategory.FIRMWARE_REVISION:
				return '1.0.0';
			case PropertyCategory.HARDWARE_REVISION:
				return '1.0';
			case PropertyCategory.SOURCE:
				return 'simulator://local';
			case PropertyCategory.TRACK:
				return 'Simulated Track';
			default:
				return 'Simulated';
		}
	}

	/**
	 * Generate a random string value based on property category (for populate command)
	 */
	generateRandomStringValue(category: PropertyCategory): string {
		const randomHex = (length: number): string =>
			Array.from({ length }, () =>
				Math.floor(Math.random() * 16)
					.toString(16)
					.toUpperCase(),
			).join('');

		const randomVersion = (): string => {
			const major = Math.floor(Math.random() * 5) + 1;
			const minor = Math.floor(Math.random() * 10);
			const patch = Math.floor(Math.random() * 20);
			return `${major}.${minor}.${patch}`;
		};

		const manufacturers = [
			'FastyBird',
			'Acme Electronics',
			'SmartHome Corp',
			'TechVision',
			'IoT Devices Inc',
			'HomeConnect',
			'Nexus Systems',
			'Digital Home',
		];

		const prefixes = ['SIM', 'PRO', 'HOME', 'SMART', 'IOT', 'DEV'];
		const suffixes = ['', '-A', '-B', '-X', '-PRO', '-LITE'];
		const protocols = ['mqtt', 'http', 'coap', 'ws', 'zigbee', 'ble'];
		const tracks = [
			'Living Room Sensor',
			'Kitchen Monitor',
			'Bedroom Device',
			'Garage Unit',
			'Outdoor Station',
			'Basement Controller',
		];

		switch (category) {
			case PropertyCategory.MANUFACTURER:
				return manufacturers[Math.floor(Math.random() * manufacturers.length)];

			case PropertyCategory.MODEL: {
				const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
				const modelNum = Math.floor(Math.random() * 9000) + 1000;
				const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
				return `${prefix}-${modelNum}${suffix}`;
			}

			case PropertyCategory.SERIAL_NUMBER:
				// Format: XX-XXXXXXXX-XXXX (e.g., SN-A1B2C3D4-E5F6)
				return `SN-${randomHex(8)}-${randomHex(4)}`;

			case PropertyCategory.FIRMWARE_REVISION:
				return randomVersion();

			case PropertyCategory.HARDWARE_REVISION: {
				const hwMajor = Math.floor(Math.random() * 3) + 1;
				const hwMinor = Math.floor(Math.random() * 5);
				return `${hwMajor}.${hwMinor}`;
			}

			case PropertyCategory.SOURCE: {
				const protocol = protocols[Math.floor(Math.random() * protocols.length)];
				return `${protocol}://device-${randomHex(6).toLowerCase()}`;
			}

			case PropertyCategory.TRACK:
				return tracks[Math.floor(Math.random() * tracks.length)];

			default:
				return `Simulated-${randomHex(4)}`;
		}
	}

	/**
	 * Format channel category to human-readable name
	 */
	private formatChannelName(category: ChannelCategory): string {
		return category
			.split('_')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
			.join(' ');
	}

	/**
	 * Format property category to human-readable name
	 */
	private formatPropertyName(category: PropertyCategory): string {
		return category
			.split('_')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
			.join(' ');
	}
}

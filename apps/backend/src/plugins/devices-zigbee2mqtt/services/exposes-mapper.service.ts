/*
eslint-disable @typescript-eslint/no-unnecessary-type-assertion
*/
/*
Reason: Type assertions are needed to narrow Z2mExpose union type to
specific expose types since TypeScript cannot narrow discriminated unions.
*/
import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import {
	ChannelCategory,
	DataTypeType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import {
	COMMON_PROPERTY_MAPPINGS,
	DEVICES_ZIGBEE2MQTT_PLUGIN_NAME,
	Z2M_ACCESS,
	Z2M_CHANNEL_IDENTIFIERS,
	Z2M_GENERIC_TYPES,
	Z2M_SPECIFIC_TYPES,
	mapZ2mAccessToPermissions,
	mapZ2mExposeToChannelCategory,
	mapZ2mTypeToDataType,
} from '../devices-zigbee2mqtt.constants';
import {
	Z2mExpose,
	Z2mExposeBinary,
	Z2mExposeComposite,
	Z2mExposeEnum,
	Z2mExposeNumeric,
	Z2mExposeSpecific,
} from '../interfaces/zigbee2mqtt.interface';

/**
 * Mapped channel structure
 */
export interface MappedChannel {
	identifier: string;
	name: string;
	category: ChannelCategory;
	endpoint?: string;
	properties: MappedProperty[];
}

/**
 * Mapped property structure
 */
export interface MappedProperty {
	identifier: string;
	name: string;
	category: PropertyCategory;
	dataType: DataTypeType;
	permissions: PermissionType[];
	z2mProperty: string;
	unit?: string;
	format?: string[] | number[];
	min?: number;
	max?: number;
	step?: number;
}

/**
 * Exposes Mapper Service
 *
 * Maps Zigbee2MQTT exposes structure to Smart Panel channels and properties.
 */
@Injectable()
export class Z2mExposesMapperService {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_ZIGBEE2MQTT_PLUGIN_NAME,
		'ExposesMapper',
	);

	/**
	 * Map Z2M exposes to channels and properties
	 */
	mapExposes(exposes: Z2mExpose[]): MappedChannel[] {
		const channels: MappedChannel[] = [];

		for (const expose of exposes) {
			const mappedChannels = this.mapExpose(expose);
			channels.push(...mappedChannels);
		}

		return channels;
	}

	/**
	 * Map a single expose to one or more channels
	 */
	private mapExpose(expose: Z2mExpose): MappedChannel[] {
		const type = expose.type;

		// Handle specific types (light, switch, climate, etc.)
		if (Z2M_SPECIFIC_TYPES.includes(type as (typeof Z2M_SPECIFIC_TYPES)[number])) {
			return this.mapSpecificExpose(expose as Z2mExposeSpecific);
		}

		// Handle generic types (binary, numeric, enum, etc.)
		if (Z2M_GENERIC_TYPES.includes(type as (typeof Z2M_GENERIC_TYPES)[number])) {
			return this.mapGenericExpose(expose);
		}

		this.logger.debug(`Unknown expose type: ${type}`);
		return [];
	}

	/**
	 * Map specific expose types (light, switch, climate, etc.)
	 */
	private mapSpecificExpose(expose: Z2mExposeSpecific): MappedChannel[] {
		const category = mapZ2mExposeToChannelCategory(expose.type);
		const endpoint = expose.endpoint;
		const identifier = endpoint ? `${expose.type}_${endpoint}` : expose.type;

		const properties: MappedProperty[] = [];

		// Map features to properties
		for (const feature of expose.features || []) {
			const mappedProperty = this.mapFeatureToProperty(feature);
			if (mappedProperty) {
				properties.push(mappedProperty);
			}
		}

		if (properties.length === 0) {
			return [];
		}

		return [
			{
				identifier,
				name: this.formatChannelName(expose.type, endpoint),
				category,
				endpoint: endpoint ?? undefined,
				properties,
			},
		];
	}

	/**
	 * Map generic expose to a sensor channel
	 */
	private mapGenericExpose(expose: Z2mExpose): MappedChannel[] {
		// Skip config and diagnostic exposes
		if (expose.category === 'config' || expose.category === 'diagnostic') {
			return [];
		}

		const property = this.mapFeatureToProperty(expose);
		if (!property) {
			return [];
		}

		// Determine channel based on property type
		const channelInfo = this.determineChannelForProperty(property);

		return [
			{
				identifier: channelInfo.identifier,
				name: channelInfo.name,
				category: channelInfo.category,
				endpoint: expose.endpoint ?? undefined,
				properties: [property],
			},
		];
	}

	/**
	 * Map a feature/expose to a property
	 */
	private mapFeatureToProperty(expose: Z2mExpose): MappedProperty | null {
		const propertyName = expose.property ?? expose.name;
		if (!propertyName) {
			return null;
		}

		// Skip if no access or only GET access
		const access = expose.access ?? Z2M_ACCESS.STATE;
		if (access === 0 || access === Z2M_ACCESS.GET) {
			return null;
		}

		const permissions = mapZ2mAccessToPermissions(access);
		const label = expose.label ?? expose.name ?? propertyName;

		// Check for common property mappings
		const commonMapping = COMMON_PROPERTY_MAPPINGS[propertyName];

		// Determine data type based on expose type
		let dataType: DataTypeType;
		let format: string[] | number[] | undefined;
		let min: number | undefined;
		let max: number | undefined;
		let step: number | undefined;
		let unit: string | undefined;

		switch (expose.type) {
			case 'binary': {
				const binaryExpose = expose as Z2mExposeBinary;
				dataType = DataTypeType.BOOL;
				// Store value_on/value_off as format for string values
				// This includes 'true'/'false' strings which need to be sent as-is to the device
				if (typeof binaryExpose.value_on === 'string' && typeof binaryExpose.value_off === 'string') {
					format = [binaryExpose.value_on, binaryExpose.value_off];
				}
				break;
			}
			case 'numeric': {
				const numericExpose = expose as Z2mExposeNumeric;
				dataType = mapZ2mTypeToDataType('numeric', numericExpose.value_min, numericExpose.value_max);
				min = numericExpose.value_min;
				max = numericExpose.value_max;
				step = numericExpose.value_step;
				unit = numericExpose.unit ?? commonMapping?.unit;
				if (min !== undefined && max !== undefined) {
					format = [min, max];
				}
				break;
			}
			case 'enum': {
				const enumExpose = expose as Z2mExposeEnum;
				dataType = DataTypeType.STRING;
				format = enumExpose.values;
				break;
			}
			case 'text':
				dataType = DataTypeType.STRING;
				break;
			case 'composite': {
				// Handle composite types like color
				const compositeExpose = expose as Z2mExposeComposite;
				// For color, we store as JSON string
				dataType = DataTypeType.STRING;
				this.logger.debug(`Composite expose ${propertyName} with ${compositeExpose.features?.length ?? 0} features`);
				break;
			}
			default:
				dataType = commonMapping?.dataType ?? DataTypeType.STRING;
		}

		// Determine property category
		const category = commonMapping?.category ?? this.inferPropertyCategory(propertyName, expose.type);

		return {
			identifier: this.sanitizeIdentifier(propertyName),
			name: this.formatPropertyName(label),
			category,
			dataType,
			permissions,
			z2mProperty: propertyName,
			unit,
			format,
			min: min ?? commonMapping?.min,
			max: max ?? commonMapping?.max,
			step,
		};
	}

	/**
	 * Determine which channel a property belongs to
	 */
	private determineChannelForProperty(property: MappedProperty): {
		identifier: string;
		name: string;
		category: ChannelCategory;
	} {
		// Binary sensors
		if (
			property.dataType === DataTypeType.BOOL &&
			[PropertyCategory.DETECTED, PropertyCategory.FAULT].includes(property.category)
		) {
			return {
				identifier: Z2M_CHANNEL_IDENTIFIERS.BINARY_SENSOR,
				name: 'Binary Sensor',
				category: ChannelCategory.GENERIC,
			};
		}

		// Numeric sensors
		if (
			[
				PropertyCategory.TEMPERATURE,
				PropertyCategory.HUMIDITY,
				PropertyCategory.MEASURED,
				PropertyCategory.LEVEL,
				PropertyCategory.VOLTAGE,
				PropertyCategory.CURRENT,
				PropertyCategory.POWER,
				PropertyCategory.CONSUMPTION,
				PropertyCategory.LINK_QUALITY,
			].includes(property.category)
		) {
			return {
				identifier: Z2M_CHANNEL_IDENTIFIERS.SENSOR,
				name: 'Sensor',
				category: ChannelCategory.GENERIC,
			};
		}

		// Default to generic sensor
		return {
			identifier: Z2M_CHANNEL_IDENTIFIERS.SENSOR,
			name: 'Sensor',
			category: ChannelCategory.GENERIC,
		};
	}

	/**
	 * Infer property category from property name
	 */
	private inferPropertyCategory(propertyName: string, exposeType: string): PropertyCategory {
		const name = propertyName.toLowerCase();

		// Binary properties
		if (exposeType === 'binary') {
			if (name.includes('state') || name === 'on') {
				return PropertyCategory.ON;
			}
			if (name.includes('occupancy') || name.includes('presence') || name.includes('motion')) {
				return PropertyCategory.DETECTED;
			}
			if (name.includes('contact') || name.includes('door') || name.includes('window')) {
				return PropertyCategory.DETECTED;
			}
			if (name.includes('water') || name.includes('leak')) {
				return PropertyCategory.DETECTED;
			}
			if (name.includes('smoke') || name.includes('gas') || name.includes('co')) {
				return PropertyCategory.DETECTED;
			}
			if (name.includes('tamper')) {
				return PropertyCategory.DETECTED;
			}
			if (name.includes('battery_low') || name.includes('low_battery')) {
				return PropertyCategory.FAULT;
			}
			return PropertyCategory.STATUS;
		}

		// Numeric properties
		if (exposeType === 'numeric') {
			if (name.includes('temperature') || name.includes('temp')) {
				return PropertyCategory.TEMPERATURE;
			}
			if (name.includes('humidity')) {
				return PropertyCategory.HUMIDITY;
			}
			if (name.includes('pressure')) {
				return PropertyCategory.MEASURED;
			}
			if (name.includes('illuminance') || name.includes('lux') || name.includes('light')) {
				return PropertyCategory.MEASURED;
			}
			if (name.includes('battery')) {
				return PropertyCategory.LEVEL;
			}
			if (name.includes('voltage')) {
				return PropertyCategory.VOLTAGE;
			}
			if (name.includes('current')) {
				return PropertyCategory.CURRENT;
			}
			if (name.includes('power')) {
				return PropertyCategory.POWER;
			}
			if (name.includes('energy')) {
				return PropertyCategory.CONSUMPTION;
			}
			if (name.includes('brightness') || name.includes('bri')) {
				return PropertyCategory.BRIGHTNESS;
			}
			if (name.includes('color_temp')) {
				return PropertyCategory.COLOR_TEMPERATURE;
			}
			if (name.includes('position')) {
				return PropertyCategory.POSITION;
			}
			if (name.includes('tilt')) {
				return PropertyCategory.TILT;
			}
			if (name.includes('setpoint')) {
				return PropertyCategory.TEMPERATURE;
			}
			if (name.includes('linkquality') || name.includes('link_quality')) {
				return PropertyCategory.LINK_QUALITY;
			}
			return PropertyCategory.LEVEL;
		}

		// Enum/text properties
		if (name.includes('mode') || name.includes('preset')) {
			return PropertyCategory.MODE;
		}
		if (name.includes('action') || name.includes('click')) {
			return PropertyCategory.EVENT;
		}
		if (name.includes('state') || name.includes('status')) {
			return PropertyCategory.STATUS;
		}

		return PropertyCategory.GENERIC;
	}

	/**
	 * Format channel name for display
	 */
	private formatChannelName(type: string, endpoint?: string): string {
		const baseName = type.charAt(0).toUpperCase() + type.slice(1);
		return endpoint ? `${baseName} (${endpoint})` : baseName;
	}

	/**
	 * Format property name for display
	 */
	private formatPropertyName(label: string): string {
		return label
			.split('_')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	}

	/**
	 * Sanitize identifier to be valid
	 */
	private sanitizeIdentifier(name: string): string {
		return name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
	}
}

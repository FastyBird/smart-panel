import { DataTypeType, PermissionType, PropertyCategory } from '../devices.constants';
import { ChannelCategory as ChannelCategoryType } from '../devices.constants';
import { channelsSchema } from '../../../spec/channels';

/**
 * Property metadata from channel schema
 */
export interface PropertyMetadata {
	category: PropertyCategory;
	required: boolean;
	permissions: PermissionType[];
	data_type: DataTypeType;
	unit: string | null;
	format: string[] | number[] | null;
	invalid: unknown | null;
	step: number | null;
}

/**
 * Get required properties for a given channel category
 * @param channelCategory The channel category to query
 * @returns Array of required property categories
 */
export function getRequiredProperties(channelCategory: ChannelCategoryType): PropertyCategory[] {
	const channelSpec = channelsSchema[channelCategory];

	if (!channelSpec || typeof channelSpec !== 'object' || !channelSpec.properties) {
		return [];
	}

	const requiredProperties: PropertyCategory[] = [];

	for (const [propKey, propSpec] of Object.entries(channelSpec.properties)) {
		if (typeof propSpec === 'object' && propSpec.required === true) {
			// Map property category string to PropertyCategory enum
			const propertyCategory = mapPropertyCategory(propKey);

			if (propertyCategory) {
				requiredProperties.push(propertyCategory);
			}
		}
	}

	return requiredProperties;
}

/**
 * Get property metadata from schema
 * @param channelCategory The channel category
 * @param propertyCategory The property category
 * @returns Property metadata or null if not found
 */
export function getPropertyMetadata(
	channelCategory: ChannelCategoryType,
	propertyCategory: PropertyCategory,
): PropertyMetadata | null {
	const channelSpec = channelsSchema[channelCategory];

	if (!channelSpec || typeof channelSpec !== 'object' || !channelSpec.properties) {
		return null;
	}

	// Map PropertyCategory enum to schema property key
	const propertyKey = mapPropertyCategoryToSchemaKey(propertyCategory);

	if (!propertyKey) {
		return null;
	}

	const propertySpec = channelSpec.properties[propertyKey];

	if (!propertySpec || typeof propertySpec !== 'object') {
		return null;
	}

	return {
		category: propertyCategory,
		required: propertySpec.required ?? false,
		permissions: mapPermissions(propertySpec.permissions as string[]),
		data_type: mapDataType(propertySpec.data_type as string),
		unit: propertySpec.unit ?? null,
		format: propertySpec.format ?? null,
		invalid: propertySpec.invalid ?? null,
		step: propertySpec.step ?? null,
	};
}

/**
 * Check if a property is required for a channel
 * @param channelCategory The channel category
 * @param propertyCategory The property category
 * @returns true if the property is required
 */
export function isPropertyRequired(channelCategory: ChannelCategoryType, propertyCategory: PropertyCategory): boolean {
	const metadata = getPropertyMetadata(channelCategory, propertyCategory);

	return metadata?.required ?? false;
}

/**
 * Get default value for a property based on schema
 * @param channelCategory The channel category
 * @param propertyCategory The property category
 * @returns Default value or null
 */
export function getPropertyDefaultValue(
	channelCategory: ChannelCategoryType,
	propertyCategory: PropertyCategory,
): string | number | boolean | null {
	const metadata = getPropertyMetadata(channelCategory, propertyCategory);

	if (!metadata) {
		return null;
	}

	// For enums, use the first value as default
	if (metadata.data_type === DataTypeType.ENUM && Array.isArray(metadata.format) && metadata.format.length > 0) {
		return metadata.format[0] as string;
	}

	// For numeric types with format [min, max], use min as default
	if (
		(metadata.data_type === DataTypeType.UCHAR ||
			metadata.data_type === DataTypeType.USHORT ||
			metadata.data_type === DataTypeType.UINT ||
			metadata.data_type === DataTypeType.FLOAT) &&
		Array.isArray(metadata.format) &&
		metadata.format.length === 2
	) {
		return metadata.format[0] as number;
	}

	// For boolean, default to false
	if (metadata.data_type === DataTypeType.BOOL) {
		return false;
	}

	// For strings, return empty string
	if (metadata.data_type === DataTypeType.STRING) {
		return '';
	}

	return null;
}

/**
 * Map property category string from schema to PropertyCategory enum
 */
function mapPropertyCategory(key: string): PropertyCategory | null {
	const mapping: Partial<Record<string, PropertyCategory>> = {
		percentage: PropertyCategory.PERCENTAGE,
		status: PropertyCategory.STATUS,
		on: PropertyCategory.ON,
		brightness: PropertyCategory.BRIGHTNESS,
		color_red: PropertyCategory.COLOR_RED,
		color_green: PropertyCategory.COLOR_GREEN,
		color_blue: PropertyCategory.COLOR_BLUE,
		color_white: PropertyCategory.COLOR_WHITE,
		color_temperature: PropertyCategory.COLOR_TEMPERATURE,
		hue: PropertyCategory.HUE,
		saturation: PropertyCategory.SATURATION,
		temperature: PropertyCategory.TEMPERATURE,
		humidity: PropertyCategory.HUMIDITY,
		power: PropertyCategory.POWER,
		voltage: PropertyCategory.VOLTAGE,
		current: PropertyCategory.CURRENT,
		consumption: PropertyCategory.CONSUMPTION,
		detected: PropertyCategory.DETECTED,
		active: PropertyCategory.ACTIVE,
		fault: PropertyCategory.FAULT,
		tampered: PropertyCategory.TAMPERED,
		position: PropertyCategory.POSITION,
		command: PropertyCategory.COMMAND,
		obstruction: PropertyCategory.OBSTRUCTION,
		type: PropertyCategory.TYPE,
		manufacturer: PropertyCategory.MANUFACTURER,
		model: PropertyCategory.MODEL,
		serial_number: PropertyCategory.SERIAL_NUMBER,
		firmware_revision: PropertyCategory.FIRMWARE_REVISION,
		hardware_revision: PropertyCategory.HARDWARE_REVISION,
		link_quality: PropertyCategory.LINK_QUALITY,
		connection_type: PropertyCategory.CONNECTION_TYPE,
		in_use: PropertyCategory.IN_USE,
		density: PropertyCategory.DENSITY,
		measured: PropertyCategory.MEASURED,
		level: PropertyCategory.LEVEL,
		// Add more mappings as needed
	};

	return mapping[key] ?? null;
}

/**
 * Map PropertyCategory enum to schema property key
 */
function mapPropertyCategoryToSchemaKey(category: PropertyCategory): string | null {
	const mapping: Partial<Record<PropertyCategory, string>> = {
		[PropertyCategory.PERCENTAGE]: 'percentage',
		[PropertyCategory.STATUS]: 'status',
		[PropertyCategory.ON]: 'on',
		[PropertyCategory.BRIGHTNESS]: 'brightness',
		[PropertyCategory.COLOR_RED]: 'color_red',
		[PropertyCategory.COLOR_GREEN]: 'color_green',
		[PropertyCategory.COLOR_BLUE]: 'color_blue',
		[PropertyCategory.COLOR_WHITE]: 'color_white',
		[PropertyCategory.COLOR_TEMPERATURE]: 'color_temperature',
		[PropertyCategory.HUE]: 'hue',
		[PropertyCategory.SATURATION]: 'saturation',
		[PropertyCategory.TEMPERATURE]: 'temperature',
		[PropertyCategory.HUMIDITY]: 'humidity',
		[PropertyCategory.POWER]: 'power',
		[PropertyCategory.VOLTAGE]: 'voltage',
		[PropertyCategory.CURRENT]: 'current',
		[PropertyCategory.CONSUMPTION]: 'consumption',
		[PropertyCategory.DETECTED]: 'detected',
		[PropertyCategory.ACTIVE]: 'active',
		[PropertyCategory.FAULT]: 'fault',
		[PropertyCategory.TAMPERED]: 'tampered',
		[PropertyCategory.POSITION]: 'position',
		[PropertyCategory.COMMAND]: 'command',
		[PropertyCategory.OBSTRUCTION]: 'obstruction',
		[PropertyCategory.TYPE]: 'type',
		[PropertyCategory.MANUFACTURER]: 'manufacturer',
		[PropertyCategory.MODEL]: 'model',
		[PropertyCategory.SERIAL_NUMBER]: 'serial_number',
		[PropertyCategory.FIRMWARE_REVISION]: 'firmware_revision',
		[PropertyCategory.HARDWARE_REVISION]: 'hardware_revision',
		[PropertyCategory.LINK_QUALITY]: 'link_quality',
		[PropertyCategory.CONNECTION_TYPE]: 'connection_type',
		[PropertyCategory.IN_USE]: 'in_use',
		[PropertyCategory.DENSITY]: 'density',
		[PropertyCategory.MEASURED]: 'measured',
		[PropertyCategory.LEVEL]: 'level',
		// Add more mappings as needed
	};

	return mapping[category] ?? null;
}

/**
 * Map schema permission strings to PermissionType enum
 */
function mapPermissions(permissions: string[]): PermissionType[] {
	if (!Array.isArray(permissions)) {
		return [PermissionType.READ_WRITE];
	}

	const mapping: Record<string, PermissionType> = {
		ro: PermissionType.READ_ONLY,
		wo: PermissionType.WRITE_ONLY,
		rw: PermissionType.READ_WRITE,
	};

	return permissions.map((p) => mapping[p] ?? PermissionType.READ_WRITE);
}

/**
 * Map schema data_type string to DataTypeType enum
 */
function mapDataType(dataType: string): DataTypeType {
	const mapping: Record<string, DataTypeType> = {
		bool: DataTypeType.BOOL,
		uchar: DataTypeType.UCHAR,
		ushort: DataTypeType.USHORT,
		uint: DataTypeType.UINT,
		float: DataTypeType.FLOAT,
		string: DataTypeType.STRING,
		enum: DataTypeType.ENUM,
	};

	return mapping[dataType] ?? DataTypeType.UNKNOWN;
}

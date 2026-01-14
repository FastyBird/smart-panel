import { channelsSchema } from '../../../spec/channels';
import { devicesSchema } from '../../../spec/devices';
import { DataTypeType, PermissionType, PropertyCategory } from '../devices.constants';
import { ChannelCategory as ChannelCategoryType, DeviceCategory as DeviceCategoryType } from '../devices.constants';

/**
 * Type for data type variant from schema (for multi-datatype properties)
 */
interface DataTypeVariantSpec {
	id: string;
	data_type?: string;
	unit?: string;
	format?: string[] | number[];
	invalid?: unknown;
	step?: number;
	description?: { en: string };
}

/**
 * Type for property spec from schema
 */
interface PropertySpec {
	required?: boolean;
	permissions?: string[];
	data_type?: string;
	unit?: string;
	format?: string[] | number[];
	invalid?: unknown;
	step?: number;
	// Multi-datatype properties have data_types array instead of single data_type
	data_types?: DataTypeVariantSpec[];
}

/**
 * Data type variant metadata (for multi-datatype properties)
 */
export interface DataTypeVariant {
	id: string;
	data_type: DataTypeType;
	unit: string | null;
	format: string[] | number[] | null;
	invalid: unknown;
	step: number | null;
	description: { en: string } | null;
}

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
	invalid: unknown;
	step: number | null;
	/** True if this property supports multiple data type variants */
	hasMultipleDataTypes?: boolean;
	/** Available data type variants (only present if hasMultipleDataTypes is true) */
	dataTypeVariants?: DataTypeVariant[];
}

/**
 * Channel constraints defining relationships between properties
 */
export interface ChannelConstraints {
	/** Exactly one property from each group can be present (mutually exclusive) */
	oneOf?: PropertyCategory[][];
	/** At least one property from each group must be present */
	oneOrMoreOf?: PropertyCategory[][];
	/** Property groups that cannot be mixed (e.g., RGB vs HSV) - array of [groupA[], groupB[]] pairs */
	mutuallyExclusiveGroups?: PropertyCategory[][][];
}

/**
 * Type for channel constraints from schema
 */
interface ChannelConstraintsSpec {
	oneOf?: string[][];
	oneOrMoreOf?: string[][];
	mutuallyExclusiveGroups?: string[][][];
}

/**
 * Get constraints for a given channel category
 * @param channelCategory The channel category to query
 * @returns Channel constraints or null if none defined
 */
export function getChannelConstraints(channelCategory: ChannelCategoryType): ChannelConstraints | null {
	const channelSpec = channelsSchema[channelCategory] as { constraints?: ChannelConstraintsSpec } | undefined;

	if (!channelSpec || typeof channelSpec !== 'object' || !channelSpec.constraints) {
		return null;
	}

	const constraints = channelSpec.constraints;

	const result: ChannelConstraints = {};

	if (constraints.oneOf) {
		result.oneOf = constraints.oneOf.map((group) =>
			group.map((p) => mapPropertyCategory(p)).filter((p): p is PropertyCategory => p !== null),
		);
	}

	if (constraints.oneOrMoreOf) {
		result.oneOrMoreOf = constraints.oneOrMoreOf.map((group) =>
			group.map((p) => mapPropertyCategory(p)).filter((p): p is PropertyCategory => p !== null),
		);
	}

	if (constraints.mutuallyExclusiveGroups) {
		result.mutuallyExclusiveGroups = constraints.mutuallyExclusiveGroups.map((groupPair) =>
			groupPair.map((group) =>
				group.map((p) => mapPropertyCategory(p)).filter((p): p is PropertyCategory => p !== null),
			),
		);
	}

	// Return null if no constraints were mapped
	if (!result.oneOf && !result.oneOrMoreOf && !result.mutuallyExclusiveGroups) {
		return null;
	}

	return result;
}

/**
 * Get required properties for a given channel category
 * @param channelCategory The channel category to query
 * @returns Array of required property categories
 */
export function getRequiredProperties(channelCategory: ChannelCategoryType): PropertyCategory[] {
	const channelSpec = channelsSchema[channelCategory] as { properties?: Record<string, PropertySpec> } | undefined;

	if (!channelSpec || typeof channelSpec !== 'object' || !channelSpec.properties) {
		return [];
	}

	const requiredProperties: PropertyCategory[] = [];

	const properties = channelSpec.properties;

	for (const [propKey, propSpec] of Object.entries(properties)) {
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
	const channelSpec = channelsSchema[channelCategory] as { properties?: Record<string, PropertySpec> } | undefined;

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

	// Check if this is a multi-datatype property
	if (propertySpec.data_types && Array.isArray(propertySpec.data_types) && propertySpec.data_types.length > 0) {
		// Use first variant as the default
		const firstVariant = propertySpec.data_types[0];
		const dataTypeVariants = propertySpec.data_types.map((variant) => ({
			id: variant.id,
			data_type: mapDataType(variant.data_type ?? ''),
			unit: variant.unit ?? null,
			format: variant.format ?? null,
			invalid: variant.invalid ?? null,
			step: variant.step ?? null,
			description: variant.description ?? null,
		}));

		return {
			category: propertyCategory,
			required: propertySpec.required ?? false,
			permissions: mapPermissions(propertySpec.permissions ?? []),
			data_type: mapDataType(firstVariant.data_type ?? ''),
			unit: firstVariant.unit ?? null,
			format: firstVariant.format ?? null,
			invalid: firstVariant.invalid ?? null,
			step: firstVariant.step ?? null,
			hasMultipleDataTypes: true,
			dataTypeVariants,
		};
	}

	// Single data type property
	return {
		category: propertyCategory,
		required: propertySpec.required ?? false,
		permissions: mapPermissions(propertySpec.permissions ?? []),
		data_type: mapDataType(propertySpec.data_type ?? ''),
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
 * Note: 'generic' is intentionally not mapped as it's not a valid property category
 */
function mapPropertyCategory(key: string): PropertyCategory | null {
	const mapping: Partial<Record<string, PropertyCategory>> = {
		active: PropertyCategory.ACTIVE,
		angle: PropertyCategory.ANGLE,
		brightness: PropertyCategory.BRIGHTNESS,
		color_blue: PropertyCategory.COLOR_BLUE,
		color_green: PropertyCategory.COLOR_GREEN,
		color_red: PropertyCategory.COLOR_RED,
		color_temperature: PropertyCategory.COLOR_TEMPERATURE,
		color_white: PropertyCategory.COLOR_WHITE,
		command: PropertyCategory.COMMAND,
		connection_type: PropertyCategory.CONNECTION_TYPE,
		consumption: PropertyCategory.CONSUMPTION,
		current: PropertyCategory.CURRENT,
		density: PropertyCategory.DENSITY,
		detected: PropertyCategory.DETECTED,
		direction: PropertyCategory.DIRECTION,
		distance: PropertyCategory.DISTANCE,
		duration: PropertyCategory.DURATION,
		event: PropertyCategory.EVENT,
		fault: PropertyCategory.FAULT,
		firmware_revision: PropertyCategory.FIRMWARE_REVISION,
		frequency: PropertyCategory.FREQUENCY,
		hardware_revision: PropertyCategory.HARDWARE_REVISION,
		hue: PropertyCategory.HUE,
		humidity: PropertyCategory.HUMIDITY,
		in_use: PropertyCategory.IN_USE,
		infrared: PropertyCategory.INFRARED,
		input_source: PropertyCategory.INPUT_SOURCE,
		level: PropertyCategory.LEVEL,
		link_quality: PropertyCategory.LINK_QUALITY,
		locked: PropertyCategory.LOCKED,
		manufacturer: PropertyCategory.MANUFACTURER,
		measured: PropertyCategory.MEASURED,
		model: PropertyCategory.MODEL,
		mode: PropertyCategory.MODE,
		obstruction: PropertyCategory.OBSTRUCTION,
		on: PropertyCategory.ON,
		over_current: PropertyCategory.OVER_CURRENT,
		over_voltage: PropertyCategory.OVER_VOLTAGE,
		over_power: PropertyCategory.OVER_POWER,
		pan: PropertyCategory.PAN,
		peak_level: PropertyCategory.PEAK_LEVEL,
		percentage: PropertyCategory.PERCENTAGE,
		position: PropertyCategory.POSITION,
		power: PropertyCategory.POWER,
		rate: PropertyCategory.RATE,
		remaining: PropertyCategory.REMAINING,
		remote_key: PropertyCategory.REMOTE_KEY,
		saturation: PropertyCategory.SATURATION,
		serial_number: PropertyCategory.SERIAL_NUMBER,
		source: PropertyCategory.SOURCE,
		speed: PropertyCategory.SPEED,
		status: PropertyCategory.STATUS,
		swing: PropertyCategory.SWING,
		tampered: PropertyCategory.TAMPERED,
		temperature: PropertyCategory.TEMPERATURE,
		tilt: PropertyCategory.TILT,
		track: PropertyCategory.TRACK,
		type: PropertyCategory.TYPE,
		units: PropertyCategory.UNITS,
		voltage: PropertyCategory.VOLTAGE,
		volume: PropertyCategory.VOLUME,
		zoom: PropertyCategory.ZOOM,
	};

	return mapping[key] ?? null;
}

/**
 * Map PropertyCategory enum to schema property key
 * Note: GENERIC is intentionally not mapped as it's not a valid property category
 */
function mapPropertyCategoryToSchemaKey(category: PropertyCategory): string | null {
	const mapping: Partial<Record<PropertyCategory, string>> = {
		[PropertyCategory.ACTIVE]: 'active',
		[PropertyCategory.ANGLE]: 'angle',
		[PropertyCategory.BRIGHTNESS]: 'brightness',
		[PropertyCategory.COLOR_BLUE]: 'color_blue',
		[PropertyCategory.COLOR_GREEN]: 'color_green',
		[PropertyCategory.COLOR_RED]: 'color_red',
		[PropertyCategory.COLOR_TEMPERATURE]: 'color_temperature',
		[PropertyCategory.COLOR_WHITE]: 'color_white',
		[PropertyCategory.COMMAND]: 'command',
		[PropertyCategory.CONNECTION_TYPE]: 'connection_type',
		[PropertyCategory.CONSUMPTION]: 'consumption',
		[PropertyCategory.CURRENT]: 'current',
		[PropertyCategory.DENSITY]: 'density',
		[PropertyCategory.DETECTED]: 'detected',
		[PropertyCategory.DIRECTION]: 'direction',
		[PropertyCategory.DISTANCE]: 'distance',
		[PropertyCategory.DURATION]: 'duration',
		[PropertyCategory.EVENT]: 'event',
		[PropertyCategory.FAULT]: 'fault',
		[PropertyCategory.FIRMWARE_REVISION]: 'firmware_revision',
		[PropertyCategory.FREQUENCY]: 'frequency',
		[PropertyCategory.HARDWARE_REVISION]: 'hardware_revision',
		[PropertyCategory.HUE]: 'hue',
		[PropertyCategory.HUMIDITY]: 'humidity',
		[PropertyCategory.IN_USE]: 'in_use',
		[PropertyCategory.INFRARED]: 'infrared',
		[PropertyCategory.INPUT_SOURCE]: 'input_source',
		[PropertyCategory.LEVEL]: 'level',
		[PropertyCategory.LINK_QUALITY]: 'link_quality',
		[PropertyCategory.LOCKED]: 'locked',
		[PropertyCategory.MANUFACTURER]: 'manufacturer',
		[PropertyCategory.MEASURED]: 'measured',
		[PropertyCategory.MODEL]: 'model',
		[PropertyCategory.MODE]: 'mode',
		[PropertyCategory.OBSTRUCTION]: 'obstruction',
		[PropertyCategory.ON]: 'on',
		[PropertyCategory.OVER_CURRENT]: 'over_current',
		[PropertyCategory.OVER_VOLTAGE]: 'over_voltage',
		[PropertyCategory.OVER_POWER]: 'over_power',
		[PropertyCategory.PAN]: 'pan',
		[PropertyCategory.PEAK_LEVEL]: 'peak_level',
		[PropertyCategory.PERCENTAGE]: 'percentage',
		[PropertyCategory.POSITION]: 'position',
		[PropertyCategory.POWER]: 'power',
		[PropertyCategory.RATE]: 'rate',
		[PropertyCategory.REMAINING]: 'remaining',
		[PropertyCategory.REMOTE_KEY]: 'remote_key',
		[PropertyCategory.SATURATION]: 'saturation',
		[PropertyCategory.SERIAL_NUMBER]: 'serial_number',
		[PropertyCategory.SOURCE]: 'source',
		[PropertyCategory.SPEED]: 'speed',
		[PropertyCategory.STATUS]: 'status',
		[PropertyCategory.SWING]: 'swing',
		[PropertyCategory.TAMPERED]: 'tampered',
		[PropertyCategory.TEMPERATURE]: 'temperature',
		[PropertyCategory.TILT]: 'tilt',
		[PropertyCategory.TRACK]: 'track',
		[PropertyCategory.TYPE]: 'type',
		[PropertyCategory.UNITS]: 'units',
		[PropertyCategory.VOLTAGE]: 'voltage',
		[PropertyCategory.VOLUME]: 'volume',
		[PropertyCategory.ZOOM]: 'zoom',
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
		ev: PermissionType.EVENT_ONLY,
	};

	return permissions.map((p) => mapping[p] ?? PermissionType.READ_WRITE);
}

/**
 * Map schema data_type string to DataTypeType enum
 */
function mapDataType(dataType: string): DataTypeType {
	const mapping: Record<string, DataTypeType> = {
		bool: DataTypeType.BOOL,
		char: DataTypeType.CHAR,
		uchar: DataTypeType.UCHAR,
		short: DataTypeType.SHORT,
		ushort: DataTypeType.USHORT,
		int: DataTypeType.INT,
		uint: DataTypeType.UINT,
		float: DataTypeType.FLOAT,
		string: DataTypeType.STRING,
		enum: DataTypeType.ENUM,
	};

	return mapping[dataType] ?? DataTypeType.UNKNOWN;
}

// ============================================================================
// Device-level schema utilities
// ============================================================================

/**
 * Device constraints defining relationships between channels
 */
export interface DeviceConstraints {
	/** Exactly one channel from each group can be present (mutually exclusive) */
	oneOf?: ChannelCategoryType[][];
	/** At least one channel from each group must be present */
	oneOrMoreOf?: ChannelCategoryType[][];
	/** Channel groups that cannot be mixed (e.g., outlet vs switcher) - array of [groupA[], groupB[]] pairs */
	mutuallyExclusiveGroups?: ChannelCategoryType[][][];
}

/**
 * Type for device constraints from schema
 */
interface DeviceConstraintsSpec {
	oneOf?: string[][];
	oneOrMoreOf?: string[][];
	mutuallyExclusiveGroups?: string[][][];
}

/**
 * Get constraints for a given device category
 * @param deviceCategory The device category to query
 * @returns Device constraints or null if none defined
 */
export function getDeviceConstraints(deviceCategory: DeviceCategoryType): DeviceConstraints | null {
	const deviceSpec = devicesSchema[deviceCategory] as { constraints?: DeviceConstraintsSpec } | undefined;

	if (!deviceSpec || typeof deviceSpec !== 'object' || !deviceSpec.constraints) {
		return null;
	}

	const constraints = deviceSpec.constraints;

	const result: DeviceConstraints = {};

	if (constraints.oneOf) {
		result.oneOf = constraints.oneOf.map((group) =>
			group.map((c) => mapChannelCategory(c)).filter((c): c is ChannelCategoryType => c !== null),
		);
	}

	if (constraints.oneOrMoreOf) {
		result.oneOrMoreOf = constraints.oneOrMoreOf.map((group) =>
			group.map((c) => mapChannelCategory(c)).filter((c): c is ChannelCategoryType => c !== null),
		);
	}

	if (constraints.mutuallyExclusiveGroups) {
		result.mutuallyExclusiveGroups = constraints.mutuallyExclusiveGroups.map((groupPair) =>
			groupPair.map((group) =>
				group.map((c) => mapChannelCategory(c)).filter((c): c is ChannelCategoryType => c !== null),
			),
		);
	}

	// Return null if no constraints were mapped
	if (!result.oneOf && !result.oneOrMoreOf && !result.mutuallyExclusiveGroups) {
		return null;
	}

	return result;
}

/**
 * Channel spec from device schema
 */
export interface ChannelSpec {
	category: ChannelCategoryType;
	required: boolean;
	multiple: boolean;
	description: { en: string };
}

/**
 * Device spec from schema
 */
export interface DeviceSpec {
	category: DeviceCategoryType;
	description: { en: string };
	channels: Record<string, ChannelSpec>;
}

/**
 * Get device specification by category
 * @param deviceCategory The device category to query
 * @returns Device specification or null if not found
 */
export function getDeviceSpec(deviceCategory: DeviceCategoryType): DeviceSpec | null {
	const deviceSpec = devicesSchema[deviceCategory] as DeviceSpec | undefined;

	if (!deviceSpec || typeof deviceSpec !== 'object') {
		return null;
	}

	return deviceSpec;
}

/**
 * Get required channels for a device category
 * @param deviceCategory The device category to query
 * @returns Array of required channel categories
 */
export function getRequiredChannels(deviceCategory: DeviceCategoryType): ChannelCategoryType[] {
	const deviceSpec = getDeviceSpec(deviceCategory);

	if (!deviceSpec || !deviceSpec.channels) {
		return [];
	}

	const requiredChannels: ChannelCategoryType[] = [];

	for (const [, channelSpec] of Object.entries(deviceSpec.channels)) {
		if (channelSpec.required === true) {
			const channelCategory = mapChannelCategory(channelSpec.category);

			if (channelCategory) {
				requiredChannels.push(channelCategory);
			}
		}
	}

	return requiredChannels;
}

/**
 * Get all allowed channels for a device category (required + optional)
 * @param deviceCategory The device category to query
 * @returns Array of all allowed channel specs
 */
export function getAllowedChannels(deviceCategory: DeviceCategoryType): ChannelSpec[] {
	const deviceSpec = getDeviceSpec(deviceCategory);

	if (!deviceSpec || !deviceSpec.channels) {
		return [];
	}

	return Object.values(deviceSpec.channels);
}

/**
 * Check if a channel category is allowed for a device category
 * @param deviceCategory The device category
 * @param channelCategory The channel category to check
 * @returns true if the channel is allowed for this device
 */
export function isChannelAllowed(deviceCategory: DeviceCategoryType, channelCategory: ChannelCategoryType): boolean {
	const deviceSpec = getDeviceSpec(deviceCategory);

	if (!deviceSpec || !deviceSpec.channels) {
		return false;
	}

	for (const channelSpec of Object.values(deviceSpec.channels)) {
		if (channelSpec.category === channelCategory) {
			return true;
		}
	}

	return false;
}

/**
 * Check if a channel can have multiple instances
 * @param deviceCategory The device category
 * @param channelCategory The channel category to check
 * @returns true if multiple instances are allowed
 */
export function isChannelMultiple(deviceCategory: DeviceCategoryType, channelCategory: ChannelCategoryType): boolean {
	const deviceSpec = getDeviceSpec(deviceCategory);

	if (!deviceSpec || !deviceSpec.channels) {
		return false;
	}

	for (const channelSpec of Object.values(deviceSpec.channels)) {
		if (channelSpec.category === channelCategory) {
			return channelSpec.multiple === true;
		}
	}

	return false;
}

/**
 * Check if a channel is required for a device category
 * @param deviceCategory The device category
 * @param channelCategory The channel category to check
 * @returns true if the channel is required
 */
export function isChannelRequired(deviceCategory: DeviceCategoryType, channelCategory: ChannelCategoryType): boolean {
	const deviceSpec = getDeviceSpec(deviceCategory);

	if (!deviceSpec || !deviceSpec.channels) {
		return false;
	}

	for (const channelSpec of Object.values(deviceSpec.channels)) {
		if (channelSpec.category === channelCategory) {
			return channelSpec.required === true;
		}
	}

	return false;
}

/**
 * Get channel spec for a specific channel category within a device
 * @param deviceCategory The device category
 * @param channelCategory The channel category
 * @returns Channel spec or null if not found
 */
export function getChannelSpec(
	deviceCategory: DeviceCategoryType,
	channelCategory: ChannelCategoryType,
): ChannelSpec | null {
	const deviceSpec = getDeviceSpec(deviceCategory);

	if (!deviceSpec || !deviceSpec.channels) {
		return null;
	}

	for (const channelSpec of Object.values(deviceSpec.channels)) {
		if (channelSpec.category === channelCategory) {
			return channelSpec;
		}
	}

	return null;
}

/**
 * Get all property categories for a channel
 * @param channelCategory The channel category
 * @returns Array of all property categories with their specs
 */
export function getAllProperties(channelCategory: ChannelCategoryType): PropertyMetadata[] {
	const channelSpec = channelsSchema[channelCategory] as { properties?: Record<string, PropertySpec> } | undefined;

	if (!channelSpec || typeof channelSpec !== 'object' || !channelSpec.properties) {
		return [];
	}

	const properties: PropertyMetadata[] = [];

	for (const [propKey, propSpec] of Object.entries(channelSpec.properties)) {
		const propertyCategory = mapPropertyCategory(propKey);

		if (propertyCategory) {
			// Check if this is a multi-datatype property
			if (propSpec.data_types && Array.isArray(propSpec.data_types) && propSpec.data_types.length > 0) {
				// Use first variant as the default
				const firstVariant = propSpec.data_types[0];
				const dataTypeVariants = propSpec.data_types.map((variant) => ({
					id: variant.id,
					data_type: mapDataType(variant.data_type ?? ''),
					unit: variant.unit ?? null,
					format: variant.format ?? null,
					invalid: variant.invalid ?? null,
					step: variant.step ?? null,
					description: variant.description ?? null,
				}));

				properties.push({
					category: propertyCategory,
					required: propSpec.required ?? false,
					permissions: mapPermissions(propSpec.permissions ?? []),
					data_type: mapDataType(firstVariant.data_type ?? ''),
					unit: firstVariant.unit ?? null,
					format: firstVariant.format ?? null,
					invalid: firstVariant.invalid ?? null,
					step: firstVariant.step ?? null,
					hasMultipleDataTypes: true,
					dataTypeVariants,
				});
			} else {
				// Single data type property
				properties.push({
					category: propertyCategory,
					required: propSpec.required ?? false,
					permissions: mapPermissions(propSpec.permissions ?? []),
					data_type: mapDataType(propSpec.data_type ?? ''),
					unit: propSpec.unit ?? null,
					format: propSpec.format ?? null,
					invalid: propSpec.invalid ?? null,
					step: propSpec.step ?? null,
				});
			}
		}
	}

	return properties;
}

/**
 * Check if a property supports multiple data types
 * @param channelCategory The channel category
 * @param propertyCategory The property category
 * @returns true if the property has multiple data type variants
 */
export function hasMultipleDataTypes(
	channelCategory: ChannelCategoryType,
	propertyCategory: PropertyCategory,
): boolean {
	const metadata = getPropertyMetadata(channelCategory, propertyCategory);
	return metadata?.hasMultipleDataTypes === true;
}

/**
 * Get all data type variants for a multi-datatype property
 * @param channelCategory The channel category
 * @param propertyCategory The property category
 * @returns Array of data type variants or empty array if not a multi-datatype property
 */
export function getPropertyDataTypeVariants(
	channelCategory: ChannelCategoryType,
	propertyCategory: PropertyCategory,
): DataTypeVariant[] {
	const metadata = getPropertyMetadata(channelCategory, propertyCategory);
	return metadata?.dataTypeVariants ?? [];
}

/**
 * Check if a data type is valid for a property (supports multi-datatype properties)
 * @param channelCategory The channel category
 * @param propertyCategory The property category
 * @param dataType The data type to check
 * @returns true if the data type is valid for this property
 */
export function isValidDataType(
	channelCategory: ChannelCategoryType,
	propertyCategory: PropertyCategory,
	dataType: DataTypeType,
): boolean {
	const metadata = getPropertyMetadata(channelCategory, propertyCategory);

	if (!metadata) {
		return false;
	}

	// For multi-datatype properties, check if any variant matches
	if (metadata.hasMultipleDataTypes && metadata.dataTypeVariants) {
		return metadata.dataTypeVariants.some((variant) => variant.data_type === dataType);
	}

	// For single data type properties, check direct match
	return metadata.data_type === dataType;
}

/**
 * Map channel category string from schema to ChannelCategory enum
 */
function mapChannelCategory(category: string): ChannelCategoryType | null {
	// The category values in the schema match the enum values (lowercase with underscores)
	const validCategories = Object.values(ChannelCategoryType) as string[];

	if (validCategories.includes(category)) {
		return category as ChannelCategoryType;
	}

	return null;
}

import {
	ChannelCategory,
	DataTypeType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';

/**
 * Defines the type of virtual property for Z2M devices
 */
export enum VirtualPropertyType {
	/**
	 * Static value that never changes
	 * Example: connection_type = "zigbee"
	 */
	STATIC = 'static',

	/**
	 * Dynamic value calculated from Z2M state
	 * Example: battery status derived from percentage threshold
	 */
	DERIVED = 'derived',
}

/**
 * Base interface for virtual property definitions
 */
export interface VirtualPropertyDefinitionBase {
	/**
	 * Property category (e.g., STATUS, MANUFACTURER)
	 */
	property_category: PropertyCategory;

	/**
	 * Type of virtual property
	 */
	virtual_type: VirtualPropertyType;

	/**
	 * Data type for the property
	 */
	data_type: DataTypeType;

	/**
	 * Permissions for the property
	 */
	permissions: PermissionType[];

	/**
	 * Format (enum values or numeric range)
	 */
	format?: (string | number)[] | null;

	/**
	 * Unit of measurement
	 */
	unit?: string | null;
}

/**
 * Static virtual property - returns a fixed value
 */
export interface StaticVirtualPropertyDefinition extends VirtualPropertyDefinitionBase {
	virtual_type: VirtualPropertyType.STATIC;

	/**
	 * The static value to return
	 */
	static_value: string | number | boolean;
}

/**
 * Derived virtual property - calculates value from Z2M state
 */
export interface DerivedVirtualPropertyDefinition extends VirtualPropertyDefinitionBase {
	virtual_type: VirtualPropertyType.DERIVED;

	/**
	 * Source Z2M property to derive from
	 */
	source_property?: string;

	/**
	 * Derivation strategy
	 */
	derivation: VirtualPropertyDerivation;
}

/**
 * Union type for all virtual property definitions
 */
export type VirtualPropertyDefinition = StaticVirtualPropertyDefinition | DerivedVirtualPropertyDefinition;

/**
 * Defines how to derive a value from source data
 */
export interface VirtualPropertyDerivation {
	/**
	 * Type of derivation
	 */
	type: DerivationType;

	/**
	 * Parameters for the derivation
	 */
	params?: Record<string, unknown>;
}

/**
 * Types of value derivation strategies
 */
export enum DerivationType {
	/**
	 * Derive battery status from percentage
	 * Params: lowThreshold (default: 20)
	 */
	BATTERY_STATUS_FROM_PERCENTAGE = 'battery_status_from_percentage',

	/**
	 * Derive illuminance level from density (LUX value)
	 * Thresholds: >= 1000 lx = bright, >= 100 lx = moderate, >= 10 lx = dusky, < 10 lx = dark
	 */
	ILLUMINANCE_LEVEL_FROM_DENSITY = 'illuminance_level_from_density',

	/**
	 * Derive window covering status from position
	 * Position 0 = closed, position 100 = opened, other = stopped
	 */
	COVER_STATUS_FROM_POSITION = 'cover_status_from_position',
}

/**
 * Context for resolving virtual property values
 */
export interface VirtualPropertyContext {
	/**
	 * Current Z2M state for the device
	 */
	state: Record<string, unknown>;

	/**
	 * Z2M device friendly name
	 */
	friendlyName: string;

	/**
	 * Z2M device IEEE address
	 */
	ieeeAddress: string;
}

/**
 * Result of resolving a virtual property value
 */
export interface ResolvedVirtualProperty {
	/**
	 * Property category
	 */
	category: PropertyCategory;

	/**
	 * Resolved value
	 */
	value: string | number | boolean | null;

	/**
	 * Whether this is a virtual property
	 */
	isVirtual: true;

	/**
	 * Virtual property type
	 */
	virtualType: VirtualPropertyType;

	/**
	 * Data type
	 */
	dataType: DataTypeType;

	/**
	 * Permissions
	 */
	permissions: PermissionType[];

	/**
	 * Format
	 */
	format?: (string | number)[] | null;

	/**
	 * Unit
	 */
	unit?: string | null;
}

/**
 * Virtual property definitions for a channel category
 */
export interface ChannelVirtualProperties {
	/**
	 * Channel category these virtual properties apply to
	 */
	channel_category: ChannelCategory;

	/**
	 * Virtual property definitions
	 */
	virtual_properties: VirtualPropertyDefinition[];
}

/**
 * Predefined virtual property definitions by channel category
 */
export const CHANNEL_VIRTUAL_PROPERTIES: ChannelVirtualProperties[] = [
	// Battery - needs status virtual property when not provided
	{
		channel_category: ChannelCategory.BATTERY,
		virtual_properties: [
			// Status property - derived from percentage
			{
				property_category: PropertyCategory.STATUS,
				virtual_type: VirtualPropertyType.DERIVED,
				data_type: DataTypeType.ENUM,
				permissions: [PermissionType.READ_ONLY],
				format: ['ok', 'low'],
				source_property: 'battery',
				derivation: {
					type: DerivationType.BATTERY_STATUS_FROM_PERCENTAGE,
					params: {
						lowThreshold: 20,
						defaultStatus: 'ok',
					},
				},
			},
		],
	},

	// Illuminance - LEVEL is derived from DENSITY (LUX value)
	{
		channel_category: ChannelCategory.ILLUMINANCE,
		virtual_properties: [
			// Level property - derived from density (LUX value)
			{
				property_category: PropertyCategory.LEVEL,
				virtual_type: VirtualPropertyType.DERIVED,
				data_type: DataTypeType.ENUM,
				permissions: [PermissionType.READ_ONLY],
				format: ['bright', 'moderate', 'dusky', 'dark'],
				source_property: 'illuminance', // Z2M uses 'illuminance', not 'illuminance_lux'
				derivation: {
					type: DerivationType.ILLUMINANCE_LEVEL_FROM_DENSITY,
					params: {
						brightThreshold: 1000,
						moderateThreshold: 100,
						duskyThreshold: 10,
					},
				},
			},
		],
	},

	// Window Covering - needs STATUS (derived from position) and TYPE (static)
	{
		channel_category: ChannelCategory.WINDOW_COVERING,
		virtual_properties: [
			// Status property - derived from position
			// Position 0 = closed, position 100 = opened, other values = stopped
			{
				property_category: PropertyCategory.STATUS,
				virtual_type: VirtualPropertyType.DERIVED,
				data_type: DataTypeType.ENUM,
				permissions: [PermissionType.READ_ONLY],
				format: ['opened', 'closed', 'opening', 'closing', 'stopped'],
				source_property: 'position',
				derivation: {
					type: DerivationType.COVER_STATUS_FROM_POSITION,
					params: {
						closedPosition: 0,
						openedPosition: 100,
					},
				},
			},
			// Type property - static value for cover type
			{
				property_category: PropertyCategory.TYPE,
				virtual_type: VirtualPropertyType.STATIC,
				data_type: DataTypeType.ENUM,
				permissions: [PermissionType.READ_ONLY],
				format: ['curtain', 'blind', 'roller', 'outdoor_blind'],
				static_value: 'curtain',
			},
		],
	},
];

/**
 * Get virtual properties for a channel category
 */
export function getVirtualPropertiesForChannel(channelCategory: ChannelCategory): VirtualPropertyDefinition[] {
	const channelVirtuals = CHANNEL_VIRTUAL_PROPERTIES.find((cvp) => cvp.channel_category === channelCategory);
	return channelVirtuals?.virtual_properties ?? [];
}

/**
 * Get a specific virtual property definition
 */
export function getVirtualPropertyDefinition(
	channelCategory: ChannelCategory,
	propertyCategory: PropertyCategory,
): VirtualPropertyDefinition | null {
	const virtuals = getVirtualPropertiesForChannel(channelCategory);
	return virtuals.find((vp) => vp.property_category === propertyCategory) ?? null;
}

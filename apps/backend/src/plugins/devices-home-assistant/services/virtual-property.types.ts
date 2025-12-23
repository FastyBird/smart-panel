import {
	ChannelCategory,
	DataTypeType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { HomeAssistantDomain } from '../devices-home-assistant.constants';
import { HomeAssistantStateModel } from '../models/home-assistant.model';

/**
 * Defines the type of virtual property
 */
export enum VirtualPropertyType {
	/**
	 * Static value that never changes
	 * Example: battery status = "ok" when charging status is unknown
	 */
	STATIC = 'static',

	/**
	 * Dynamic value calculated from one or more HA entities
	 * Example: battery status derived from percentage threshold
	 */
	DERIVED = 'derived',

	/**
	 * Command property that maps to HA service calls
	 * Example: window covering command (open/close/stop) maps to cover.open_cover service
	 */
	COMMAND = 'command',
}

/**
 * Base interface for virtual property definitions
 */
export interface VirtualPropertyDefinitionBase {
	/**
	 * Property category (e.g., STATUS, COMMAND, TYPE)
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
 * Derived virtual property - calculates value from other properties/entities
 */
export interface DerivedVirtualPropertyDefinition extends VirtualPropertyDefinitionBase {
	virtual_type: VirtualPropertyType.DERIVED;

	/**
	 * Source entity attributes to use for calculation
	 * Key: property category to check, Value: HA attribute path
	 */
	source_attributes?: Record<string, string>;

	/**
	 * Derivation strategy
	 */
	derivation: VirtualPropertyDerivation;
}

/**
 * Command virtual property - maps to HA service calls
 */
export interface CommandVirtualPropertyDefinition extends VirtualPropertyDefinitionBase {
	virtual_type: VirtualPropertyType.COMMAND;
	permissions: [PermissionType.WRITE_ONLY];

	/**
	 * Mapping of command values to HA service calls
	 */
	command_mapping: CommandMapping;
}

/**
 * Union type for all virtual property definitions
 */
export type VirtualPropertyDefinition =
	| StaticVirtualPropertyDefinition
	| DerivedVirtualPropertyDefinition
	| CommandVirtualPropertyDefinition;

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
	 * Derive window covering type from HA device class
	 * Maps: blind -> blind, curtain -> curtain, shade -> blind, etc.
	 */
	WINDOW_COVERING_TYPE_FROM_DEVICE_CLASS = 'window_covering_type_from_device_class',

	/**
	 * Derive window covering status from HA state
	 * Maps: open -> opened, closed -> closed, opening -> opening, etc.
	 */
	WINDOW_COVERING_STATUS_FROM_STATE = 'window_covering_status_from_state',

	/**
	 * Use a specific static value (fallback)
	 */
	STATIC_FALLBACK = 'static_fallback',

	/**
	 * Derive illuminance level from density (LUX value)
	 * Thresholds: >= 1000 lx = bright, >= 100 lx = moderate, >= 10 lx = dusky, < 10 lx = dark
	 */
	ILLUMINANCE_LEVEL_FROM_DENSITY = 'illuminance_level_from_density',
}

/**
 * Mapping of command values to HA service calls
 */
export interface CommandMapping {
	/**
	 * Domain for service calls (e.g., 'cover')
	 */
	domain: HomeAssistantDomain;

	/**
	 * Mapping of command value to service name
	 * Example: { open: 'open_cover', close: 'close_cover', stop: 'stop_cover' }
	 */
	value_to_service: Record<string, string>;

	/**
	 * Additional service data to include in calls
	 */
	service_data?: Record<string, unknown>;
}

/**
 * Context for resolving virtual property values
 */
export interface VirtualPropertyContext {
	/**
	 * HA entity ID associated with this channel
	 */
	entityId: string;

	/**
	 * HA domain
	 */
	domain: HomeAssistantDomain;

	/**
	 * HA device class
	 */
	deviceClass?: string | null;

	/**
	 * Current state from HA
	 */
	state?: HomeAssistantStateModel;

	/**
	 * All states from the device (for multi-entity derivations)
	 */
	allStates?: HomeAssistantStateModel[];
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
	// Window Covering - needs command and type virtual properties
	{
		channel_category: ChannelCategory.WINDOW_COVERING,
		virtual_properties: [
			// Command property - maps to HA cover services
			{
				property_category: PropertyCategory.COMMAND,
				virtual_type: VirtualPropertyType.COMMAND,
				data_type: DataTypeType.ENUM,
				permissions: [PermissionType.WRITE_ONLY],
				format: ['open', 'close', 'stop'],
				command_mapping: {
					domain: HomeAssistantDomain.COVER,
					value_to_service: {
						open: 'open_cover',
						close: 'close_cover',
						stop: 'stop_cover',
					},
				},
			},
			// Type property - derived from device class
			{
				property_category: PropertyCategory.TYPE,
				virtual_type: VirtualPropertyType.DERIVED,
				data_type: DataTypeType.ENUM,
				permissions: [PermissionType.READ_ONLY],
				format: ['curtain', 'blind', 'roller', 'outdoor_blind'],
				derivation: {
					type: DerivationType.WINDOW_COVERING_TYPE_FROM_DEVICE_CLASS,
					params: {
						defaultValue: 'blind',
						deviceClassMapping: {
							blind: 'blind',
							curtain: 'curtain',
							shade: 'blind',
							shutter: 'roller',
							awning: 'outdoor_blind',
							garage: 'roller',
							gate: 'roller',
							door: 'roller',
							window: 'blind',
						},
					},
				},
			},
		],
	},

	// Battery - needs status virtual property when not provided
	// Note: The format only includes 'ok' and 'low' because the derivation from
	// percentage cannot detect charging state (that would require a separate HA attribute)
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

	// Door - needs type and position virtual properties
	{
		channel_category: ChannelCategory.DOOR,
		virtual_properties: [
			// Position command property - maps to HA cover services
			{
				property_category: PropertyCategory.POSITION,
				virtual_type: VirtualPropertyType.COMMAND,
				data_type: DataTypeType.ENUM,
				permissions: [PermissionType.WRITE_ONLY],
				format: ['open', 'close', 'stop'],
				command_mapping: {
					domain: HomeAssistantDomain.COVER,
					value_to_service: {
						open: 'open_cover',
						close: 'close_cover',
						stop: 'stop_cover',
					},
				},
			},
			// Type property - derived from device class
			{
				property_category: PropertyCategory.TYPE,
				virtual_type: VirtualPropertyType.DERIVED,
				data_type: DataTypeType.ENUM,
				permissions: [PermissionType.READ_ONLY],
				format: ['door', 'garage'],
				derivation: {
					type: DerivationType.STATIC_FALLBACK,
					params: {
						defaultValue: 'door',
						deviceClassMapping: {
							door: 'door',
							garage: 'garage',
							gate: 'door',
						},
					},
				},
			},
			// Obstruction property - static false when not provided
			{
				property_category: PropertyCategory.OBSTRUCTION,
				virtual_type: VirtualPropertyType.STATIC,
				data_type: DataTypeType.BOOL,
				permissions: [PermissionType.READ_ONLY],
				static_value: false,
			},
		],
	},

	// Lock - needs on property when not provided (maps lock/unlock)
	{
		channel_category: ChannelCategory.LOCK,
		virtual_properties: [
			// ON property - command to lock/unlock
			// true = locked, false = unlocked
			{
				property_category: PropertyCategory.ON,
				virtual_type: VirtualPropertyType.COMMAND,
				data_type: DataTypeType.BOOL,
				permissions: [PermissionType.WRITE_ONLY],
				command_mapping: {
					domain: HomeAssistantDomain.LOCK,
					value_to_service: {
						true: 'lock',
						false: 'unlock',
					},
				},
			},
		],
	},

	// Illuminance - LEVEL is derived from DENSITY (LUX value from HA)
	// Thresholds: >= 1000 lx = bright, >= 100 lx = moderate, >= 10 lx = dusky, < 10 lx = dark
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
				derivation: {
					type: DerivationType.ILLUMINANCE_LEVEL_FROM_DENSITY,
					params: {
						// Thresholds in LUX
						brightThreshold: 1000,
						moderateThreshold: 100,
						duskyThreshold: 10,
					},
				},
			},
		],
	},

	// Note: LEAK channel virtual properties removed - the spec defines level with
	// illuminance values (bright/moderate/dusky/dark) which are semantically incorrect
	// for leak sensors. If HA doesn't provide level, we shouldn't create a virtual
	// property with nonsensical values. The 'detected' boolean is sufficient.

	// Gas - needs status when only detected is provided
	// Note: The format only includes 'normal' because the static fallback derivation
	// cannot derive warning/alarm states from HA data (that would require gas level/concentration)
	{
		channel_category: ChannelCategory.GAS,
		virtual_properties: [
			// Status property - static fallback (no gas level data from HA)
			{
				property_category: PropertyCategory.STATUS,
				virtual_type: VirtualPropertyType.DERIVED,
				data_type: DataTypeType.ENUM,
				permissions: [PermissionType.READ_ONLY],
				format: ['normal'],
				derivation: {
					type: DerivationType.STATIC_FALLBACK,
					params: {
						defaultValue: 'normal',
					},
				},
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

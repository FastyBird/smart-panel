import { ChannelCategory, DeviceCategory } from '../devices/devices.constants';

export const SPACES_MODULE_NAME = 'spaces-module';
export const SPACES_MODULE_PREFIX = 'spaces';
export const SPACES_MODULE_API_TAG_NAME = 'Spaces module';
export const SPACES_MODULE_API_TAG_DESCRIPTION =
	'Endpoints for managing spaces (rooms/zones) in the Smart Panel system. ' +
	'Spaces allow organizing devices and displays into logical groups for a room-centric experience.';

export enum EventType {
	SPACE_CREATED = 'SpacesModule.Space.Created',
	SPACE_UPDATED = 'SpacesModule.Space.Updated',
	SPACE_DELETED = 'SpacesModule.Space.Deleted',
	LIGHT_TARGET_CREATED = 'SpacesModule.LightTarget.Created',
	LIGHT_TARGET_UPDATED = 'SpacesModule.LightTarget.Updated',
	LIGHT_TARGET_DELETED = 'SpacesModule.LightTarget.Deleted',
	CLIMATE_TARGET_CREATED = 'SpacesModule.ClimateTarget.Created',
	CLIMATE_TARGET_UPDATED = 'SpacesModule.ClimateTarget.Updated',
	CLIMATE_TARGET_DELETED = 'SpacesModule.ClimateTarget.Deleted',
	// Aggregated state change events - emitted when intents are executed
	LIGHTING_STATE_CHANGED = 'SpacesModule.Space.LightingStateChanged',
	CLIMATE_STATE_CHANGED = 'SpacesModule.Space.ClimateStateChanged',
	COVERS_STATE_CHANGED = 'SpacesModule.Space.CoversStateChanged',
	MEDIA_STATE_CHANGED = 'SpacesModule.Space.MediaStateChanged',
	// Covers role events
	COVERS_TARGET_CREATED = 'SpacesModule.CoversTarget.Created',
	COVERS_TARGET_UPDATED = 'SpacesModule.CoversTarget.Updated',
	COVERS_TARGET_DELETED = 'SpacesModule.CoversTarget.Deleted',
	// Media role events
	MEDIA_TARGET_CREATED = 'SpacesModule.MediaTarget.Created',
	MEDIA_TARGET_UPDATED = 'SpacesModule.MediaTarget.Updated',
	MEDIA_TARGET_DELETED = 'SpacesModule.MediaTarget.Deleted',
	// Media routing activation events
	MEDIA_ROUTING_ACTIVATING = 'SpacesModule.MediaRouting.Activating',
	MEDIA_ROUTING_ACTIVATED = 'SpacesModule.MediaRouting.Activated',
	MEDIA_ROUTING_FAILED = 'SpacesModule.MediaRouting.Failed',
	MEDIA_ROUTING_DEACTIVATED = 'SpacesModule.MediaRouting.Deactivated',
	// Sensor state change events
	SENSOR_STATE_CHANGED = 'SpacesModule.Space.SensorStateChanged',
	// Sensor role events
	SENSOR_TARGET_CREATED = 'SpacesModule.SensorTarget.Created',
	SENSOR_TARGET_UPDATED = 'SpacesModule.SensorTarget.Updated',
	SENSOR_TARGET_DELETED = 'SpacesModule.SensorTarget.Deleted',
}

export enum SpaceType {
	ROOM = 'room',
	ZONE = 'zone',
}

/**
 * Room categories for SpaceType.ROOM
 * Represents physical rooms within a building
 */
export enum SpaceRoomCategory {
	LIVING_ROOM = 'living_room',
	BEDROOM = 'bedroom',
	BATHROOM = 'bathroom',
	TOILET = 'toilet',
	KITCHEN = 'kitchen',
	DINING_ROOM = 'dining_room',
	OFFICE = 'office',
	GARAGE = 'garage',
	HALLWAY = 'hallway',
	ENTRYWAY = 'entryway',
	LAUNDRY = 'laundry',
	UTILITY_ROOM = 'utility_room',
	STORAGE = 'storage',
	CLOSET = 'closet',
	PANTRY = 'pantry',
	NURSERY = 'nursery',
	GUEST_ROOM = 'guest_room',
	GYM = 'gym',
	MEDIA_ROOM = 'media_room',
	WORKSHOP = 'workshop',
	OTHER = 'other',
}

/**
 * Zone categories for SpaceType.ZONE
 * Represents logical groupings or areas that aggregate multiple rooms/spaces
 */
export enum SpaceZoneCategory {
	// Floor zones
	FLOOR_GROUND = 'floor_ground',
	FLOOR_FIRST = 'floor_first',
	FLOOR_SECOND = 'floor_second',
	FLOOR_BASEMENT = 'floor_basement',
	FLOOR_ATTIC = 'floor_attic',
	// Outdoor areas
	OUTDOOR_FRONT_YARD = 'outdoor_front_yard',
	OUTDOOR_BACKYARD = 'outdoor_backyard',
	OUTDOOR_DRIVEWAY = 'outdoor_driveway',
	OUTDOOR_GARDEN = 'outdoor_garden',
	OUTDOOR_TERRACE = 'outdoor_terrace',
	OUTDOOR_BALCONY = 'outdoor_balcony',
	OUTDOOR_WALKWAY = 'outdoor_walkway',
	// Security
	SECURITY_PERIMETER = 'security_perimeter',
	// Utility
	UTILITY = 'utility',
	// Other
	OTHER = 'zone_other',
}

/**
 * Legacy category value that needs normalization.
 * Maps to SpaceZoneCategory.OUTDOOR_GARDEN for backward compatibility.
 */
export const LEGACY_OUTDOOR_CATEGORY = 'outdoor';

/**
 * Combined SpaceCategory type for entity compatibility
 * The actual validation is done based on SpaceType
 * @deprecated Use SpaceRoomCategory or SpaceZoneCategory based on SpaceType
 */
export type SpaceCategory = SpaceRoomCategory | SpaceZoneCategory;

/**
 * SpaceCategory enum for backward compatibility with existing code
 * Contains all values from both room and zone categories
 * @deprecated Use SpaceRoomCategory or SpaceZoneCategory based on SpaceType
 */
export const SpaceCategory = {
	...SpaceRoomCategory,
	...SpaceZoneCategory,
} as const;

/**
 * Array of all room category values for validation
 */
export const SPACE_ROOM_CATEGORIES = Object.values(SpaceRoomCategory);

/**
 * Array of all zone category values for validation
 */
export const SPACE_ZONE_CATEGORIES = Object.values(SpaceZoneCategory);

/**
 * Floor zone categories - zones that represent building floors
 * Devices cannot be explicitly assigned to floor zones (membership is derived from room hierarchy)
 */
export const FLOOR_ZONE_CATEGORIES: SpaceZoneCategory[] = [
	SpaceZoneCategory.FLOOR_GROUND,
	SpaceZoneCategory.FLOOR_FIRST,
	SpaceZoneCategory.FLOOR_SECOND,
	SpaceZoneCategory.FLOOR_BASEMENT,
	SpaceZoneCategory.FLOOR_ATTIC,
];

/**
 * Check if a category is a floor zone category
 * Floor zones cannot have devices explicitly assigned (membership is derived from room→zone hierarchy)
 */
export function isFloorZoneCategory(category: string | null): boolean {
	if (category === null) {
		return false;
	}
	return FLOOR_ZONE_CATEGORIES.includes(category as SpaceZoneCategory);
}

/**
 * Array of all category values (room + zone) for validation
 */
export const ALL_SPACE_CATEGORIES = [...SPACE_ROOM_CATEGORIES, ...SPACE_ZONE_CATEGORIES];

/**
 * Check if a category is valid for a given space type
 */
export function isValidCategoryForType(category: string | null, type: SpaceType): boolean {
	if (category === null) {
		return true; // null is always valid
	}

	// Handle legacy 'outdoor' value for zones
	if (category === LEGACY_OUTDOOR_CATEGORY && type === SpaceType.ZONE) {
		return true;
	}

	if (type === SpaceType.ROOM) {
		return SPACE_ROOM_CATEGORIES.includes(category as SpaceRoomCategory);
	}

	if (type === SpaceType.ZONE) {
		return SPACE_ZONE_CATEGORIES.includes(category as SpaceZoneCategory);
	}

	return false;
}

/**
 * Normalize legacy category values to current enum values
 * Currently handles 'outdoor' -> 'outdoor_garden' for zones
 */
export function normalizeCategoryValue(category: string | null, type: SpaceType): SpaceCategory | null {
	if (category === null) {
		return null;
	}

	// Normalize legacy 'outdoor' to 'outdoor_garden' for zones
	if (category === LEGACY_OUTDOOR_CATEGORY && type === SpaceType.ZONE) {
		return SpaceZoneCategory.OUTDOOR_GARDEN;
	}

	return category as SpaceCategory;
}

/**
 * Template definition for a space category
 */
export interface SpaceCategoryTemplate {
	category: SpaceCategory;
	icon: string;
	description: string;
}

/**
 * Default templates for room categories
 */
export const SPACE_ROOM_CATEGORY_TEMPLATES: Record<SpaceRoomCategory, Omit<SpaceCategoryTemplate, 'category'>> = {
	[SpaceRoomCategory.LIVING_ROOM]: {
		icon: 'mdi:sofa',
		description: 'Main living and entertainment area',
	},
	[SpaceRoomCategory.BEDROOM]: {
		icon: 'mdi:bed',
		description: 'Sleeping and personal space',
	},
	[SpaceRoomCategory.BATHROOM]: {
		icon: 'mdi:shower',
		description: 'Full bathroom with shower or bathtub',
	},
	[SpaceRoomCategory.TOILET]: {
		icon: 'mdi:toilet',
		description: 'Toilet or half bathroom',
	},
	[SpaceRoomCategory.KITCHEN]: {
		icon: 'mdi:stove',
		description: 'Food preparation and cooking area',
	},
	[SpaceRoomCategory.DINING_ROOM]: {
		icon: 'mdi:silverware-fork-knife',
		description: 'Dining and eating area',
	},
	[SpaceRoomCategory.OFFICE]: {
		icon: 'mdi:desk',
		description: 'Home office or work space',
	},
	[SpaceRoomCategory.GARAGE]: {
		icon: 'mdi:garage',
		description: 'Vehicle storage and workshop area',
	},
	[SpaceRoomCategory.HALLWAY]: {
		icon: 'mdi:door-open',
		description: 'Corridor and passage area',
	},
	[SpaceRoomCategory.ENTRYWAY]: {
		icon: 'mdi:door',
		description: 'Main entrance and foyer area',
	},
	[SpaceRoomCategory.LAUNDRY]: {
		icon: 'mdi:washing-machine',
		description: 'Laundry room with washer and dryer',
	},
	[SpaceRoomCategory.UTILITY_ROOM]: {
		icon: 'mdi:water-boiler',
		description: 'Utility room with mechanical systems',
	},
	[SpaceRoomCategory.STORAGE]: {
		icon: 'mdi:package-variant-closed',
		description: 'General storage space',
	},
	[SpaceRoomCategory.CLOSET]: {
		icon: 'mdi:wardrobe',
		description: 'Walk-in closet or wardrobe room',
	},
	[SpaceRoomCategory.PANTRY]: {
		icon: 'mdi:food-variant',
		description: 'Food storage and pantry',
	},
	[SpaceRoomCategory.NURSERY]: {
		icon: 'mdi:baby-carriage',
		description: 'Baby or child room',
	},
	[SpaceRoomCategory.GUEST_ROOM]: {
		icon: 'mdi:account-multiple',
		description: 'Guest bedroom or accommodation',
	},
	[SpaceRoomCategory.GYM]: {
		icon: 'mdi:dumbbell',
		description: 'Home gym or exercise area',
	},
	[SpaceRoomCategory.MEDIA_ROOM]: {
		icon: 'mdi:television',
		description: 'Home theater or media room',
	},
	[SpaceRoomCategory.WORKSHOP]: {
		icon: 'mdi:hammer-wrench',
		description: 'DIY workshop or hobby area',
	},
	[SpaceRoomCategory.OTHER]: {
		icon: 'mdi:home',
		description: 'Other or custom room',
	},
};

/**
 * Default templates for zone categories
 */
export const SPACE_ZONE_CATEGORY_TEMPLATES: Record<SpaceZoneCategory, Omit<SpaceCategoryTemplate, 'category'>> = {
	// Floor zones
	[SpaceZoneCategory.FLOOR_GROUND]: {
		icon: 'mdi:home-floor-0',
		description: 'Ground floor level',
	},
	[SpaceZoneCategory.FLOOR_FIRST]: {
		icon: 'mdi:home-floor-1',
		description: 'First floor level',
	},
	[SpaceZoneCategory.FLOOR_SECOND]: {
		icon: 'mdi:home-floor-2',
		description: 'Second floor level',
	},
	[SpaceZoneCategory.FLOOR_BASEMENT]: {
		icon: 'mdi:home-floor-b',
		description: 'Basement level',
	},
	[SpaceZoneCategory.FLOOR_ATTIC]: {
		icon: 'mdi:home-roof',
		description: 'Attic level',
	},
	// Outdoor areas
	[SpaceZoneCategory.OUTDOOR_FRONT_YARD]: {
		icon: 'mdi:home-import-outline',
		description: 'Front yard area',
	},
	[SpaceZoneCategory.OUTDOOR_BACKYARD]: {
		icon: 'mdi:home-export-outline',
		description: 'Backyard area',
	},
	[SpaceZoneCategory.OUTDOOR_DRIVEWAY]: {
		icon: 'mdi:road-variant',
		description: 'Driveway and parking area',
	},
	[SpaceZoneCategory.OUTDOOR_GARDEN]: {
		icon: 'mdi:flower',
		description: 'Garden and landscaped area',
	},
	[SpaceZoneCategory.OUTDOOR_TERRACE]: {
		icon: 'mdi:grill',
		description: 'Terrace or patio area',
	},
	[SpaceZoneCategory.OUTDOOR_BALCONY]: {
		icon: 'mdi:balcony',
		description: 'Balcony or veranda',
	},
	[SpaceZoneCategory.OUTDOOR_WALKWAY]: {
		icon: 'mdi:walk',
		description: 'Outdoor walkway or path',
	},
	// Security
	[SpaceZoneCategory.SECURITY_PERIMETER]: {
		icon: 'mdi:shield-home',
		description: 'Security perimeter zone',
	},
	// Utility
	[SpaceZoneCategory.UTILITY]: {
		icon: 'mdi:tools',
		description: 'Utility and service zone',
	},
	// Other
	[SpaceZoneCategory.OTHER]: {
		icon: 'mdi:map-marker',
		description: 'Other or custom zone',
	},
};

/**
 * Combined templates for all space categories (room + zone)
 * For backward compatibility
 */
export const SPACE_CATEGORY_TEMPLATES: Record<string, Omit<SpaceCategoryTemplate, 'category'>> = {
	...SPACE_ROOM_CATEGORY_TEMPLATES,
	...SPACE_ZONE_CATEGORY_TEMPLATES,
};

// Lighting Intent Types
export enum LightingIntentType {
	// Space-level intents
	OFF = 'off',
	ON = 'on',
	SET_MODE = 'set_mode',
	BRIGHTNESS_DELTA = 'brightness_delta',
	// Role-specific intents
	ROLE_ON = 'role_on',
	ROLE_OFF = 'role_off',
	ROLE_BRIGHTNESS = 'role_brightness',
	ROLE_COLOR = 'role_color',
	ROLE_COLOR_TEMP = 'role_color_temp',
	ROLE_WHITE = 'role_white',
	// Combined role intent - set multiple properties at once
	ROLE_SET = 'role_set',
}

export enum LightingMode {
	OFF = 'off',
	WORK = 'work',
	RELAX = 'relax',
	NIGHT = 'night',
}

export enum BrightnessDelta {
	SMALL = 'small',
	MEDIUM = 'medium',
	LARGE = 'large',
}

// Brightness mappings for modes (percentage 0-100)
export const LIGHTING_MODE_BRIGHTNESS: Record<LightingMode, number> = {
	[LightingMode.OFF]: 0,
	[LightingMode.WORK]: 100,
	[LightingMode.RELAX]: 50,
	[LightingMode.NIGHT]: 20,
};

// Brightness delta steps (percentage points)
export const BRIGHTNESS_DELTA_STEPS: Record<BrightnessDelta, number> = {
	[BrightnessDelta.SMALL]: 10,
	[BrightnessDelta.MEDIUM]: 25,
	[BrightnessDelta.LARGE]: 50,
};

// Climate Intent Types
export enum ClimateIntentType {
	SETPOINT_DELTA = 'setpoint_delta',
	SETPOINT_SET = 'setpoint_set',
	SET_MODE = 'set_mode',
	// Combined intent - set multiple properties at once
	CLIMATE_SET = 'climate_set',
}

// Climate Modes - operating mode for climate domain
export enum ClimateMode {
	HEAT = 'heat', // Heating only - single setpoint
	COOL = 'cool', // Cooling only - single setpoint
	AUTO = 'auto', // Automatic - dual setpoints (heating lower, cooling upper)
	OFF = 'off', // All climate devices off
}

/**
 * Temperature averaging strategy for climate state calculation.
 * Determines which devices contribute to the averaged temperature reading.
 */
export enum TemperatureAveragingStrategy {
	/** Include all devices with temperature sensors, including SENSOR role devices */
	ALL_SOURCES = 'all_sources',
	/** Only include primary climate devices (thermostat, heater, AC) */
	PRIMARY_ONLY = 'primary_only',
}

/** Current temperature averaging strategy (MVP default) */
export const TEMPERATURE_AVERAGING_STRATEGY: TemperatureAveragingStrategy = TemperatureAveragingStrategy.PRIMARY_ONLY;

/**
 * Primary climate device categories.
 * These are the main heating/cooling control devices in the climate domain.
 */
export const CLIMATE_PRIMARY_DEVICE_CATEGORIES = [
	DeviceCategory.THERMOSTAT,
	DeviceCategory.HEATING_UNIT,
	DeviceCategory.AIR_CONDITIONER,
] as const;

// Climate setpoint step sizes (in degrees)
export enum SetpointDelta {
	SMALL = 'small',
	MEDIUM = 'medium',
	LARGE = 'large',
}

// Setpoint delta steps (degrees)
export const SETPOINT_DELTA_STEPS: Record<SetpointDelta, number> = {
	[SetpointDelta.SMALL]: 0.5,
	[SetpointDelta.MEDIUM]: 1.0,
	[SetpointDelta.LARGE]: 2.0,
};

// Default safe temperature limits when device doesn't specify (Celsius)
export const DEFAULT_MIN_SETPOINT = 5;
export const DEFAULT_MAX_SETPOINT = 35;

// Absolute validation limits for API input (covers all reasonable HVAC systems)
// Device-specific limits are enforced at the service layer
export const ABSOLUTE_MIN_SETPOINT = -10;
export const ABSOLUTE_MAX_SETPOINT = 50;

// Setpoint precision for rounding (degrees Celsius)
// All setpoints are rounded to this precision (e.g., 21.3 -> 21.5)
export const SETPOINT_PRECISION = 0.5;

// Setpoint consensus tolerance (degrees Celsius)
// When checking if multiple devices have "matching" setpoints, values within this tolerance are considered equal
export const SETPOINT_CONSENSUS_TOLERANCE = 0.5;

// Lighting Roles - classify lights within a space for intent-based control
export enum LightingRole {
	MAIN = 'main', // Primary/main lights (e.g., ceiling lights)
	TASK = 'task', // Task/work lights (e.g., desk lamps)
	AMBIENT = 'ambient', // Ambient/mood lights (e.g., accent strips)
	ACCENT = 'accent', // Accent/decorative lights (e.g., wall sconces)
	NIGHT = 'night', // Night/minimal lights (e.g., night lights)
	OTHER = 'other', // Unclassified lights
	HIDDEN = 'hidden', // Hidden lights (excluded from UI, not controlled by intents)
}

// Climate Roles - classify climate devices within a space for climate domain control
export enum ClimateRole {
	// Control roles (actuators) - specify operating mode for climate devices
	HEATING_ONLY = 'heating_only', // Device should only be used for heating
	COOLING_ONLY = 'cooling_only', // Device should only be used for cooling
	AUTO = 'auto', // Device can be used for both heating and cooling (automatic)
	AUXILIARY = 'auxiliary', // Auxiliary climate device (e.g., floor heating, towel warmer)
	// Read roles (sensors) - enable/disable sensors in climate domain
	SENSOR = 'sensor', // Sensor is included in climate domain readings
	// Exclusion
	HIDDEN = 'hidden', // Hidden devices/sensors (excluded from climate domain UI and control)
}

// Helper arrays for role categorization
export const CLIMATE_CONTROL_ROLES = [
	ClimateRole.HEATING_ONLY,
	ClimateRole.COOLING_ONLY,
	ClimateRole.AUTO,
	ClimateRole.AUXILIARY,
] as const;

export const CLIMATE_SENSOR_ROLES = [ClimateRole.SENSOR] as const;

// Roles that can apply to both actuators (device-level) and sensors (channel-level)
export const CLIMATE_UNIVERSAL_ROLES = [ClimateRole.HIDDEN] as const;

/**
 * Channel categories that are relevant for the climate domain sensors.
 * These sensor types will be displayed in the climate domain view page.
 */
export const CLIMATE_SENSOR_CHANNEL_CATEGORIES = [
	ChannelCategory.TEMPERATURE, // Temperature sensing
	ChannelCategory.HUMIDITY, // Humidity sensing
	ChannelCategory.AIR_QUALITY, // Air Quality Index (AQI)
	ChannelCategory.AIR_PARTICULATE, // PM2.5, PM10 particulate matter
	ChannelCategory.CARBON_DIOXIDE, // CO2 levels
	ChannelCategory.VOLATILE_ORGANIC_COMPOUNDS, // VOC levels
	ChannelCategory.PRESSURE, // Atmospheric pressure
] as const;

/**
 * Role-based lighting orchestration rules
 *
 * Each lighting mode targets specific roles with defined brightness levels.
 * null = turn OFF, number = set brightness to that level.
 *
 * Rules:
 * - WORK: main/task ON (high), ambient/accent OFF
 * - RELAX: main/ambient ON (medium), task OFF
 * - NIGHT: night lights ON (low), fallback to main if no night lights; all others OFF
 */
export interface RoleBrightnessRule {
	/** Brightness level (0-100) or null to turn off */
	brightness: number | null;
	/** Whether to turn on the light (true=on, false=off) */
	on: boolean;
}

/**
 * Role-based orchestration rules per lighting mode.
 * Keys are LightingRole values, values specify on/off and brightness.
 */
export type ModeOrchestrationRules = Partial<Record<LightingRole, RoleBrightnessRule>>;

/**
 * Complete role orchestration configuration per mode.
 * - roles: Rules for each role
 * - fallbackRoles: Roles to use if no matching roles are found (e.g., main for night mode)
 */
export interface ModeOrchestrationConfig {
	roles: ModeOrchestrationRules;
	/** Fallback roles if primary roles for the mode have no lights */
	fallbackRoles?: LightingRole[];
	/** Brightness to use for fallback (if different from normal) */
	fallbackBrightness?: number;
}

/**
 * Role-based orchestration rules for each lighting mode.
 *
 * Design decisions (documented per task requirements):
 * - WORK mode: main/task at 100%, ambient/accent OFF (not low - cleaner behavior)
 * - RELAX mode: main/ambient at 50%, task OFF (not low - cleaner behavior)
 * - NIGHT mode: night lights at 20%, fallback to main at 20% if no night lights; others OFF
 * - OTHER role is treated as ambient for relax mode, off for work mode
 * - Brightness delta applies to all currently ON lights (active set approach)
 */
// ========================
// Quick Action Types
// ========================

/**
 * Quick action types that can be pinned to a space page.
 * These are the available actions that admins can configure
 * to appear as quick action buttons on the panel.
 */
export enum QuickActionType {
	LIGHTING_OFF = 'lighting_off',
	LIGHTING_WORK = 'lighting_work',
	LIGHTING_RELAX = 'lighting_relax',
	LIGHTING_NIGHT = 'lighting_night',
	BRIGHTNESS_UP = 'brightness_up',
	BRIGHTNESS_DOWN = 'brightness_down',
	CLIMATE_UP = 'climate_up',
	CLIMATE_DOWN = 'climate_down',
}

/**
 * Default quick actions shown when none are configured.
 * Provides a sensible default set of lighting controls.
 */
export const DEFAULT_QUICK_ACTIONS: QuickActionType[] = [
	QuickActionType.LIGHTING_OFF,
	QuickActionType.LIGHTING_WORK,
	QuickActionType.LIGHTING_RELAX,
	QuickActionType.LIGHTING_NIGHT,
];

/**
 * All available quick actions for validation
 */
export const ALL_QUICK_ACTION_TYPES = Object.values(QuickActionType);

// ========================
// Suggestion System Constants
// ========================

/**
 * Suggestion types available in the system
 */
export enum SuggestionType {
	LIGHTING_RELAX = 'lighting_relax',
	LIGHTING_NIGHT = 'lighting_night',
	LIGHTING_OFF = 'lighting_off',
}

/**
 * Suggestion feedback types for tracking user interaction
 */
export enum SuggestionFeedback {
	APPLIED = 'applied',
	DISMISSED = 'dismissed',
}

/**
 * Cooldown period for suggestions in milliseconds (30 minutes)
 */
export const SUGGESTION_COOLDOWN_MS = 30 * 60 * 1000;

/**
 * Space categories that support night mode suggestions
 */
export const BEDROOM_SPACE_PATTERNS = ['bedroom', 'schlafzimmer', 'ložnice', 'chambre'];

export const LIGHTING_MODE_ORCHESTRATION: Record<LightingMode, ModeOrchestrationConfig> = {
	[LightingMode.OFF]: {
		roles: {
			[LightingRole.MAIN]: { on: false, brightness: null },
			[LightingRole.TASK]: { on: false, brightness: null },
			[LightingRole.AMBIENT]: { on: false, brightness: null },
			[LightingRole.ACCENT]: { on: false, brightness: null },
			[LightingRole.NIGHT]: { on: false, brightness: null },
			[LightingRole.OTHER]: { on: false, brightness: null },
		},
	},
	[LightingMode.WORK]: {
		roles: {
			[LightingRole.MAIN]: { on: true, brightness: 100 },
			[LightingRole.TASK]: { on: true, brightness: 100 },
			[LightingRole.AMBIENT]: { on: false, brightness: null },
			[LightingRole.ACCENT]: { on: false, brightness: null },
			[LightingRole.NIGHT]: { on: false, brightness: null },
			[LightingRole.OTHER]: { on: false, brightness: null },
			// Note: HIDDEN lights are filtered out before intent processing
		},
	},
	[LightingMode.RELAX]: {
		roles: {
			[LightingRole.MAIN]: { on: true, brightness: 50 },
			[LightingRole.TASK]: { on: false, brightness: null },
			[LightingRole.AMBIENT]: { on: true, brightness: 50 },
			[LightingRole.ACCENT]: { on: true, brightness: 30 },
			[LightingRole.NIGHT]: { on: false, brightness: null },
			[LightingRole.OTHER]: { on: true, brightness: 50 },
			// Note: HIDDEN lights are filtered out before intent processing
		},
	},
	[LightingMode.NIGHT]: {
		roles: {
			[LightingRole.MAIN]: { on: false, brightness: null },
			[LightingRole.TASK]: { on: false, brightness: null },
			[LightingRole.AMBIENT]: { on: false, brightness: null },
			[LightingRole.ACCENT]: { on: false, brightness: null },
			[LightingRole.NIGHT]: { on: true, brightness: 20 },
			[LightingRole.OTHER]: { on: false, brightness: null },
			// Note: HIDDEN lights are filtered out before intent processing
		},
		// If no night lights exist, fallback to main at low brightness
		fallbackRoles: [LightingRole.MAIN],
		fallbackBrightness: 20,
	},
};

// ========================
// Intent Catalog Types
// ========================

/**
 * Intent category - the domain of control
 */
export enum IntentCategory {
	LIGHTING = 'lighting',
	CLIMATE = 'climate',
	COVERS = 'covers',
	MEDIA = 'media',
}

/**
 * Metadata for an enum value used in intent parameters
 */
export interface IntentEnumValueMeta {
	value: string;
	label: string;
	description?: string;
	icon?: string;
}

/**
 * Parameter type for intent catalog
 */
export type IntentParamType = 'enum' | 'boolean' | 'number' | 'string';

/**
 * Metadata for an intent parameter
 */
export interface IntentParamMeta {
	name: string;
	type: IntentParamType;
	required: boolean;
	description: string;
	enumValues?: IntentEnumValueMeta[];
	minValue?: number;
	maxValue?: number;
}

/**
 * Metadata for an intent type
 */
export interface IntentTypeMeta {
	type: string;
	label: string;
	description: string;
	icon: string;
	params: IntentParamMeta[];
}

/**
 * Metadata for an intent category
 */
export interface IntentCategoryMeta {
	category: IntentCategory;
	label: string;
	description: string;
	icon: string;
	intents: IntentTypeMeta[];
}

/**
 * Metadata for a quick action
 */
export interface QuickActionMeta {
	type: QuickActionType;
	label: string;
	description: string;
	icon: string;
	category: IntentCategory;
}

// ========================
// Intent Catalog Data
// ========================

/**
 * Metadata for lighting modes
 */
export const LIGHTING_MODE_META: Record<LightingMode, IntentEnumValueMeta> = {
	[LightingMode.OFF]: {
		value: LightingMode.OFF,
		label: 'Off',
		description: 'All lights off',
		icon: 'mdi:lightbulb-off',
	},
	[LightingMode.WORK]: {
		value: LightingMode.WORK,
		label: 'Work',
		description: 'Bright lighting for focus and productivity',
		icon: 'mdi:briefcase',
	},
	[LightingMode.RELAX]: {
		value: LightingMode.RELAX,
		label: 'Relax',
		description: 'Soft ambient lighting for relaxation',
		icon: 'mdi:sofa',
	},
	[LightingMode.NIGHT]: {
		value: LightingMode.NIGHT,
		label: 'Night',
		description: 'Minimal lighting for nighttime',
		icon: 'mdi:weather-night',
	},
};

/**
 * Metadata for brightness delta values
 */
export const BRIGHTNESS_DELTA_META: Record<BrightnessDelta, IntentEnumValueMeta> = {
	[BrightnessDelta.SMALL]: {
		value: BrightnessDelta.SMALL,
		label: 'Small',
		description: `Adjust brightness by ${BRIGHTNESS_DELTA_STEPS[BrightnessDelta.SMALL]}%`,
	},
	[BrightnessDelta.MEDIUM]: {
		value: BrightnessDelta.MEDIUM,
		label: 'Medium',
		description: `Adjust brightness by ${BRIGHTNESS_DELTA_STEPS[BrightnessDelta.MEDIUM]}%`,
	},
	[BrightnessDelta.LARGE]: {
		value: BrightnessDelta.LARGE,
		label: 'Large',
		description: `Adjust brightness by ${BRIGHTNESS_DELTA_STEPS[BrightnessDelta.LARGE]}%`,
	},
};

/**
 * Metadata for setpoint delta values
 */
export const SETPOINT_DELTA_META: Record<SetpointDelta, IntentEnumValueMeta> = {
	[SetpointDelta.SMALL]: {
		value: SetpointDelta.SMALL,
		label: 'Small',
		description: `Adjust temperature by ${SETPOINT_DELTA_STEPS[SetpointDelta.SMALL]}°`,
	},
	[SetpointDelta.MEDIUM]: {
		value: SetpointDelta.MEDIUM,
		label: 'Medium',
		description: `Adjust temperature by ${SETPOINT_DELTA_STEPS[SetpointDelta.MEDIUM]}°`,
	},
	[SetpointDelta.LARGE]: {
		value: SetpointDelta.LARGE,
		label: 'Large',
		description: `Adjust temperature by ${SETPOINT_DELTA_STEPS[SetpointDelta.LARGE]}°`,
	},
};

/**
 * Metadata for lighting role values
 */
export const LIGHTING_ROLE_META: Record<LightingRole, IntentEnumValueMeta> = {
	[LightingRole.MAIN]: {
		value: LightingRole.MAIN,
		label: 'Main',
		description: 'Primary/ceiling lights',
		icon: 'mdi:ceiling-light',
	},
	[LightingRole.TASK]: {
		value: LightingRole.TASK,
		label: 'Task',
		description: 'Task/work lights (e.g., desk lamps)',
		icon: 'mdi:desk-lamp',
	},
	[LightingRole.AMBIENT]: {
		value: LightingRole.AMBIENT,
		label: 'Ambient',
		description: 'Ambient/mood lights (e.g., accent strips)',
		icon: 'mdi:led-strip-variant',
	},
	[LightingRole.ACCENT]: {
		value: LightingRole.ACCENT,
		label: 'Accent',
		description: 'Accent/decorative lights (e.g., wall sconces)',
		icon: 'mdi:wall-sconce',
	},
	[LightingRole.NIGHT]: {
		value: LightingRole.NIGHT,
		label: 'Night',
		description: 'Night/minimal lights',
		icon: 'mdi:lightbulb-night',
	},
	[LightingRole.OTHER]: {
		value: LightingRole.OTHER,
		label: 'Other',
		description: 'Unclassified lights',
		icon: 'mdi:lightbulb',
	},
	[LightingRole.HIDDEN]: {
		value: LightingRole.HIDDEN,
		label: 'Hidden',
		description: 'Hidden lights (excluded from UI)',
		icon: 'mdi:eye-off',
	},
};

/**
 * Metadata for climate role values
 */
export const CLIMATE_ROLE_META: Record<ClimateRole, IntentEnumValueMeta> = {
	[ClimateRole.HEATING_ONLY]: {
		value: ClimateRole.HEATING_ONLY,
		label: 'Heating Only',
		description: 'Device is used only for heating',
		icon: 'mdi:fire',
	},
	[ClimateRole.COOLING_ONLY]: {
		value: ClimateRole.COOLING_ONLY,
		label: 'Cooling Only',
		description: 'Device is used only for cooling',
		icon: 'mdi:snowflake',
	},
	[ClimateRole.AUTO]: {
		value: ClimateRole.AUTO,
		label: 'Auto',
		description: 'Device is used for both heating and cooling',
		icon: 'mdi:thermostat-auto',
	},
	[ClimateRole.AUXILIARY]: {
		value: ClimateRole.AUXILIARY,
		label: 'Auxiliary',
		description: 'Auxiliary climate device (e.g., floor heating, towel warmer)',
		icon: 'mdi:radiator',
	},
	[ClimateRole.SENSOR]: {
		value: ClimateRole.SENSOR,
		label: 'Sensor',
		description: 'Sensor is included in climate domain readings',
		icon: 'mdi:thermometer',
	},
	[ClimateRole.HIDDEN]: {
		value: ClimateRole.HIDDEN,
		label: 'Hidden',
		description: 'Device/sensor is excluded from climate domain',
		icon: 'mdi:eye-off',
	},
};

/**
 * Metadata for climate mode values
 */
export const CLIMATE_MODE_META: Record<ClimateMode, IntentEnumValueMeta> = {
	[ClimateMode.HEAT]: {
		value: ClimateMode.HEAT,
		label: 'Heat',
		description: 'Heating mode - single setpoint for all heaters',
		icon: 'mdi:fire',
	},
	[ClimateMode.COOL]: {
		value: ClimateMode.COOL,
		label: 'Cool',
		description: 'Cooling mode - single setpoint for all coolers',
		icon: 'mdi:snowflake',
	},
	[ClimateMode.AUTO]: {
		value: ClimateMode.AUTO,
		label: 'Auto',
		description: 'Automatic mode - dual setpoints for heating (lower) and cooling (upper)',
		icon: 'mdi:thermostat-auto',
	},
	[ClimateMode.OFF]: {
		value: ClimateMode.OFF,
		label: 'Off',
		description: 'Turn off all climate devices',
		icon: 'mdi:power-off',
	},
};

/**
 * Complete lighting intent catalog
 */
export const LIGHTING_INTENT_CATALOG: IntentTypeMeta[] = [
	{
		type: LightingIntentType.OFF,
		label: 'Turn Off',
		description: 'Turn off all lights in the space',
		icon: 'mdi:lightbulb-off',
		params: [],
	},
	{
		type: LightingIntentType.ON,
		label: 'Turn On',
		description: 'Turn on all lights in the space',
		icon: 'mdi:lightbulb-on',
		params: [],
	},
	{
		type: LightingIntentType.SET_MODE,
		label: 'Set Mode',
		description: 'Set a lighting mode (work/relax/night) with role-based brightness levels',
		icon: 'mdi:lightbulb-group',
		params: [
			{
				name: 'mode',
				type: 'enum',
				required: true,
				description: 'The lighting mode to apply',
				enumValues: Object.values(LIGHTING_MODE_META),
			},
		],
	},
	{
		type: LightingIntentType.BRIGHTNESS_DELTA,
		label: 'Adjust Brightness',
		description: 'Increase or decrease brightness of currently on lights',
		icon: 'mdi:brightness-6',
		params: [
			{
				name: 'delta',
				type: 'enum',
				required: true,
				description: 'The step size for brightness adjustment',
				enumValues: Object.values(BRIGHTNESS_DELTA_META),
			},
			{
				name: 'increase',
				type: 'boolean',
				required: true,
				description: 'True to increase brightness, false to decrease',
			},
		],
	},
	// Role-specific intents
	{
		type: LightingIntentType.ROLE_ON,
		label: 'Turn Role On',
		description: 'Turn on all lights with a specific role',
		icon: 'mdi:lightbulb-on',
		params: [
			{
				name: 'role',
				type: 'enum',
				required: true,
				description: 'The lighting role to control',
				enumValues: Object.values(LIGHTING_ROLE_META).filter((r) => r.value !== (LightingRole.HIDDEN as string)),
			},
		],
	},
	{
		type: LightingIntentType.ROLE_OFF,
		label: 'Turn Role Off',
		description: 'Turn off all lights with a specific role',
		icon: 'mdi:lightbulb-off',
		params: [
			{
				name: 'role',
				type: 'enum',
				required: true,
				description: 'The lighting role to control',
				enumValues: Object.values(LIGHTING_ROLE_META).filter((r) => r.value !== (LightingRole.HIDDEN as string)),
			},
		],
	},
	{
		type: LightingIntentType.ROLE_BRIGHTNESS,
		label: 'Set Role Brightness',
		description: 'Set brightness for all lights with a specific role',
		icon: 'mdi:brightness-6',
		params: [
			{
				name: 'role',
				type: 'enum',
				required: true,
				description: 'The lighting role to control',
				enumValues: Object.values(LIGHTING_ROLE_META).filter((r) => r.value !== (LightingRole.HIDDEN as string)),
			},
			{
				name: 'brightness',
				type: 'number',
				required: true,
				description: 'Brightness level (0-100)',
				minValue: 0,
				maxValue: 100,
			},
		],
	},
	{
		type: LightingIntentType.ROLE_COLOR,
		label: 'Set Role Color',
		description: 'Set color for all lights with a specific role that support color',
		icon: 'mdi:palette',
		params: [
			{
				name: 'role',
				type: 'enum',
				required: true,
				description: 'The lighting role to control',
				enumValues: Object.values(LIGHTING_ROLE_META).filter((r) => r.value !== (LightingRole.HIDDEN as string)),
			},
			{
				name: 'color',
				type: 'string',
				required: true,
				description: 'Color as hex string (e.g., #ff6b35)',
			},
		],
	},
	{
		type: LightingIntentType.ROLE_COLOR_TEMP,
		label: 'Set Role Color Temperature',
		description: 'Set color temperature for all lights with a specific role that support it',
		icon: 'mdi:thermometer-lines',
		params: [
			{
				name: 'role',
				type: 'enum',
				required: true,
				description: 'The lighting role to control',
				enumValues: Object.values(LIGHTING_ROLE_META).filter((r) => r.value !== (LightingRole.HIDDEN as string)),
			},
			{
				name: 'color_temperature',
				type: 'number',
				required: true,
				description: 'Color temperature in Kelvin (e.g., 2700-6500)',
				minValue: 1000,
				maxValue: 10000,
			},
		],
	},
	{
		type: LightingIntentType.ROLE_WHITE,
		label: 'Set Role White Level',
		description: 'Set white channel level for all lights with a specific role that support RGBW',
		icon: 'mdi:lightbulb',
		params: [
			{
				name: 'role',
				type: 'enum',
				required: true,
				description: 'The lighting role to control',
				enumValues: Object.values(LIGHTING_ROLE_META).filter((r) => r.value !== (LightingRole.HIDDEN as string)),
			},
			{
				name: 'white',
				type: 'number',
				required: true,
				description: 'White level (0-100)',
				minValue: 0,
				maxValue: 100,
			},
		],
	},
	{
		type: LightingIntentType.ROLE_SET,
		label: 'Set Role Properties',
		description:
			'Set multiple properties at once for all lights with a specific role (on/off, brightness, color, temperature, white)',
		icon: 'mdi:tune-variant',
		params: [
			{
				name: 'role',
				type: 'enum',
				required: true,
				description: 'The lighting role to control',
				enumValues: Object.values(LIGHTING_ROLE_META).filter((r) => r.value !== (LightingRole.HIDDEN as string)),
			},
			{
				name: 'on',
				type: 'boolean',
				required: false,
				description: 'Turn lights on (true) or off (false)',
			},
			{
				name: 'brightness',
				type: 'number',
				required: false,
				description: 'Brightness level (0-100)',
				minValue: 0,
				maxValue: 100,
			},
			{
				name: 'color',
				type: 'string',
				required: false,
				description: 'Color as hex string (e.g., #ff6b35)',
			},
			{
				name: 'color_temperature',
				type: 'number',
				required: false,
				description: 'Color temperature in Kelvin (e.g., 2700-6500)',
				minValue: 1000,
				maxValue: 10000,
			},
			{
				name: 'white',
				type: 'number',
				required: false,
				description: 'White level (0-100)',
				minValue: 0,
				maxValue: 100,
			},
		],
	},
];

/**
 * Complete climate intent catalog
 */
export const CLIMATE_INTENT_CATALOG: IntentTypeMeta[] = [
	{
		type: ClimateIntentType.SETPOINT_DELTA,
		label: 'Adjust Temperature',
		description: 'Increase or decrease the target temperature based on current mode',
		icon: 'mdi:thermometer',
		params: [
			{
				name: 'delta',
				type: 'enum',
				required: true,
				description: 'The step size for temperature adjustment',
				enumValues: Object.values(SETPOINT_DELTA_META),
			},
			{
				name: 'increase',
				type: 'boolean',
				required: true,
				description: 'True to increase temperature, false to decrease',
			},
		],
	},
	{
		type: ClimateIntentType.SETPOINT_SET,
		label: 'Set Temperature',
		description:
			'Set the target temperature. In HEAT/COOL mode sets single setpoint, in AUTO mode sets both heating and cooling setpoints.',
		icon: 'mdi:thermometer-check',
		params: [
			{
				name: 'value',
				type: 'number',
				required: true,
				description: 'The target temperature in degrees Celsius (single setpoint for HEAT/COOL modes)',
				minValue: ABSOLUTE_MIN_SETPOINT,
				maxValue: ABSOLUTE_MAX_SETPOINT,
			},
			{
				name: 'heatingSetpoint',
				type: 'number',
				required: false,
				description: 'The heating setpoint (lower bound) for AUTO mode',
				minValue: ABSOLUTE_MIN_SETPOINT,
				maxValue: ABSOLUTE_MAX_SETPOINT,
			},
			{
				name: 'coolingSetpoint',
				type: 'number',
				required: false,
				description: 'The cooling setpoint (upper bound) for AUTO mode',
				minValue: ABSOLUTE_MIN_SETPOINT,
				maxValue: ABSOLUTE_MAX_SETPOINT,
			},
		],
	},
	{
		type: ClimateIntentType.SET_MODE,
		label: 'Set Climate Mode',
		description: 'Change the climate operating mode (heat/cool/auto/off)',
		icon: 'mdi:thermostat',
		params: [
			{
				name: 'mode',
				type: 'enum',
				required: true,
				description: 'The climate mode to set',
				enumValues: Object.values(CLIMATE_MODE_META),
			},
		],
	},
	{
		type: ClimateIntentType.CLIMATE_SET,
		label: 'Set Climate Properties',
		description:
			'Set multiple climate properties at once (mode, setpoints). Allows atomic updates of mode and temperature in a single call.',
		icon: 'mdi:tune-variant',
		params: [
			{
				name: 'mode',
				type: 'enum',
				required: false,
				description: 'The climate mode to set (optional)',
				enumValues: Object.values(CLIMATE_MODE_META),
			},
			{
				name: 'value',
				type: 'number',
				required: false,
				description: 'The target temperature in degrees Celsius (single setpoint)',
				minValue: ABSOLUTE_MIN_SETPOINT,
				maxValue: ABSOLUTE_MAX_SETPOINT,
			},
			{
				name: 'heatingSetpoint',
				type: 'number',
				required: false,
				description: 'The heating setpoint (lower bound) for AUTO mode',
				minValue: ABSOLUTE_MIN_SETPOINT,
				maxValue: ABSOLUTE_MAX_SETPOINT,
			},
			{
				name: 'coolingSetpoint',
				type: 'number',
				required: false,
				description: 'The cooling setpoint (upper bound) for AUTO mode',
				minValue: ABSOLUTE_MIN_SETPOINT,
				maxValue: ABSOLUTE_MAX_SETPOINT,
			},
		],
	},
];

// ========================
// Covers Domain Constants
// ========================

/**
 * Covers Roles - classify window covering devices within a space for intent-based control
 */
export enum CoversRole {
	PRIMARY = 'primary', // Main window covering in the space
	BLACKOUT = 'blackout', // Light-blocking covers (for sleep/movie)
	SHEER = 'sheer', // Semi-transparent covers for privacy while allowing light
	OUTDOOR = 'outdoor', // External shutters/awnings
	HIDDEN = 'hidden', // Excluded from space-level control
}

/**
 * Covers Intent Types - space-level intents for window covering control
 */
export enum CoversIntentType {
	OPEN = 'open', // Open all covers (position=100)
	CLOSE = 'close', // Close all covers (position=0)
	STOP = 'stop', // Stop all covers movement
	SET_POSITION = 'set_position', // Set all covers to a specific position
	POSITION_DELTA = 'position_delta', // Adjust position by a delta
	ROLE_POSITION = 'role_position', // Set position for a specific role
	SET_MODE = 'set_mode', // Set a covers mode (open/closed/privacy/daylight)
}

/**
 * Covers Modes - preset position configurations for different scenarios
 */
export enum CoversMode {
	OPEN = 'open', // All at 100%
	CLOSED = 'closed', // All at 0%
	PRIVACY = 'privacy', // Sheer down (50%), others open
	DAYLIGHT = 'daylight', // Optimize for natural light
}

/**
 * Position delta sizes for covers adjustment
 */
export enum PositionDelta {
	SMALL = 'small',
	MEDIUM = 'medium',
	LARGE = 'large',
}

/**
 * Position delta steps (percentage points)
 */
export const POSITION_DELTA_STEPS: Record<PositionDelta, number> = {
	[PositionDelta.SMALL]: 10,
	[PositionDelta.MEDIUM]: 25,
	[PositionDelta.LARGE]: 50,
};

/**
 * Mode definitions for covers - maps each mode to role-specific positions
 * Position values: 0 = closed, 100 = open
 */
export interface CoversRolePositionRule {
	/** Position percentage (0-100) */
	position: number;
}

/**
 * Mode orchestration rules for covers
 */
export type CoversModeOrchestrationRules = Partial<Record<CoversRole, CoversRolePositionRule>>;

/**
 * Mode orchestration configuration for covers
 */
export const COVERS_MODE_ORCHESTRATION: Record<CoversMode, CoversModeOrchestrationRules> = {
	[CoversMode.OPEN]: {
		[CoversRole.PRIMARY]: { position: 100 },
		[CoversRole.BLACKOUT]: { position: 100 },
		[CoversRole.SHEER]: { position: 100 },
		[CoversRole.OUTDOOR]: { position: 100 },
	},
	[CoversMode.CLOSED]: {
		[CoversRole.PRIMARY]: { position: 0 },
		[CoversRole.BLACKOUT]: { position: 0 },
		[CoversRole.SHEER]: { position: 0 },
		[CoversRole.OUTDOOR]: { position: 0 },
	},
	[CoversMode.PRIVACY]: {
		[CoversRole.PRIMARY]: { position: 100 },
		[CoversRole.BLACKOUT]: { position: 100 },
		[CoversRole.SHEER]: { position: 50 },
		[CoversRole.OUTDOOR]: { position: 100 },
	},
	[CoversMode.DAYLIGHT]: {
		[CoversRole.PRIMARY]: { position: 75 },
		[CoversRole.BLACKOUT]: { position: 100 },
		[CoversRole.SHEER]: { position: 75 },
		[CoversRole.OUTDOOR]: { position: 50 },
	},
};

/**
 * Metadata for covers role values
 */
export const COVERS_ROLE_META: Record<CoversRole, IntentEnumValueMeta> = {
	[CoversRole.PRIMARY]: {
		value: CoversRole.PRIMARY,
		label: 'Primary',
		description: 'Main window covering in the space',
		icon: 'mdi:blinds',
	},
	[CoversRole.BLACKOUT]: {
		value: CoversRole.BLACKOUT,
		label: 'Blackout',
		description: 'Light-blocking covers for sleep or movie',
		icon: 'mdi:blinds-horizontal-closed',
	},
	[CoversRole.SHEER]: {
		value: CoversRole.SHEER,
		label: 'Sheer',
		description: 'Semi-transparent covers for privacy',
		icon: 'mdi:blinds-vertical',
	},
	[CoversRole.OUTDOOR]: {
		value: CoversRole.OUTDOOR,
		label: 'Outdoor',
		description: 'External shutters or awnings',
		icon: 'mdi:window-shutter',
	},
	[CoversRole.HIDDEN]: {
		value: CoversRole.HIDDEN,
		label: 'Hidden',
		description: 'Excluded from space-level control',
		icon: 'mdi:eye-off',
	},
};

/**
 * Metadata for covers mode values
 */
export const COVERS_MODE_META: Record<CoversMode, IntentEnumValueMeta> = {
	[CoversMode.OPEN]: {
		value: CoversMode.OPEN,
		label: 'Open',
		description: 'All covers fully open',
		icon: 'mdi:blinds-open',
	},
	[CoversMode.CLOSED]: {
		value: CoversMode.CLOSED,
		label: 'Closed',
		description: 'All covers fully closed',
		icon: 'mdi:blinds',
	},
	[CoversMode.PRIVACY]: {
		value: CoversMode.PRIVACY,
		label: 'Privacy',
		description: 'Sheer covers down for privacy while allowing light',
		icon: 'mdi:blinds-vertical-closed',
	},
	[CoversMode.DAYLIGHT]: {
		value: CoversMode.DAYLIGHT,
		label: 'Daylight',
		description: 'Optimized for natural light',
		icon: 'mdi:white-balance-sunny',
	},
};

/**
 * Metadata for position delta values
 */
export const POSITION_DELTA_META: Record<PositionDelta, IntentEnumValueMeta> = {
	[PositionDelta.SMALL]: {
		value: PositionDelta.SMALL,
		label: 'Small',
		description: `Adjust position by ${POSITION_DELTA_STEPS[PositionDelta.SMALL]}%`,
	},
	[PositionDelta.MEDIUM]: {
		value: PositionDelta.MEDIUM,
		label: 'Medium',
		description: `Adjust position by ${POSITION_DELTA_STEPS[PositionDelta.MEDIUM]}%`,
	},
	[PositionDelta.LARGE]: {
		value: PositionDelta.LARGE,
		label: 'Large',
		description: `Adjust position by ${POSITION_DELTA_STEPS[PositionDelta.LARGE]}%`,
	},
};

/**
 * Complete covers intent catalog
 */
export const COVERS_INTENT_CATALOG: IntentTypeMeta[] = [
	{
		type: CoversIntentType.OPEN,
		label: 'Open All',
		description: 'Open all covers in the space',
		icon: 'mdi:blinds-open',
		params: [],
	},
	{
		type: CoversIntentType.CLOSE,
		label: 'Close All',
		description: 'Close all covers in the space',
		icon: 'mdi:blinds',
		params: [],
	},
	{
		type: CoversIntentType.STOP,
		label: 'Stop',
		description: 'Stop all covers movement',
		icon: 'mdi:stop',
		params: [],
	},
	{
		type: CoversIntentType.SET_POSITION,
		label: 'Set Position',
		description: 'Set all covers to a specific position (0-100)',
		icon: 'mdi:blinds-horizontal',
		params: [
			{
				name: 'position',
				type: 'number',
				required: true,
				description: 'Position percentage (0=closed, 100=open)',
				minValue: 0,
				maxValue: 100,
			},
		],
	},
	{
		type: CoversIntentType.POSITION_DELTA,
		label: 'Adjust Position',
		description: 'Increase or decrease cover positions',
		icon: 'mdi:arrow-up-down',
		params: [
			{
				name: 'delta',
				type: 'enum',
				required: true,
				description: 'The step size for position adjustment',
				enumValues: Object.values(POSITION_DELTA_META),
			},
			{
				name: 'increase',
				type: 'boolean',
				required: true,
				description: 'True to open more (increase position), false to close more (decrease position)',
			},
		],
	},
	{
		type: CoversIntentType.ROLE_POSITION,
		label: 'Set Role Position',
		description: 'Set position for covers with a specific role',
		icon: 'mdi:blinds-horizontal',
		params: [
			{
				name: 'role',
				type: 'enum',
				required: true,
				description: 'The covers role to control',
				enumValues: Object.values(COVERS_ROLE_META).filter((r) => r.value !== (CoversRole.HIDDEN as string)),
			},
			{
				name: 'position',
				type: 'number',
				required: true,
				description: 'Position percentage (0=closed, 100=open)',
				minValue: 0,
				maxValue: 100,
			},
		],
	},
	{
		type: CoversIntentType.SET_MODE,
		label: 'Set Mode',
		description: 'Set a covers mode (open/closed/privacy/daylight) with role-based positions',
		icon: 'mdi:window-shutter-settings',
		params: [
			{
				name: 'mode',
				type: 'enum',
				required: true,
				description: 'The covers mode to apply',
				enumValues: Object.values(COVERS_MODE_META),
			},
		],
	},
];

// ========================
// Media Domain Constants
// ========================

/**
 * Volume delta sizes for media adjustment
 */
export enum VolumeDelta {
	SMALL = 'small',
	MEDIUM = 'medium',
	LARGE = 'large',
}

/**
 * Volume delta steps (percentage points)
 */
export const VOLUME_DELTA_STEPS: Record<VolumeDelta, number> = {
	[VolumeDelta.SMALL]: 5,
	[VolumeDelta.MEDIUM]: 10,
	[VolumeDelta.LARGE]: 20,
};

/**
 * Media device categories for filtering
 *
 * Note:
 * - streaming_service is intentionally excluded from power orchestration;
 *   it can still participate in playback orchestration if you decide to map it as a device.
 */
export const MEDIA_DEVICE_CATEGORIES = [
	DeviceCategory.MEDIA,
	DeviceCategory.SPEAKER,
	DeviceCategory.TELEVISION,
	DeviceCategory.AV_RECEIVER,
	DeviceCategory.SET_TOP_BOX,
	DeviceCategory.GAME_CONSOLE,
	DeviceCategory.PROJECTOR,
	// Virtual playback sources (playback-only, excluded from power orchestration)
	DeviceCategory.STREAMING_SERVICE,
] as const;

/**
 * Media channel categories for filtering
 *
 * Important additions:
 * - SWITCHER: generic power control for AVR/STB/Console/Speaker/Media (optional per device)
 * - MEDIA_INPUT: source selection (TV/AVR)
 */
export const MEDIA_CHANNEL_CATEGORIES = [
	ChannelCategory.SWITCHER,
	ChannelCategory.SPEAKER,
	ChannelCategory.TELEVISION,
	ChannelCategory.MEDIA_INPUT,
	ChannelCategory.MEDIA_PLAYBACK,
] as const;

/**
 * Metadata for volume delta values
 */
export const VOLUME_DELTA_META: Record<VolumeDelta, IntentEnumValueMeta> = {
	[VolumeDelta.SMALL]: {
		value: VolumeDelta.SMALL,
		label: 'Small',
		description: `Adjust volume by ${VOLUME_DELTA_STEPS[VolumeDelta.SMALL]}%`,
	},
	[VolumeDelta.MEDIUM]: {
		value: VolumeDelta.MEDIUM,
		label: 'Medium',
		description: `Adjust volume by ${VOLUME_DELTA_STEPS[VolumeDelta.MEDIUM]}%`,
	},
	[VolumeDelta.LARGE]: {
		value: VolumeDelta.LARGE,
		label: 'Large',
		description: `Adjust volume by ${VOLUME_DELTA_STEPS[VolumeDelta.LARGE]}%`,
	},
};

// ========================
// Media Domain V2 - Endpoint/Routing Architecture
// ========================

/**
 * Media Endpoint Types - functional projections of media devices
 * A single device can expose multiple endpoints (e.g., TV as both display and audio_output)
 */
export enum MediaEndpointType {
	/** Display endpoint (TV, projector) - provides visual output */
	DISPLAY = 'display',
	/** Audio output endpoint (receiver, speaker, TV speaker) - provides audio output */
	AUDIO_OUTPUT = 'audio_output',
	/** Source endpoint (streamer, console, TV apps, HDMI input) - provides media content */
	SOURCE = 'source',
	/** Remote target endpoint (TV, streamer) - accepts remote control commands */
	REMOTE_TARGET = 'remote_target',
}

/**
 * Media Routing Types - activity presets that define endpoint configurations
 */
export enum MediaRoutingType {
	/** Watch routing - optimized for video content (TV + AVR + source) */
	WATCH = 'watch',
	/** Listen routing - optimized for audio content (speakers/AVR only) */
	LISTEN = 'listen',
	/** Gaming routing - optimized for gaming (low latency, game console) */
	GAMING = 'gaming',
	/** Background routing - ambient audio at low volume */
	BACKGROUND = 'background',
	/** Off routing - all media devices powered off */
	OFF = 'off',
	/** Custom routing - user-defined configuration */
	CUSTOM = 'custom',
}

/**
 * Media Power Policy - defines how power is handled during routing activation
 */
export enum MediaPowerPolicy {
	/** Power on all endpoints in the routing */
	ON = 'on',
	/** Power off all endpoints in the routing */
	OFF = 'off',
	/** Leave power state unchanged */
	UNCHANGED = 'unchanged',
}

/**
 * Media Input Policy - defines how input switching is handled during routing activation
 */
export enum MediaInputPolicy {
	/** Always switch inputs as configured */
	ALWAYS = 'always',
	/** Only switch inputs if device is currently on a different input */
	IF_DIFFERENT = 'if_different',
	/** Never switch inputs automatically */
	NEVER = 'never',
}

/**
 * Media Conflict Policy - defines how conflicts with existing routing are resolved
 */
export enum MediaConflictPolicy {
	/** Replace the current active routing immediately */
	REPLACE = 'replace',
	/** Fail activation if another routing is active */
	FAIL_IF_ACTIVE = 'fail_if_active',
	/** Deactivate current routing first, then activate new one */
	DEACTIVATE_FIRST = 'deactivate_first',
}

/**
 * Media Offline Policy - defines how offline devices are handled during activation
 */
export enum MediaOfflinePolicy {
	/** Skip offline devices and continue with available ones */
	SKIP = 'skip',
	/** Fail activation if any critical endpoint is offline */
	FAIL = 'fail',
	/** Wait for devices to come online (with timeout) */
	WAIT = 'wait',
}

/**
 * Media Activation State - state of the active routing
 */
export enum MediaActivationState {
	/** Routing is being activated */
	ACTIVATING = 'activating',
	/** Routing is fully active */
	ACTIVE = 'active',
	/** Routing activation failed (partial or complete) */
	FAILED = 'failed',
	/** Routing has been deactivated */
	DEACTIVATED = 'deactivated',
}

/**
 * Media Capability - individual capability that an endpoint can have
 */
export enum MediaCapability {
	POWER = 'power',
	VOLUME = 'volume',
	MUTE = 'mute',
	PLAYBACK = 'playback',
	PLAYBACK_STATE = 'playback_state',
	INPUT = 'input',
	REMOTE = 'remote',
	TRACK_METADATA = 'track_metadata',
}

/**
 * Media Capability Permission - read/write permissions for capabilities
 */
export enum MediaCapabilityPermission {
	READ = 'read',
	WRITE = 'write',
	READ_WRITE = 'read_write',
}

/**
 * Metadata for media endpoint types
 */
export const MEDIA_ENDPOINT_TYPE_META: Record<MediaEndpointType, IntentEnumValueMeta> = {
	[MediaEndpointType.DISPLAY]: {
		value: MediaEndpointType.DISPLAY,
		label: 'Display',
		description: 'Visual output device (TV, projector)',
		icon: 'mdi:television',
	},
	[MediaEndpointType.AUDIO_OUTPUT]: {
		value: MediaEndpointType.AUDIO_OUTPUT,
		label: 'Audio Output',
		description: 'Audio output device (receiver, speaker)',
		icon: 'mdi:speaker',
	},
	[MediaEndpointType.SOURCE]: {
		value: MediaEndpointType.SOURCE,
		label: 'Source',
		description: 'Media content source (streamer, console)',
		icon: 'mdi:play-box',
	},
	[MediaEndpointType.REMOTE_TARGET]: {
		value: MediaEndpointType.REMOTE_TARGET,
		label: 'Remote Target',
		description: 'Device that accepts remote commands',
		icon: 'mdi:remote',
	},
};

/**
 * Metadata for media routing types
 */
export const MEDIA_ROUTING_TYPE_META: Record<MediaRoutingType, IntentEnumValueMeta> = {
	[MediaRoutingType.WATCH]: {
		value: MediaRoutingType.WATCH,
		label: 'Watch',
		description: 'Watch video content (TV + audio)',
		icon: 'mdi:television-play',
	},
	[MediaRoutingType.LISTEN]: {
		value: MediaRoutingType.LISTEN,
		label: 'Listen',
		description: 'Listen to audio content',
		icon: 'mdi:music',
	},
	[MediaRoutingType.GAMING]: {
		value: MediaRoutingType.GAMING,
		label: 'Gaming',
		description: 'Play video games',
		icon: 'mdi:gamepad-variant',
	},
	[MediaRoutingType.BACKGROUND]: {
		value: MediaRoutingType.BACKGROUND,
		label: 'Background',
		description: 'Background ambient audio',
		icon: 'mdi:music-note',
	},
	[MediaRoutingType.OFF]: {
		value: MediaRoutingType.OFF,
		label: 'Off',
		description: 'Turn off all media',
		icon: 'mdi:power-off',
	},
	[MediaRoutingType.CUSTOM]: {
		value: MediaRoutingType.CUSTOM,
		label: 'Custom',
		description: 'Custom configuration',
		icon: 'mdi:cog',
	},
};

/**
 * Default routing configurations - used when auto-creating routings
 * Note: name and icon are derived from MEDIA_ROUTING_TYPE_META to avoid duplication
 */
export interface MediaRoutingDefaults {
	powerPolicy: MediaPowerPolicy;
	inputPolicy: MediaInputPolicy;
	conflictPolicy: MediaConflictPolicy;
	offlinePolicy: MediaOfflinePolicy;
	audioVolumePreset: number | null;
}

export const MEDIA_ROUTING_DEFAULTS: Record<MediaRoutingType, MediaRoutingDefaults> = {
	[MediaRoutingType.WATCH]: {
		powerPolicy: MediaPowerPolicy.ON,
		inputPolicy: MediaInputPolicy.ALWAYS,
		conflictPolicy: MediaConflictPolicy.REPLACE,
		offlinePolicy: MediaOfflinePolicy.SKIP,
		audioVolumePreset: 50,
	},
	[MediaRoutingType.LISTEN]: {
		powerPolicy: MediaPowerPolicy.ON,
		inputPolicy: MediaInputPolicy.IF_DIFFERENT,
		conflictPolicy: MediaConflictPolicy.REPLACE,
		offlinePolicy: MediaOfflinePolicy.SKIP,
		audioVolumePreset: 40,
	},
	[MediaRoutingType.GAMING]: {
		powerPolicy: MediaPowerPolicy.ON,
		inputPolicy: MediaInputPolicy.ALWAYS,
		conflictPolicy: MediaConflictPolicy.REPLACE,
		offlinePolicy: MediaOfflinePolicy.SKIP,
		audioVolumePreset: 60,
	},
	[MediaRoutingType.BACKGROUND]: {
		powerPolicy: MediaPowerPolicy.ON,
		inputPolicy: MediaInputPolicy.NEVER,
		conflictPolicy: MediaConflictPolicy.REPLACE,
		offlinePolicy: MediaOfflinePolicy.SKIP,
		audioVolumePreset: 25,
	},
	[MediaRoutingType.OFF]: {
		powerPolicy: MediaPowerPolicy.OFF,
		inputPolicy: MediaInputPolicy.NEVER,
		conflictPolicy: MediaConflictPolicy.REPLACE,
		offlinePolicy: MediaOfflinePolicy.SKIP,
		audioVolumePreset: null,
	},
	[MediaRoutingType.CUSTOM]: {
		powerPolicy: MediaPowerPolicy.UNCHANGED,
		inputPolicy: MediaInputPolicy.IF_DIFFERENT,
		conflictPolicy: MediaConflictPolicy.REPLACE,
		offlinePolicy: MediaOfflinePolicy.SKIP,
		audioVolumePreset: null,
	},
};

// ========================
// Media Capability Extractor Specifications
// ========================

/**
 * Capability extractor specification - defines what capabilities to look for
 * and how to extract them from device channels/properties
 */
export interface MediaCapabilityExtractorSpec {
	/** Device categories this extractor applies to */
	deviceCategories: DeviceCategory[];
	/** Endpoint types this device can provide */
	suggestedEndpoints: MediaEndpointType[];
	/** Required capabilities - device must have these to be useful */
	requiredCapabilities: MediaCapability[];
	/** Optional capabilities - nice to have but not required */
	optionalCapabilities: MediaCapability[];
	/** Channel categories to search for capabilities */
	channelCategories: ChannelCategory[];
	/** Fallback rules when primary capability source is unavailable */
	fallbackRules?: {
		capability: MediaCapability;
		fallbackTo?: MediaCapability;
		skipIfUnavailable: boolean;
	}[];
}

/**
 * Capability extractor specifications by device category.
 * These define how to detect media capabilities for each device type.
 */
export const MEDIA_CAPABILITY_EXTRACTOR_SPECS: MediaCapabilityExtractorSpec[] = [
	// TV / Projector - Display devices
	{
		deviceCategories: [DeviceCategory.TELEVISION, DeviceCategory.PROJECTOR],
		suggestedEndpoints: [MediaEndpointType.DISPLAY, MediaEndpointType.AUDIO_OUTPUT, MediaEndpointType.REMOTE_TARGET],
		requiredCapabilities: [MediaCapability.POWER],
		optionalCapabilities: [
			MediaCapability.VOLUME,
			MediaCapability.MUTE,
			MediaCapability.INPUT,
			MediaCapability.REMOTE,
			MediaCapability.PLAYBACK,
		],
		channelCategories: [ChannelCategory.TELEVISION, ChannelCategory.SWITCHER, ChannelCategory.SPEAKER],
		fallbackRules: [
			{
				capability: MediaCapability.VOLUME,
				skipIfUnavailable: true, // TV audio may be handled by external receiver
			},
		],
	},
	// AV Receiver - Audio routing hub
	{
		deviceCategories: [DeviceCategory.AV_RECEIVER],
		suggestedEndpoints: [MediaEndpointType.AUDIO_OUTPUT, MediaEndpointType.SOURCE],
		requiredCapabilities: [MediaCapability.POWER, MediaCapability.VOLUME],
		optionalCapabilities: [MediaCapability.MUTE, MediaCapability.INPUT],
		channelCategories: [ChannelCategory.SPEAKER, ChannelCategory.SWITCHER, ChannelCategory.MEDIA_INPUT],
		fallbackRules: [],
	},
	// Speaker - Simple audio output
	{
		deviceCategories: [DeviceCategory.SPEAKER],
		suggestedEndpoints: [MediaEndpointType.AUDIO_OUTPUT],
		requiredCapabilities: [MediaCapability.VOLUME],
		optionalCapabilities: [MediaCapability.POWER, MediaCapability.MUTE, MediaCapability.PLAYBACK],
		channelCategories: [ChannelCategory.SPEAKER, ChannelCategory.SWITCHER, ChannelCategory.MEDIA_PLAYBACK],
		fallbackRules: [
			{
				capability: MediaCapability.POWER,
				skipIfUnavailable: true, // Some speakers don't have explicit power control
			},
		],
	},
	// Set-top box / Streaming device - Media source
	{
		deviceCategories: [DeviceCategory.SET_TOP_BOX, DeviceCategory.STREAMING_SERVICE],
		suggestedEndpoints: [MediaEndpointType.SOURCE, MediaEndpointType.REMOTE_TARGET],
		requiredCapabilities: [],
		optionalCapabilities: [
			MediaCapability.POWER,
			MediaCapability.PLAYBACK,
			MediaCapability.PLAYBACK_STATE,
			MediaCapability.REMOTE,
			MediaCapability.TRACK_METADATA,
		],
		channelCategories: [ChannelCategory.SWITCHER, ChannelCategory.MEDIA_PLAYBACK],
		fallbackRules: [],
	},
	// Game console - Gaming source
	{
		deviceCategories: [DeviceCategory.GAME_CONSOLE],
		suggestedEndpoints: [MediaEndpointType.SOURCE],
		requiredCapabilities: [],
		optionalCapabilities: [MediaCapability.POWER],
		channelCategories: [ChannelCategory.SWITCHER],
		fallbackRules: [
			{
				capability: MediaCapability.POWER,
				skipIfUnavailable: true, // Consoles often don't expose power via API
			},
		],
	},
	// Generic media device - Fallback
	{
		deviceCategories: [DeviceCategory.MEDIA],
		suggestedEndpoints: [MediaEndpointType.SOURCE, MediaEndpointType.AUDIO_OUTPUT],
		requiredCapabilities: [],
		optionalCapabilities: [
			MediaCapability.POWER,
			MediaCapability.VOLUME,
			MediaCapability.MUTE,
			MediaCapability.PLAYBACK,
			MediaCapability.PLAYBACK_STATE,
			MediaCapability.INPUT,
			MediaCapability.REMOTE,
		],
		channelCategories: [
			ChannelCategory.SWITCHER,
			ChannelCategory.SPEAKER,
			ChannelCategory.MEDIA_PLAYBACK,
			ChannelCategory.MEDIA_INPUT,
		],
		fallbackRules: [],
	},
];

/**
 * Get the extractor spec for a device category
 */
export function getMediaExtractorSpec(deviceCategory: DeviceCategory): MediaCapabilityExtractorSpec | null {
	return MEDIA_CAPABILITY_EXTRACTOR_SPECS.find((spec) => spec.deviceCategories.includes(deviceCategory)) ?? null;
}

/**
 * Media Intent Types V2 - routing-based intents
 */
export enum MediaIntentTypeV2 {
	/** Activate a specific routing */
	ROUTING_ACTIVATE = 'routing_activate',
	/** Deactivate current routing (same as activating OFF) */
	ROUTING_DEACTIVATE = 'routing_deactivate',
	/** Volume control (applies to active routing's audio endpoint) */
	VOLUME_SET = 'volume_set',
	VOLUME_DELTA = 'volume_delta',
	MUTE = 'mute',
	UNMUTE = 'unmute',
	/** Playback control (applies to active routing's source endpoint) */
	PLAY = 'play',
	PAUSE = 'pause',
	STOP = 'stop',
	NEXT = 'next',
	PREVIOUS = 'previous',
	/** Input control (applies to specific endpoint) */
	INPUT_SET = 'input_set',
}

/**
 * Complete intent category catalog
 */
export const INTENT_CATEGORY_CATALOG: IntentCategoryMeta[] = [
	{
		category: IntentCategory.LIGHTING,
		label: 'Lighting',
		description: 'Control lights in the space with modes and brightness adjustments',
		icon: 'mdi:lightbulb-group',
		intents: LIGHTING_INTENT_CATALOG,
	},
	{
		category: IntentCategory.CLIMATE,
		label: 'Climate',
		description: 'Control temperature and climate settings in the space',
		icon: 'mdi:thermostat',
		intents: CLIMATE_INTENT_CATALOG,
	},
	{
		category: IntentCategory.COVERS,
		label: 'Covers',
		description: 'Control window coverings (blinds, curtains, shutters) with modes and position adjustments',
		icon: 'mdi:blinds',
		intents: COVERS_INTENT_CATALOG,
	},
	// Note: Media domain uses routing-based architecture (MediaIntentTypeV2) instead of intent catalog
];

/**
 * Quick action metadata catalog
 */
export const QUICK_ACTION_CATALOG: QuickActionMeta[] = [
	{
		type: QuickActionType.LIGHTING_OFF,
		label: 'Lights Off',
		description: 'Turn off all lights',
		icon: 'mdi:lightbulb-off',
		category: IntentCategory.LIGHTING,
	},
	{
		type: QuickActionType.LIGHTING_WORK,
		label: 'Work Mode',
		description: 'Bright lighting for focus',
		icon: 'mdi:briefcase',
		category: IntentCategory.LIGHTING,
	},
	{
		type: QuickActionType.LIGHTING_RELAX,
		label: 'Relax Mode',
		description: 'Soft ambient lighting',
		icon: 'mdi:sofa',
		category: IntentCategory.LIGHTING,
	},
	{
		type: QuickActionType.LIGHTING_NIGHT,
		label: 'Night Mode',
		description: 'Minimal lighting',
		icon: 'mdi:weather-night',
		category: IntentCategory.LIGHTING,
	},
	{
		type: QuickActionType.BRIGHTNESS_UP,
		label: 'Brighter',
		description: 'Increase brightness',
		icon: 'mdi:brightness-5',
		category: IntentCategory.LIGHTING,
	},
	{
		type: QuickActionType.BRIGHTNESS_DOWN,
		label: 'Dimmer',
		description: 'Decrease brightness',
		icon: 'mdi:brightness-4',
		category: IntentCategory.LIGHTING,
	},
	{
		type: QuickActionType.CLIMATE_UP,
		label: 'Warmer',
		description: 'Increase temperature',
		icon: 'mdi:thermometer-plus',
		category: IntentCategory.CLIMATE,
	},
	{
		type: QuickActionType.CLIMATE_DOWN,
		label: 'Cooler',
		description: 'Decrease temperature',
		icon: 'mdi:thermometer-minus',
		category: IntentCategory.CLIMATE,
	},
];

// ========================
// Sensor Domain Constants
// ========================

/**
 * Sensor Roles - classify sensor devices/channels within a space for monitoring
 * Sensors are read-only devices that provide environmental and safety monitoring data.
 */
export enum SensorRole {
	ENVIRONMENT = 'environment', // Environmental sensors (temperature, humidity, pressure, illuminance)
	SAFETY = 'safety', // Safety sensors (smoke, gas, leak, carbon monoxide)
	SECURITY = 'security', // Security sensors (motion, occupancy, contact)
	AIR_QUALITY = 'air_quality', // Air quality sensors (AQI, CO2, VOC, particulates)
	ENERGY = 'energy', // Energy monitoring sensors (power, energy consumption)
	OTHER = 'other', // Unclassified sensors
	HIDDEN = 'hidden', // Hidden sensors (excluded from UI)
}

/**
 * Sensor channel categories relevant for the sensor domain.
 * These are the channel types that can be assigned roles in the sensor domain.
 */
export const SENSOR_CHANNEL_CATEGORIES = [
	// Environmental
	ChannelCategory.TEMPERATURE,
	ChannelCategory.HUMIDITY,
	ChannelCategory.PRESSURE,
	ChannelCategory.ILLUMINANCE,
	// Safety
	ChannelCategory.SMOKE,
	ChannelCategory.GAS,
	ChannelCategory.LEAK,
	ChannelCategory.CARBON_MONOXIDE,
	ChannelCategory.CARBON_DIOXIDE,
	// Security
	ChannelCategory.MOTION,
	ChannelCategory.OCCUPANCY,
	ChannelCategory.CONTACT,
	// Air quality
	ChannelCategory.AIR_QUALITY,
	ChannelCategory.AIR_PARTICULATE,
	ChannelCategory.NITROGEN_DIOXIDE,
	ChannelCategory.OZONE,
	ChannelCategory.SULPHUR_DIOXIDE,
	ChannelCategory.VOLATILE_ORGANIC_COMPOUNDS,
	// Energy
	ChannelCategory.ELECTRICAL_ENERGY,
	ChannelCategory.ELECTRICAL_POWER,
	// Device status
	ChannelCategory.BATTERY,
] as const;

/**
 * Environmental sensor channel categories
 */
export const SENSOR_ENVIRONMENT_CHANNEL_CATEGORIES = [
	ChannelCategory.TEMPERATURE,
	ChannelCategory.HUMIDITY,
	ChannelCategory.PRESSURE,
	ChannelCategory.ILLUMINANCE,
] as const;

/**
 * Safety sensor channel categories
 */
export const SENSOR_SAFETY_CHANNEL_CATEGORIES = [
	ChannelCategory.SMOKE,
	ChannelCategory.GAS,
	ChannelCategory.LEAK,
	ChannelCategory.CARBON_MONOXIDE,
] as const;

/**
 * Security sensor channel categories
 */
export const SENSOR_SECURITY_CHANNEL_CATEGORIES = [
	ChannelCategory.MOTION,
	ChannelCategory.OCCUPANCY,
	ChannelCategory.CONTACT,
] as const;

/**
 * Air quality sensor channel categories
 */
export const SENSOR_AIR_QUALITY_CHANNEL_CATEGORIES = [
	ChannelCategory.AIR_QUALITY,
	ChannelCategory.AIR_PARTICULATE,
	ChannelCategory.CARBON_DIOXIDE,
	ChannelCategory.NITROGEN_DIOXIDE,
	ChannelCategory.OZONE,
	ChannelCategory.SULPHUR_DIOXIDE,
	ChannelCategory.VOLATILE_ORGANIC_COMPOUNDS,
] as const;

/**
 * Energy sensor channel categories
 */
export const SENSOR_ENERGY_CHANNEL_CATEGORIES = [
	ChannelCategory.ELECTRICAL_ENERGY,
	ChannelCategory.ELECTRICAL_POWER,
] as const;

/**
 * Metadata for sensor role values
 */
export const SENSOR_ROLE_META: Record<SensorRole, IntentEnumValueMeta> = {
	[SensorRole.ENVIRONMENT]: {
		value: SensorRole.ENVIRONMENT,
		label: 'Environment',
		description: 'Environmental sensors (temperature, humidity, pressure, light)',
		icon: 'mdi:thermometer',
	},
	[SensorRole.SAFETY]: {
		value: SensorRole.SAFETY,
		label: 'Safety',
		description: 'Safety sensors (smoke, gas, leak, carbon monoxide)',
		icon: 'mdi:shield-alert',
	},
	[SensorRole.SECURITY]: {
		value: SensorRole.SECURITY,
		label: 'Security',
		description: 'Security sensors (motion, occupancy, contact)',
		icon: 'mdi:motion-sensor',
	},
	[SensorRole.AIR_QUALITY]: {
		value: SensorRole.AIR_QUALITY,
		label: 'Air Quality',
		description: 'Air quality sensors (AQI, CO2, VOC, particulates)',
		icon: 'mdi:air-filter',
	},
	[SensorRole.ENERGY]: {
		value: SensorRole.ENERGY,
		label: 'Energy',
		description: 'Energy monitoring sensors (power, consumption)',
		icon: 'mdi:lightning-bolt',
	},
	[SensorRole.OTHER]: {
		value: SensorRole.OTHER,
		label: 'Other',
		description: 'Unclassified sensors',
		icon: 'mdi:chart-line',
	},
	[SensorRole.HIDDEN]: {
		value: SensorRole.HIDDEN,
		label: 'Hidden',
		description: 'Hidden sensors (excluded from UI)',
		icon: 'mdi:eye-off',
	},
};

/**
 * Safety sensor threshold constants (in ppm - parts per million)
 * These thresholds determine when safety sensors trigger alerts
 */
export const SAFETY_SENSOR_THRESHOLDS = {
	/**
	 * Carbon Monoxide (CO) threshold in ppm
	 * OSHA limit: 50 ppm for 8-hour exposure
	 * Note: Lower thresholds may be used for shorter exposure times:
	 * - 9 ppm for 8-hour exposure (some jurisdictions)
	 * - 35 ppm for 1-hour exposure
	 */
	CARBON_MONOXIDE_PPM: 50,

	/**
	 * Generic gas detection threshold in ppm
	 * Any measurable level above this threshold indicates potential gas leak
	 * Using 0 as default (very conservative - any reading triggers alert)
	 * Consider increasing to 10-20 ppm to avoid false positives from sensor noise
	 */
	GAS_DETECTION_PPM: 0,

	/**
	 * Default threshold for other numeric safety sensors
	 * Any positive value above this threshold triggers an alert
	 */
	DEFAULT_NUMERIC_THRESHOLD: 0,
} as const;

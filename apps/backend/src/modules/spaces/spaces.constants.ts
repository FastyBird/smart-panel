import { ChannelCategory } from '../devices/devices.constants';

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
	OFF = 'off',
	ON = 'on',
	SET_MODE = 'set_mode',
	BRIGHTNESS_DELTA = 'brightness_delta',
}

export enum LightingMode {
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
}

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
export type IntentParamType = 'enum' | 'boolean' | 'number';

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
];

/**
 * Complete climate intent catalog
 */
export const CLIMATE_INTENT_CATALOG: IntentTypeMeta[] = [
	{
		type: ClimateIntentType.SETPOINT_DELTA,
		label: 'Adjust Temperature',
		description: 'Increase or decrease the target temperature',
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
		description: 'Set the target temperature to a specific value',
		icon: 'mdi:thermometer-check',
		params: [
			{
				name: 'value',
				type: 'number',
				required: true,
				description: 'The target temperature in degrees Celsius',
				minValue: ABSOLUTE_MIN_SETPOINT,
				maxValue: ABSOLUTE_MAX_SETPOINT,
			},
		],
	},
];

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

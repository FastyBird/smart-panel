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
}

export enum SpaceType {
	ROOM = 'room',
	ZONE = 'zone',
}

/**
 * Space categories representing common room/area types
 * Used to provide default icons and descriptions for spaces
 */
export enum SpaceCategory {
	LIVING_ROOM = 'living_room',
	BEDROOM = 'bedroom',
	BATHROOM = 'bathroom',
	KITCHEN = 'kitchen',
	DINING_ROOM = 'dining_room',
	OFFICE = 'office',
	GARAGE = 'garage',
	HALLWAY = 'hallway',
	LAUNDRY = 'laundry',
	STORAGE = 'storage',
	OUTDOOR = 'outdoor',
	BASEMENT = 'basement',
	ATTIC = 'attic',
	NURSERY = 'nursery',
	GUEST_ROOM = 'guest_room',
	GYM = 'gym',
	MEDIA_ROOM = 'media_room',
	WORKSHOP = 'workshop',
	OTHER = 'other',
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
 * Default templates for each space category
 * Provides suggested icons and descriptions that can be used when creating spaces
 */
export const SPACE_CATEGORY_TEMPLATES: Record<SpaceCategory, Omit<SpaceCategoryTemplate, 'category'>> = {
	[SpaceCategory.LIVING_ROOM]: {
		icon: 'mdi:sofa',
		description: 'Main living and entertainment area',
	},
	[SpaceCategory.BEDROOM]: {
		icon: 'mdi:bed',
		description: 'Sleeping and personal space',
	},
	[SpaceCategory.BATHROOM]: {
		icon: 'mdi:shower',
		description: 'Bathroom and hygiene area',
	},
	[SpaceCategory.KITCHEN]: {
		icon: 'mdi:stove',
		description: 'Food preparation and cooking area',
	},
	[SpaceCategory.DINING_ROOM]: {
		icon: 'mdi:silverware-fork-knife',
		description: 'Dining and eating area',
	},
	[SpaceCategory.OFFICE]: {
		icon: 'mdi:desk',
		description: 'Home office or work space',
	},
	[SpaceCategory.GARAGE]: {
		icon: 'mdi:garage',
		description: 'Vehicle storage and workshop area',
	},
	[SpaceCategory.HALLWAY]: {
		icon: 'mdi:door',
		description: 'Corridor and passage area',
	},
	[SpaceCategory.LAUNDRY]: {
		icon: 'mdi:washing-machine',
		description: 'Laundry and utility area',
	},
	[SpaceCategory.STORAGE]: {
		icon: 'mdi:archive',
		description: 'Storage and closet space',
	},
	[SpaceCategory.OUTDOOR]: {
		icon: 'mdi:flower',
		description: 'Outdoor garden, patio, or balcony',
	},
	[SpaceCategory.BASEMENT]: {
		icon: 'mdi:stairs-down',
		description: 'Basement or cellar area',
	},
	[SpaceCategory.ATTIC]: {
		icon: 'mdi:stairs-up',
		description: 'Attic or loft space',
	},
	[SpaceCategory.NURSERY]: {
		icon: 'mdi:baby-carriage',
		description: 'Baby or child room',
	},
	[SpaceCategory.GUEST_ROOM]: {
		icon: 'mdi:account-multiple',
		description: 'Guest bedroom or accommodation',
	},
	[SpaceCategory.GYM]: {
		icon: 'mdi:dumbbell',
		description: 'Home gym or exercise area',
	},
	[SpaceCategory.MEDIA_ROOM]: {
		icon: 'mdi:television',
		description: 'Home theater or media room',
	},
	[SpaceCategory.WORKSHOP]: {
		icon: 'mdi:hammer-wrench',
		description: 'DIY workshop or hobby area',
	},
	[SpaceCategory.OTHER]: {
		icon: 'mdi:home',
		description: 'Other or custom space',
	},
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
}

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

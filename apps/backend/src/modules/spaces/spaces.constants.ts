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

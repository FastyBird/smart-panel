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

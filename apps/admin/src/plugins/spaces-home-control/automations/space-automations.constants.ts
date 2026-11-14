/*
 * The automation cards of the plugin (ADR 0003, decision 13) and the values their configurations take. The
 * values mirror the node types of the backend (`plugins/spaces-home-control/automations`), which stays the
 * judge of what is saved.
 */

export const SpaceAutomationNodeType = {
	OCCUPANCY_CHANGED: 'space.occupancy.changed',
	OCCUPANCY_IS: 'space.occupancy.is',
	MODE_CHANGED: 'space.mode.changed',
	MODE_IS: 'space.mode.is',
	MODE_SET: 'space.mode.set',
	LIGHTING_INTENT: 'space.lighting.intent',
} as const;

export type SpaceAutomationNodeType = (typeof SpaceAutomationNodeType)[keyof typeof SpaceAutomationNodeType];

export const SPACE_AUTOMATION_NODE_TYPES: SpaceAutomationNodeType[] = Object.values(SpaceAutomationNodeType);

// Where the plugin keeps the words of its cards, under its own translations
export const SPACE_AUTOMATIONS_I18N_PREFIX = 'spacesHomeControlPlugin.automations';

export const SPACE_AUTOMATIONS_VALIDATION_PREFIX = `${SPACE_AUTOMATIONS_I18N_PREFIX}.validation.`;

// The occupancy a card watches or checks; "unknown" is no state either way
export const SPACE_OCCUPANCY_STATES = ['occupied', 'vacant'] as const;

export type SpaceOccupancyState = (typeof SPACE_OCCUPANCY_STATES)[number];

export const SPACE_ACTIVITY_MODES = ['work', 'relax', 'sleep', 'entertainment', 'away'] as const;

export type SpaceActivityMode = (typeof SPACE_ACTIVITY_MODES)[number];

// The lighting intents an automation can ask a space for
export const SPACE_LIGHTING_INTENTS = ['on', 'off', 'set_mode', 'role_on', 'role_off', 'role_brightness'] as const;

export type SpaceLightingIntent = (typeof SPACE_LIGHTING_INTENTS)[number];

export const SPACE_LIGHTING_MODES = ['off', 'work', 'relax', 'night'] as const;

// Hidden lights are never controlled by an intent, so they can not be a target
export const SPACE_LIGHTING_ROLES = ['main', 'task', 'ambient', 'accent', 'night', 'other'] as const;

export type SpaceLightingField = 'mode' | 'role' | 'brightness';

// Which of the optional fields an intent uses; the backend refuses a field another intent uses
export const SPACE_LIGHTING_FIELDS_OF_INTENT: Record<SpaceLightingIntent, readonly SpaceLightingField[]> = {
	on: [],
	off: [],
	set_mode: ['mode'],
	role_on: ['role'],
	role_off: ['role'],
	role_brightness: ['role', 'brightness'],
};

export const SPACE_LIGHTING_FIELDS: readonly SpaceLightingField[] = ['mode', 'role', 'brightness'];

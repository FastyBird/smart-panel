export const INTENTS_MODULE_NAME = 'intents-module';

export const INTENTS_MODULE_EVENT_PREFIX = 'IntentsModule.';

export enum EventType {
	INTENT_CREATED = 'IntentsModule.Intent.Created',
	INTENT_COMPLETED = 'IntentsModule.Intent.Completed',
	INTENT_EXPIRED = 'IntentsModule.Intent.Expired',
}

export enum IntentStatus {
	PENDING = 'pending',
	COMPLETED_SUCCESS = 'completed_success',
	COMPLETED_PARTIAL = 'completed_partial',
	COMPLETED_FAILED = 'completed_failed',
	EXPIRED = 'expired',
}

export enum IntentTargetStatus {
	SUCCESS = 'success',
	FAILED = 'failed',
	TIMEOUT = 'timeout',
	SKIPPED = 'skipped',
}

export enum IntentType {
	// Device operations
	LIGHT_TOGGLE = 'light.toggle',
	LIGHT_SET_BRIGHTNESS = 'light.setBrightness',
	LIGHT_SET_COLOR = 'light.setColor',
	LIGHT_SET_COLOR_TEMP = 'light.setColorTemp',
	LIGHT_SET_WHITE = 'light.setWhite',
	DEVICE_SET_PROPERTY = 'device.setProperty',

	// Scene operations
	SCENE_RUN = 'scene.run',
}

/**
 * Intent origin - indicates where the intent was initiated from
 * These match the detailed origin strings from the backend
 */
export type IntentOrigin =
	| 'panel.system.room'
	| 'panel.system.master'
	| 'panel.system.entry'
	| 'panel.dashboard.tiles'
	| 'panel.dashboard.cards'
	| 'panel.device'
	| 'panel.scenes'
	| 'admin'
	| 'api';

/**
 * All valid intent origin values for validation
 */
export const INTENT_ORIGINS: IntentOrigin[] = [
	'panel.system.room',
	'panel.system.master',
	'panel.system.entry',
	'panel.dashboard.tiles',
	'panel.dashboard.cards',
	'panel.device',
	'panel.scenes',
	'admin',
	'api',
];

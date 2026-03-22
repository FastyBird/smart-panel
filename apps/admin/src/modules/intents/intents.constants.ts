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

	// Space lighting operations
	SPACE_LIGHTING_ON = 'space.lighting.on',
	SPACE_LIGHTING_OFF = 'space.lighting.off',
	SPACE_LIGHTING_SET_MODE = 'space.lighting.setMode',
	SPACE_LIGHTING_BRIGHTNESS_DELTA = 'space.lighting.brightnessDelta',
	SPACE_LIGHTING_ROLE_ON = 'space.lighting.roleOn',
	SPACE_LIGHTING_ROLE_OFF = 'space.lighting.roleOff',
	SPACE_LIGHTING_ROLE_BRIGHTNESS = 'space.lighting.roleBrightness',
	SPACE_LIGHTING_ROLE_COLOR = 'space.lighting.roleColor',
	SPACE_LIGHTING_ROLE_COLOR_TEMP = 'space.lighting.roleColorTemp',
	SPACE_LIGHTING_ROLE_WHITE = 'space.lighting.roleWhite',
	SPACE_LIGHTING_ROLE_SET = 'space.lighting.roleSet',

	// Space climate operations
	SPACE_CLIMATE_SET_MODE = 'space.climate.setMode',
	SPACE_CLIMATE_SETPOINT_SET = 'space.climate.setpointSet',
	SPACE_CLIMATE_SETPOINT_DELTA = 'space.climate.setpointDelta',
	SPACE_CLIMATE_SET = 'space.climate.set',

	// Space covers operations
	SPACE_COVERS_OPEN = 'space.covers.open',
	SPACE_COVERS_CLOSE = 'space.covers.close',
	SPACE_COVERS_STOP = 'space.covers.stop',
	SPACE_COVERS_SET_POSITION = 'space.covers.setPosition',
	SPACE_COVERS_POSITION_DELTA = 'space.covers.positionDelta',
	SPACE_COVERS_ROLE_POSITION = 'space.covers.rolePosition',
	SPACE_COVERS_SET_MODE = 'space.covers.setMode',

	// Space media operations
	SPACE_MEDIA_ACTIVATE = 'space.media.activate',
	SPACE_MEDIA_DEACTIVATE = 'space.media.deactivate',
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
	| 'panel.spaces'
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
	'panel.spaces',
	'admin',
	'api',
];

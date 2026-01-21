export const INTENTS_MODULE_NAME = 'intents-module';

export const INTENTS_MODULE_API_TAG_NAME = 'Intents module';

export const INTENTS_MODULE_API_TAG_DESCRIPTION =
	'Intent orchestration for coordinating UI updates across multiple clients, preventing anti-jitter issues and enabling optimistic updates.';

/**
 * Socket.IO event types for intent lifecycle
 */
export enum IntentEventType {
	CREATED = 'IntentsModule.Intent.Created',
	COMPLETED = 'IntentsModule.Intent.Completed',
	EXPIRED = 'IntentsModule.Intent.Expired',
}

/**
 * Intent status values
 */
export enum IntentStatus {
	PENDING = 'pending',
	COMPLETED_SUCCESS = 'completed_success',
	COMPLETED_PARTIAL = 'completed_partial',
	COMPLETED_FAILED = 'completed_failed',
	EXPIRED = 'expired',
}

/**
 * Per-target result status
 */
export enum IntentTargetStatus {
	SUCCESS = 'success',
	FAILED = 'failed',
	TIMEOUT = 'timeout',
	SKIPPED = 'skipped',
}

/**
 * Intent types for different operations
 */
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
	SPACE_COVERS_SET_POSITION = 'space.covers.setPosition',
	SPACE_COVERS_POSITION_DELTA = 'space.covers.positionDelta',
	SPACE_COVERS_ROLE_POSITION = 'space.covers.rolePosition',
	SPACE_COVERS_SET_MODE = 'space.covers.setMode',

	// Space media operations
	SPACE_MEDIA_POWER_ON = 'space.media.powerOn',
	SPACE_MEDIA_POWER_OFF = 'space.media.powerOff',
	SPACE_MEDIA_VOLUME_SET = 'space.media.volumeSet',
	SPACE_MEDIA_VOLUME_DELTA = 'space.media.volumeDelta',
	SPACE_MEDIA_MUTE = 'space.media.mute',
	SPACE_MEDIA_UNMUTE = 'space.media.unmute',
	SPACE_MEDIA_ROLE_POWER = 'space.media.rolePower',
	SPACE_MEDIA_ROLE_VOLUME = 'space.media.roleVolume',
	SPACE_MEDIA_SET_MODE = 'space.media.setMode',
	SPACE_MEDIA_PLAY = 'space.media.play',
	SPACE_MEDIA_PAUSE = 'space.media.pause',
	SPACE_MEDIA_STOP = 'space.media.stop',
	SPACE_MEDIA_NEXT = 'space.media.next',
	SPACE_MEDIA_PREVIOUS = 'space.media.previous',
	SPACE_MEDIA_INPUT_SET = 'space.media.inputSet',
}

/**
 * Default TTL values in milliseconds
 */
export const DEFAULT_TTL_DEVICE_COMMAND = 3000; // 3 seconds for device commands
export const DEFAULT_TTL_SCENE = 5000; // 5 seconds for scene execution
export const DEFAULT_TTL_SPACE_COMMAND = 5000; // 5 seconds for space commands (multi-device)

/**
 * Cleanup interval for expired intents
 */
export const INTENT_CLEANUP_INTERVAL = 500; // Check every 500ms

/**
 * Intent origin - indicates where the intent was initiated from
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

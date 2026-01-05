export const INTENTS_MODULE_PREFIX = 'intents';

export const INTENTS_MODULE_NAME = 'intents-module';

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
}

/**
 * Default TTL values in milliseconds
 */
export const DEFAULT_TTL_DEVICE_COMMAND = 3000; // 3 seconds for device commands
export const DEFAULT_TTL_SCENE = 5000; // 5 seconds for scene execution

/**
 * Cleanup interval for expired intents
 */
export const INTENT_CLEANUP_INTERVAL = 500; // Check every 500ms

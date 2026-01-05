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
	DEVICE_SET_PROPERTY = 'device.setProperty',
	SCENE_RUN = 'scene.run',
}

export enum IntentOrigin {
	PANEL = 'panel',
	ADMIN = 'admin',
	API = 'api',
	SYSTEM = 'system',
}

export const SCENES_MODULE_PREFIX = 'scenes-module';

export const SCENES_MODULE_NAME = 'scenes-module';

export const SCENES_MODULE_API_TAG_NAME = 'Scenes module';

export const SCENES_MODULE_API_TAG_DESCRIPTION =
	'A collection of endpoints for managing automation scenes that control device states and actions.';

export enum EventType {
	SCENE_CREATED = 'ScenesModule.Scene.Created',
	SCENE_UPDATED = 'ScenesModule.Scene.Updated',
	SCENE_DELETED = 'ScenesModule.Scene.Deleted',
	SCENE_TRIGGERED = 'ScenesModule.Scene.Triggered',
	SCENE_EXECUTION_STARTED = 'ScenesModule.Scene.ExecutionStarted',
	SCENE_EXECUTION_COMPLETED = 'ScenesModule.Scene.ExecutionCompleted',
	SCENE_EXECUTION_FAILED = 'ScenesModule.Scene.ExecutionFailed',
	SCENE_ACTION_CREATED = 'ScenesModule.SceneAction.Created',
	SCENE_ACTION_UPDATED = 'ScenesModule.SceneAction.Updated',
	SCENE_ACTION_DELETED = 'ScenesModule.SceneAction.Deleted',
	SCENE_CONDITION_CREATED = 'ScenesModule.SceneCondition.Created',
	SCENE_CONDITION_UPDATED = 'ScenesModule.SceneCondition.Updated',
	SCENE_CONDITION_DELETED = 'ScenesModule.SceneCondition.Deleted',
	SCENE_TRIGGER_CREATED = 'ScenesModule.SceneTrigger.Created',
	SCENE_TRIGGER_UPDATED = 'ScenesModule.SceneTrigger.Updated',
	SCENE_TRIGGER_DELETED = 'ScenesModule.SceneTrigger.Deleted',
	MODULE_RESET = 'ScenesModule.All.Reset',
}

export enum SceneCategory {
	GENERIC = 'generic',
	LIGHTING = 'lighting',
	CLIMATE = 'climate',
	SECURITY = 'security',
	ENTERTAINMENT = 'entertainment',
	MORNING = 'morning',
	EVENING = 'evening',
	AWAY = 'away',
	HOME = 'home',
	SLEEP = 'sleep',
	CUSTOM = 'custom',
}

export enum ConditionOperator {
	AND = 'and',
	OR = 'or',
}

export enum TriggerType {
	MANUAL = 'manual',
	SCHEDULE = 'schedule',
	DEVICE_STATE = 'device_state',
	WEBHOOK = 'webhook',
	SUNRISE = 'sunrise',
	SUNSET = 'sunset',
}

export enum SceneExecutionStatus {
	PENDING = 'pending',
	RUNNING = 'running',
	COMPLETED = 'completed',
	FAILED = 'failed',
	PARTIALLY_COMPLETED = 'partially_completed',
}

// Configuration defaults
export const DEFAULT_EXECUTION_TIMEOUT_MS = 30000; // 30 seconds
export const DEFAULT_MAX_CONCURRENT_EXECUTIONS = 10;

export const SCENES_MODULE_PREFIX = 'scenes';

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
	MODULE_RESET = 'ScenesModule.All.Reset',
}

export enum SceneCategory {
	GENERIC = 'generic',
	LIGHTING = 'lighting',
	CLIMATE = 'climate',
	MEDIA = 'media',
	WORK = 'work',
	RELAX = 'relax',
	NIGHT = 'night',
	MORNING = 'morning',
	PARTY = 'party',
	MOVIE = 'movie',
	AWAY = 'away',
	HOME = 'home',
	SECURITY = 'security',
	ENERGY = 'energy',
	CUSTOM = 'custom',
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

export const SCENES_MODULE_PREFIX = 'scenes-module';

export const SCENES_MODULE_NAME = 'scenes-module';

export const SCENES_MODULE_EVENT_PREFIX = 'ScenesModule.';

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

export enum FormResult {
	NONE = 'none',
	WORKING = 'working',
	ERROR = 'error',
	OK = 'ok',
}

export type FormResultType = FormResult.NONE | FormResult.WORKING | FormResult.ERROR | FormResult.OK;

export const RouteNames = {
	SCENES: 'scenes_module-scenes',
	SCENES_ADD: 'scenes_module-scenes_add',
	SCENES_EDIT: 'scenes_module-scenes_edit',
	SCENE: 'scenes_module-scene',
	SCENE_EDIT: 'scenes_module-scene_edit',
	SCENE_ADD_ACTION: 'scenes_module-scene_add_action',
	SCENE_EDIT_ACTION: 'scenes_module-scene_edit_action',
};

export type StateColor = 'info' | 'warning' | 'success' | 'primary' | 'danger' | undefined;

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 10;

export const SCENE_CATEGORY_ICONS: Record<SceneCategory, string> = {
	[SceneCategory.GENERIC]: 'mdi:play-circle',
	[SceneCategory.LIGHTING]: 'mdi:lightbulb',
	[SceneCategory.CLIMATE]: 'mdi:thermometer',
	[SceneCategory.SECURITY]: 'mdi:shield-home',
	[SceneCategory.ENTERTAINMENT]: 'mdi:television',
	[SceneCategory.MORNING]: 'mdi:weather-sunny',
	[SceneCategory.EVENING]: 'mdi:weather-night',
	[SceneCategory.AWAY]: 'mdi:exit-run',
	[SceneCategory.HOME]: 'mdi:home',
	[SceneCategory.SLEEP]: 'mdi:sleep',
	[SceneCategory.CUSTOM]: 'mdi:cog',
};

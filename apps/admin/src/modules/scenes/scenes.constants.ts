export const SCENES_MODULE_PREFIX = 'scenes';

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
	[SceneCategory.GENERIC]: 'mdi:playlist-play',
	[SceneCategory.LIGHTING]: 'mdi:lightbulb-group',
	[SceneCategory.CLIMATE]: 'mdi:thermostat',
	[SceneCategory.MEDIA]: 'mdi:television-play',
	[SceneCategory.WORK]: 'mdi:briefcase',
	[SceneCategory.RELAX]: 'mdi:sofa',
	[SceneCategory.NIGHT]: 'mdi:weather-night',
	[SceneCategory.MORNING]: 'mdi:weather-sunset-up',
	[SceneCategory.PARTY]: 'mdi:party-popper',
	[SceneCategory.MOVIE]: 'mdi:movie-open',
	[SceneCategory.AWAY]: 'mdi:home-export-outline',
	[SceneCategory.HOME]: 'mdi:home-import-outline',
	[SceneCategory.SECURITY]: 'mdi:shield-home',
	[SceneCategory.ENERGY]: 'mdi:flash',
	[SceneCategory.CUSTOM]: 'mdi:shape-outline',
};

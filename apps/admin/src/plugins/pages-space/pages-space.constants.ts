export const PAGES_SPACE_PLUGIN_NAME = 'pages-space-plugin';

export const PAGES_SPACE_TYPE = 'pages-space';

export enum QuickActionType {
	LIGHTING_OFF = 'lighting_off',
	LIGHTING_WORK = 'lighting_work',
	LIGHTING_RELAX = 'lighting_relax',
	LIGHTING_NIGHT = 'lighting_night',
	BRIGHTNESS_UP = 'brightness_up',
	BRIGHTNESS_DOWN = 'brightness_down',
	CLIMATE_UP = 'climate_up',
	CLIMATE_DOWN = 'climate_down',
}

export const ALL_QUICK_ACTION_TYPES = Object.values(QuickActionType);

export const DEFAULT_QUICK_ACTIONS: QuickActionType[] = [
	QuickActionType.LIGHTING_OFF,
	QuickActionType.LIGHTING_WORK,
	QuickActionType.LIGHTING_RELAX,
	QuickActionType.LIGHTING_NIGHT,
];

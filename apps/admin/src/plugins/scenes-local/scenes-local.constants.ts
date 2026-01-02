import { DevicesModuleDeviceCategory } from '../../openapi.constants';
import { SceneCategory } from '../../modules/scenes';

export const SCENES_LOCAL_PLUGIN_NAME = 'scenes-local-plugin';

export const SCENES_LOCAL_TYPE = 'scenes-local';

/**
 * Device category recommendations based on scene category.
 * null means all device categories are recommended (no filtering).
 */
export const SCENE_CATEGORY_DEVICE_RECOMMENDATIONS: Record<SceneCategory, DevicesModuleDeviceCategory[] | null> = {
	[SceneCategory.GENERIC]: null,
	[SceneCategory.LIGHTING]: [
		DevicesModuleDeviceCategory.lighting,
		DevicesModuleDeviceCategory.switcher,
		DevicesModuleDeviceCategory.outlet,
	],
	[SceneCategory.CLIMATE]: [
		DevicesModuleDeviceCategory.thermostat,
		DevicesModuleDeviceCategory.heater,
		DevicesModuleDeviceCategory.air_conditioner,
		DevicesModuleDeviceCategory.air_dehumidifier,
		DevicesModuleDeviceCategory.air_humidifier,
		DevicesModuleDeviceCategory.air_purifier,
		DevicesModuleDeviceCategory.fan,
	],
	[SceneCategory.MEDIA]: [
		DevicesModuleDeviceCategory.television,
		DevicesModuleDeviceCategory.media,
		DevicesModuleDeviceCategory.speaker,
	],
	[SceneCategory.WORK]: [
		DevicesModuleDeviceCategory.lighting,
		DevicesModuleDeviceCategory.outlet,
	],
	[SceneCategory.RELAX]: [
		DevicesModuleDeviceCategory.lighting,
		DevicesModuleDeviceCategory.media,
	],
	[SceneCategory.NIGHT]: [
		DevicesModuleDeviceCategory.lighting,
		DevicesModuleDeviceCategory.window_covering,
	],
	[SceneCategory.MORNING]: [
		DevicesModuleDeviceCategory.lighting,
		DevicesModuleDeviceCategory.window_covering,
	],
	[SceneCategory.PARTY]: [
		DevicesModuleDeviceCategory.lighting,
		DevicesModuleDeviceCategory.speaker,
		DevicesModuleDeviceCategory.media,
	],
	[SceneCategory.MOVIE]: [
		DevicesModuleDeviceCategory.television,
		DevicesModuleDeviceCategory.lighting,
		DevicesModuleDeviceCategory.speaker,
	],
	[SceneCategory.AWAY]: [
		DevicesModuleDeviceCategory.alarm,
		DevicesModuleDeviceCategory.lock,
		DevicesModuleDeviceCategory.camera,
	],
	[SceneCategory.HOME]: null,
	[SceneCategory.SECURITY]: [
		DevicesModuleDeviceCategory.camera,
		DevicesModuleDeviceCategory.alarm,
		DevicesModuleDeviceCategory.lock,
		DevicesModuleDeviceCategory.door,
	],
	[SceneCategory.ENERGY]: [
		DevicesModuleDeviceCategory.outlet,
		DevicesModuleDeviceCategory.switcher,
		DevicesModuleDeviceCategory.sensor,
	],
	[SceneCategory.CUSTOM]: null,
};

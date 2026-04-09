import { DevicesModuleDeviceCategory } from '../../openapi.constants';
import { SceneCategory } from '../../modules/scenes';

export const SCENES_LOCAL_PLUGIN_NAME = 'scenes-local-plugin';

export const SCENES_LOCAL_TYPE = 'scenes-local';

/**
 * Device category recommendations based on scene category.
 * null means all device categories are recommended (no filtering).
 */
export const SCENE_CATEGORY_DEVICE_RECOMMENDATIONS: Record<SceneCategory, DevicesModuleDeviceCategory[] | null> = {
	[SceneCategory.generic]: null,
	[SceneCategory.lighting]: [
		DevicesModuleDeviceCategory.lighting,
		DevicesModuleDeviceCategory.switcher,
		DevicesModuleDeviceCategory.outlet,
	],
	[SceneCategory.climate]: [
		DevicesModuleDeviceCategory.thermostat,
		DevicesModuleDeviceCategory.heating_unit,
		DevicesModuleDeviceCategory.air_conditioner,
		DevicesModuleDeviceCategory.air_dehumidifier,
		DevicesModuleDeviceCategory.air_humidifier,
		DevicesModuleDeviceCategory.air_purifier,
		DevicesModuleDeviceCategory.fan,
	],
	[SceneCategory.media]: [
		DevicesModuleDeviceCategory.television,
		DevicesModuleDeviceCategory.media,
		DevicesModuleDeviceCategory.speaker,
	],
	[SceneCategory.work]: [
		DevicesModuleDeviceCategory.lighting,
		DevicesModuleDeviceCategory.outlet,
	],
	[SceneCategory.relax]: [
		DevicesModuleDeviceCategory.lighting,
		DevicesModuleDeviceCategory.media,
	],
	[SceneCategory.night]: [
		DevicesModuleDeviceCategory.lighting,
		DevicesModuleDeviceCategory.window_covering,
	],
	[SceneCategory.morning]: [
		DevicesModuleDeviceCategory.lighting,
		DevicesModuleDeviceCategory.window_covering,
	],
	[SceneCategory.party]: [
		DevicesModuleDeviceCategory.lighting,
		DevicesModuleDeviceCategory.speaker,
		DevicesModuleDeviceCategory.media,
	],
	[SceneCategory.movie]: [
		DevicesModuleDeviceCategory.television,
		DevicesModuleDeviceCategory.lighting,
		DevicesModuleDeviceCategory.speaker,
	],
	[SceneCategory.away]: [
		DevicesModuleDeviceCategory.alarm,
		DevicesModuleDeviceCategory.lock,
		DevicesModuleDeviceCategory.camera,
	],
	[SceneCategory.home]: null,
	[SceneCategory.security]: [
		DevicesModuleDeviceCategory.camera,
		DevicesModuleDeviceCategory.alarm,
		DevicesModuleDeviceCategory.lock,
		DevicesModuleDeviceCategory.door,
	],
	[SceneCategory.energy]: [
		DevicesModuleDeviceCategory.outlet,
		DevicesModuleDeviceCategory.switcher,
		DevicesModuleDeviceCategory.sensor,
	],
	[SceneCategory.custom]: null,
};

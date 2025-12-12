export const WEATHER_MODULE_PREFIX = 'weather';

export const WEATHER_MODULE_NAME = 'weather-module';

export const WEATHER_MODULE_EVENT_PREFIX = 'WeatherModule.';

export enum EventType {
	WEATHER_INFO = 'WeatherModule.Weather.Info',
}

export enum RouteNames {
	WEATHER = 'weather_module-module',
	WEATHER_LOCATIONS = 'weather_module-locations',
	WEATHER_LOCATION_ADD = 'weather_module-location-add',
	WEATHER_LOCATION_EDIT = 'weather_module-location-edit',
}

export const FormResult = {
	NONE: 'none',
	WORKING: 'working',
	OK: 'ok',
	ERROR: 'error',
} as const;

export type FormResultType = (typeof FormResult)[keyof typeof FormResult];

export const WEATHER_MODULE_PREFIX = 'weather';

export const WEATHER_MODULE_NAME = 'weather-module';

export const WEATHER_MODULE_EVENT_PREFIX = 'WeatherModule.';

export enum EventType {
	WEATHER_INFO = 'WeatherModule.Weather.Info',
}

export const FormResult = {
	NONE: 'none',
	WORKING: 'working',
	OK: 'ok',
	ERROR: 'error',
} as const;

export type FormResultType = (typeof FormResult)[keyof typeof FormResult];

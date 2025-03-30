export const CONFIG_MODULE_PREFIX = 'config-module';

export const CONFIG_MODULE_NAME = 'config-module';

export enum EventType {
	CONFIG_UPDATED = 'ConfigModule.Configuration.Changed',
}

export const RouteNames = {
	CONFIG: 'config_module-module',
	CONFIG_AUDIO: 'config_module-config_audio',
	CONFIG_DISPLAY: 'config_module-config_display',
	CONFIG_LANGUAGE: 'config_module-config_language',
	CONFIG_WEATHER: 'config_module-config_weather',
};

export enum FormResult {
	NONE = 'none',
	WORKING = 'working',
	ERROR = 'error',
	OK = 'ok',
}

export type FormResultType = FormResult.NONE | FormResult.WORKING | FormResult.ERROR | FormResult.OK;

export enum Layout {
	DEFAULT = 'default',
	PHONE = 'phone',
}

export type LayoutType = Layout.DEFAULT | Layout.PHONE;

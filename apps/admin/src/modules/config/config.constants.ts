export const CONFIG_MODULE_PREFIX = 'config-module';

export const CONFIG_MODULE_NAME = 'config-module';

export const CONFIG_MODULE_PLUGIN_TYPE = 'config';

export const CONFIG_MODULE_MODULE_TYPE = 'module';

export const CONFIG_MODULE_EVENT_PREFIX = 'ConfigModule.';

export enum EventType {
	CONFIG_UPDATED = 'ConfigModule.Configuration.Changed',
}

export const RouteNames = {
	CONFIG: 'config_module-module',
	CONFIG_LANGUAGE: 'config_module-config_language',
	CONFIG_WEATHER: 'config_module-config_weather',
	CONFIG_SYSTEM: 'config_module-config_system',
	CONFIG_PLUGINS: 'config_module-config_plugins',
	CONFIG_MODULES: 'config_module-config_modules',
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

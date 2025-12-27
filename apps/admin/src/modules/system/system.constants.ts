export const SYSTEM_MODULE_PREFIX = 'system';

export const SYSTEM_MODULE_NAME = 'system-module';

export const SYSTEM_MODULE_EVENT_PREFIX = 'SystemModule.';

export enum EventType {
	SYSTEM_INFO = 'SystemModule.System.Info',
	SYSTEM_REBOOT = 'SystemModule.System.Reboot',
	SYSTEM_POWER_OFF = 'SystemModule.System.PowerOff',
	SYSTEM_FACTORY_RESET = 'SystemModule.System.FactoryReset',

	SYSTEM_REBOOT_SET = 'SystemModule.System.Reboot.Set',
	SYSTEM_POWER_OFF_SET = 'SystemModule.System.PowerOff.Set',
	SYSTEM_FACTORY_RESET_SET = 'SystemModule.System.FactoryReset.Set',
}

export enum EventHandlerName {
	INTERNAL_PLATFORM_ACTION = 'SystemModule.Internal.PlatformAction',
}

export enum HouseMode {
	HOME = 'home',
	AWAY = 'away',
	NIGHT = 'night',
}

export type HouseModeType = HouseMode.HOME | HouseMode.AWAY | HouseMode.NIGHT;

export enum FormResult {
	NONE = 'none',
	WORKING = 'working',
	ERROR = 'error',
	OK = 'ok',
}

export type FormResultType = FormResult.NONE | FormResult.WORKING | FormResult.ERROR | FormResult.OK;

export const RouteNames = {
	SYSTEM: 'system_module-module',
	MAINTENANCE: 'system_module-module_maintenance',
	SYSTEM_INFO: 'system_module-system_info',
	SYSTEM_LOGS: 'system_module-system_logs',
	SYSTEM_LOG_DETAIL: 'system_module-system_log_detail',
	THROTTLE_STATUS: 'system_module-throttle_status',
	POWER_OFF: 'system_module-power_off',
};

export enum Layout {
	DEFAULT = 'default',
	PHONE = 'phone',
}

export type LayoutType = Layout.DEFAULT | Layout.PHONE;

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 10;

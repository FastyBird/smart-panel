export const SYSTEM_MODULE_PREFIX = 'system';

export const SYSTEM_MODULE_NAME = 'system-module';

export const SYSTEM_MODULE_EVENT_PREFIX = 'SystemModule.';

export enum EventType {
	SYSTEM_INFO = 'SystemModule.System.Info',
	SYSTEM_REBOOT = 'SystemModule.System.Reboot',
	SYSTEM_POWER_OFF = 'SystemModule.System.PowerOff',
	SYSTEM_FACTORY_RESET = 'SystemModule.System.FactoryReset',

	SYSTEM_SERVICE_RESTART = 'SystemModule.System.ServiceRestart',

	SYSTEM_REBOOT_SET = 'SystemModule.System.Reboot.Set',
	SYSTEM_POWER_OFF_SET = 'SystemModule.System.PowerOff.Set',
	SYSTEM_FACTORY_RESET_SET = 'SystemModule.System.FactoryReset.Set',
	SYSTEM_SERVICE_RESTART_SET = 'SystemModule.System.ServiceRestart.Set',

	SYSTEM_UPDATE_STATUS = 'SystemModule.System.Update.Status',
	SYSTEM_UPDATE_PROGRESS = 'SystemModule.System.Update.Progress',
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
	SYSTEM_BACKUPS: 'system_module-system_backups',
	THROTTLE_STATUS: 'system_module-throttle_status',
	POWER_OFF: 'system_module-power_off',
	FACTORY_RESET: 'system_module-factory_reset',
	REBOOTING: 'system_module-rebooting',
	SERVICE_RESTARTING: 'system_module-service_restarting',
};

export enum Layout {
	DEFAULT = 'default',
	PHONE = 'phone',
}

export type LayoutType = Layout.DEFAULT | Layout.PHONE;

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 10;

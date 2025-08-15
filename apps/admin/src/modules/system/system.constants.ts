export const SYSTEM_MODULE_PREFIX = 'system-module';

export const SYSTEM_MODULE_NAME = 'system-module';

export const SYSTEM_MODULE_EVENT_PREFIX = 'SystemModule.';

export enum EventType {
	SYSTEM_INFO = 'SystemModule.System.Info',
	SYSTEM_REBOOT = 'SystemModule.System.Reboot',
	SYSTEM_POWER_OFF = 'SystemModule.System.PowerOff',
	SYSTEM_FACTORY_RESET = 'SystemModule.System.FactoryReset',
	DISPLAY_PROFILE_CREATED = 'SystemModule.DisplayProfile.Created',
	DISPLAY_PROFILE_UPDATED = 'SystemModule.DisplayProfile.Updated',
	DISPLAY_PROFILE_DELETED = 'SystemModule.DisplayProfile.Deleted',
	DISPLAY_PROFILE_RESET = 'SystemModule.DisplayProfile.Reset',

	SYSTEM_REBOOT_SET = 'SystemModule.System.Reboot.Set',
	SYSTEM_POWER_OFF_SET = 'SystemModule.System.PowerOff.Set',
	SYSTEM_FACTORY_RESET_SET = 'SystemModule.System.FactoryReset.Set',
}

export enum EventHandlerName {
	INTERNAL_PLATFORM_ACTION = 'SystemModule.Internal.PlatformAction',
}

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
	DISPLAY_EDIT: 'system_module-display_edit',
	THROTTLE_STATUS: 'system_module-throttle_status',
	POWER_OFF: 'system_module-power_off',
};

export enum Layout {
	DEFAULT = 'default',
	PHONE = 'phone',
}

export type LayoutType = Layout.DEFAULT | Layout.PHONE;

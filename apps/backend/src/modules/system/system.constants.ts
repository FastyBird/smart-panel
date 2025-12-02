export const SYSTEM_MODULE_PREFIX = 'system-module';

export const SYSTEM_MODULE_NAME = 'system-module';

export const SYSTEM_MODULE_API_TAG_NAME = 'System module';

export const SYSTEM_MODULE_API_TAG_DESCRIPTION =
	'Provides endpoints to retrieve system-related information, including CPU load, memory usage, and system health status.';

export enum EventHandlerName {
	INTERNAL_PLATFORM_ACTION = 'SystemModule.Internal.PlatformAction',
}

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

export enum LogEntryType {
	SILENT = 'silent',
	VERBOSE = 'verbose',
	DEBUG = 'debug',
	TRACE = 'trace',
	LOG = 'log',
	INFO = 'info',
	SUCCESS = 'success',
	WARN = 'warn',
	ERROR = 'error',
	FAIL = 'fail',
	FATAL = 'fatal',
}

export enum LogEntrySource {
	ADMIN = 'admin',
	DISPLAY = 'display',
	BACKEND = 'backend',
	OTHER = 'other',
}

export enum ExtensionSurfaceType {
	ADMIN = 'admin',
	BACKEND = 'backend',
}

export enum ExtensionKindType {
	PLUGIN = 'plugin',
	MODULE = 'module',
}

export enum ExtensionSourceType {
	BUNDLED = 'bundled',
	RUNTIME = 'runtime',
}

export const DEFAULT_PAGE_SIZE = 10;

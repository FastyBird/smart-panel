export const SYSTEM_MODULE_PREFIX = 'system';

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

export enum TemperatureUnitType {
	CELSIUS = 'celsius',
	FAHRENHEIT = 'fahrenheit',
}

export enum TimeFormatType {
	HOUR_12 = '12h',
	HOUR_24 = '24h',
}

export enum LanguageType {
	ENGLISH = 'en_US',
	CZECH = 'cs_CZ',
}

export enum LogLevelType {
	SILENT = LogEntryType.SILENT,
	VERBOSE = LogEntryType.VERBOSE,
	DEBUG = LogEntryType.DEBUG,
	TRACE = LogEntryType.TRACE,
	LOG = LogEntryType.LOG,
	INFO = LogEntryType.INFO,
	SUCCESS = LogEntryType.SUCCESS,
	WARN = LogEntryType.WARN,
	ERROR = LogEntryType.ERROR,
	FAIL = LogEntryType.FAIL,
	FATAL = LogEntryType.FATAL,
}

export enum LogEntrySource {
	ADMIN = 'admin',
	DISPLAY = 'display',
	BACKEND = 'backend',
	OTHER = 'other',
}

export const DEFAULT_PAGE_SIZE = 10;

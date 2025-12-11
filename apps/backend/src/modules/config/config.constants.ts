import { LogEntryType } from '../system/system.constants';

export const CONFIG_MODULE_PREFIX = 'config-module';

export const CONFIG_MODULE_NAME = 'config-module';

export const CONFIG_MODULE_API_TAG_NAME = 'Configuration module';

export const CONFIG_MODULE_API_TAG_DESCRIPTION =
	'Endpoints related to configuring system settings, global parameters, and module-specific configurations.';

export enum EventType {
	CONFIG_UPDATED = 'ConfigModule.Configuration.Changed',
	CONFIG_RESET = 'ConfigModule.Configuration.Reset',
}

export enum SectionType {
	LANGUAGE = 'language',
	WEATHER = 'weather',
	SYSTEM = 'system',
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

export enum WeatherLocationType {
	LAT_LON = 'lat_lon',
	CITY_NAME = 'city_name',
	CITY_ID = 'city_id',
	ZIP_CODE = 'zip_code',
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

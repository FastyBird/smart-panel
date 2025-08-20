export const CONFIG_MODULE_PREFIX = 'config-module';

export const CONFIG_MODULE_NAME = 'config-module';

export enum EventType {
	CONFIG_UPDATED = 'ConfigModule.Configuration.Changed',
	CONFIG_RESET = 'ConfigModule.Configuration.Reset',
}

export enum SectionType {
	AUDIO = 'audio',
	DISPLAY = 'display',
	LANGUAGE = 'language',
	WEATHER = 'weather',
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

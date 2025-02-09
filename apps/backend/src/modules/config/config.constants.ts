export const ConfigModulePrefix = 'config-module';

export enum EventType {
	CONFIG_UPDATED = 'ConfigModule.Configuration.Changed',
}

export enum TemperatureUnitEnum {
	CELSIUS = 'celsius',
	FAHRENHEIT = 'fahrenheit',
}

export enum TimeFormatEnum {
	HOUR_12 = '12h',
	HOUR_24 = '24h',
}

export enum LanguageEnum {
	ENGLISH = 'en_US',
	CZECH = 'cs_CZ',
}

export enum WeatherLocationTypeEnum {
	LAT_LON = 'lat_lon',
	CITY_NAME = 'city_name',
	CITY_ID = 'city_id',
	ZIP_CODE = 'zip_code',
}

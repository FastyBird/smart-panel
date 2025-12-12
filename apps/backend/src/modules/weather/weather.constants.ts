export const WEATHER_MODULE_PREFIX = 'weather-module';

export const WEATHER_MODULE_NAME = 'weather-module';

export const WEATHER_MODULE_API_TAG_NAME = 'Weather module';

export const WEATHER_MODULE_API_TAG_DESCRIPTION =
	'A collection of endpoints that provide weather-related functionalities, such as retrieving forecasts and current conditions.';

export enum EventType {
	WEATHER_INFO = 'WeatherModule.Weather.Info',
}

export enum WeatherLocationType {
	LAT_LON = 'lat_lon',
	CITY_NAME = 'city_name',
	CITY_ID = 'city_id',
	ZIP_CODE = 'zip_code',
}

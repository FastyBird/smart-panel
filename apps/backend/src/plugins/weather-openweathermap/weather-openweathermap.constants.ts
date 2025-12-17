export const WEATHER_OPENWEATHERMAP_PLUGIN_PREFIX = 'weather-openweathermap';

export const WEATHER_OPENWEATHERMAP_PLUGIN_NAME = 'weather-openweathermap-plugin';

export const WEATHER_OPENWEATHERMAP_PLUGIN_TYPE = 'weather-openweathermap';

export const WEATHER_OPENWEATHERMAP_PLUGIN_API_TAG_NAME = 'OpenWeatherMap';

export const WEATHER_OPENWEATHERMAP_PLUGIN_API_TAG_DESCRIPTION =
	'Weather provider plugin using OpenWeatherMap API for weather data.';

/**
 * Location types supported by OpenWeatherMap API
 */
export enum OpenWeatherMapLocationType {
	LAT_LON = 'lat_lon',
	CITY_NAME = 'city_name',
	CITY_ID = 'city_id',
	ZIP_CODE = 'zip_code',
}

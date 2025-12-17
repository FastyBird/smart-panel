export const DATA_SOURCES_WEATHER_PLUGIN_PREFIX = 'data-sources-weather';

export const DATA_SOURCES_WEATHER_PLUGIN_NAME = 'data-sources-weather';

export const DATA_SOURCES_WEATHER_CURRENT_TYPE = 'data-source-weather-current';

export const DATA_SOURCES_WEATHER_FORECAST_DAY_TYPE = 'data-source-weather-forecast-day';

export const DATA_SOURCES_WEATHER_PLUGIN_API_TAG_NAME = 'Weather Data Sources plugin';

export const DATA_SOURCES_WEATHER_PLUGIN_API_TAG_DESCRIPTION =
	'Data sources plugin for displaying weather information in the app header.';

export enum WeatherDataField {
	TEMPERATURE = 'temperature',
	TEMPERATURE_MIN = 'temperature_min',
	TEMPERATURE_MAX = 'temperature_max',
	FEELS_LIKE = 'feels_like',
	HUMIDITY = 'humidity',
	PRESSURE = 'pressure',
	WEATHER_ICON = 'weather_icon',
	WEATHER_MAIN = 'weather_main',
	WEATHER_DESCRIPTION = 'weather_description',
	WIND_SPEED = 'wind_speed',
}

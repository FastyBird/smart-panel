import { WeatherOpenweathermapPluginDataLocationLocation_type } from '../../openapi';

export const WEATHER_OPENWEATHERMAP_PLUGIN_PREFIX = 'weather-openweathermap';

export const WEATHER_OPENWEATHERMAP_PLUGIN_NAME = 'weather-openweathermap-plugin';

export const WEATHER_OPENWEATHERMAP_PLUGIN_TYPE = 'weather-openweathermap';

export enum TemperatureUnit {
	CELSIUS = 'celsius',
	FAHRENHEIT = 'fahrenheit',
}

// Re-export the OpenAPI enum for convenience
export const OpenWeatherMapLocationType = WeatherOpenweathermapPluginDataLocationLocation_type;

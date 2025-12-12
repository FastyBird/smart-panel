import { WeatherLocationEntity } from '../entities/locations.entity';
import { CurrentDayModel, ForecastDayModel } from '../models/weather.model';

/**
 * Interface for weather provider implementations.
 * Each weather provider plugin must implement this interface.
 */
export interface IWeatherProvider {
	/**
	 * Returns the provider type identifier (e.g., 'weather-openweathermap')
	 */
	getType(): string;

	/**
	 * Fetches current weather data for the given location
	 * @param location The weather location entity
	 * @returns Current day weather model or null if fetch failed
	 */
	getCurrentWeather(location: WeatherLocationEntity): Promise<CurrentDayModel | null>;

	/**
	 * Fetches weather forecast data for the given location
	 * @param location The weather location entity
	 * @returns Array of forecast day models or null if fetch failed
	 */
	getForecastWeather(location: WeatherLocationEntity): Promise<ForecastDayModel[] | null>;
}

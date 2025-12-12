import { Injectable, Logger } from '@nestjs/common';

import { WeatherLocationEntity } from '../../../modules/weather/entities/locations.entity';
import { CurrentDayModel, ForecastDayModel } from '../../../modules/weather/models/weather.model';
import { IWeatherProvider } from '../../../modules/weather/platforms/weather-provider.platform';
import { OpenWeatherMapLocationEntity } from '../entities/locations-openweathermap.entity';
import { OpenWeatherMapHttpService } from '../services/openweathermap-http.service';
import { WEATHER_OPENWEATHERMAP_PLUGIN_TYPE } from '../weather-openweathermap.constants';

@Injectable()
export class OpenWeatherMapProvider implements IWeatherProvider {
	private readonly logger = new Logger(OpenWeatherMapProvider.name);

	constructor(private readonly httpService: OpenWeatherMapHttpService) {}

	getType(): string {
		return WEATHER_OPENWEATHERMAP_PLUGIN_TYPE;
	}

	async getCurrentWeather(location: WeatherLocationEntity): Promise<CurrentDayModel | null> {
		if (!(location instanceof OpenWeatherMapLocationEntity)) {
			this.logger.error(`[WEATHER] Invalid location type: expected OpenWeatherMapLocationEntity`);
			return null;
		}

		this.logger.debug(`[WEATHER] Fetching current weather for location id=${location.id}`);

		const result = await this.httpService.fetchCurrentWeather(location);

		if (result) {
			this.logger.debug(`[WEATHER] Successfully fetched current weather for location id=${location.id}`);
			return result.current;
		}

		return null;
	}

	async getForecastWeather(location: WeatherLocationEntity): Promise<ForecastDayModel[] | null> {
		if (!(location instanceof OpenWeatherMapLocationEntity)) {
			this.logger.error(`[WEATHER] Invalid location type: expected OpenWeatherMapLocationEntity`);
			return null;
		}

		this.logger.debug(`[WEATHER] Fetching forecast weather for location id=${location.id}`);

		const forecast = await this.httpService.fetchForecastWeather(location);

		if (forecast) {
			this.logger.debug(`[WEATHER] Successfully fetched forecast weather for location id=${location.id}`);
			return forecast;
		}

		return null;
	}
}

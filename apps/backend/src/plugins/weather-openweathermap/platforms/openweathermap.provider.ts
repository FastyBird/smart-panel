import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { WeatherLocationEntity } from '../../../modules/weather/entities/locations.entity';
import { CurrentDayModel, ForecastDayModel } from '../../../modules/weather/models/weather.model';
import { IWeatherProvider } from '../../../modules/weather/platforms/weather-provider.platform';
import { OpenWeatherMapLocationEntity } from '../entities/locations-openweathermap.entity';
import { OpenWeatherMapHttpService } from '../services/openweathermap-http.service';
import {
	WEATHER_OPENWEATHERMAP_PLUGIN_API_TAG_DESCRIPTION,
	WEATHER_OPENWEATHERMAP_PLUGIN_API_TAG_NAME,
	WEATHER_OPENWEATHERMAP_PLUGIN_NAME,
	WEATHER_OPENWEATHERMAP_PLUGIN_TYPE,
} from '../weather-openweathermap.constants';

@Injectable()
export class OpenWeatherMapProvider implements IWeatherProvider {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		WEATHER_OPENWEATHERMAP_PLUGIN_NAME,
		'OpenWeatherMapProvider',
	);

	constructor(private readonly httpService: OpenWeatherMapHttpService) {}

	getType(): string {
		return WEATHER_OPENWEATHERMAP_PLUGIN_TYPE;
	}

	getName(): string {
		return WEATHER_OPENWEATHERMAP_PLUGIN_API_TAG_NAME;
	}

	getDescription(): string {
		return WEATHER_OPENWEATHERMAP_PLUGIN_API_TAG_DESCRIPTION;
	}

	supportsAlerts(): boolean {
		// OpenWeatherMap 2.5 API does not support weather alerts
		// Alerts require One Call API 3.0 which would be a separate plugin
		return false;
	}

	async getCurrentWeather(location: WeatherLocationEntity): Promise<CurrentDayModel | null> {
		if (!(location instanceof OpenWeatherMapLocationEntity)) {
			this.logger.error(`[WEATHER] Invalid location type: expected OpenWeatherMapLocationEntity`);
			return null;
		}

		const result = await this.httpService.fetchCurrentWeather(location);

		if (result) {
			return result.current;
		}

		return null;
	}

	async getForecastWeather(location: WeatherLocationEntity): Promise<ForecastDayModel[] | null> {
		if (!(location instanceof OpenWeatherMapLocationEntity)) {
			this.logger.error(`[WEATHER] Invalid location type: expected OpenWeatherMapLocationEntity`);
			return null;
		}

		const forecast = await this.httpService.fetchForecastWeather(location);

		if (forecast) {
			return forecast;
		}

		return null;
	}
}

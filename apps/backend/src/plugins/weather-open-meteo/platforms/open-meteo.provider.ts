import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { WeatherLocationEntity } from '../../../modules/weather/entities/locations.entity';
import { CurrentDayModel, ForecastDayModel } from '../../../modules/weather/models/weather.model';
import { IWeatherProvider } from '../../../modules/weather/platforms/weather-provider.platform';
import { OpenMeteoLocationEntity } from '../entities/locations-open-meteo.entity';
import { OpenMeteoHttpService } from '../services/open-meteo-http.service';
import {
	WEATHER_OPEN_METEO_PLUGIN_API_TAG_DESCRIPTION,
	WEATHER_OPEN_METEO_PLUGIN_API_TAG_NAME,
	WEATHER_OPEN_METEO_PLUGIN_NAME,
	WEATHER_OPEN_METEO_PLUGIN_TYPE,
} from '../weather-open-meteo.constants';

@Injectable()
export class OpenMeteoProvider implements IWeatherProvider {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		WEATHER_OPEN_METEO_PLUGIN_NAME,
		'OpenMeteoProvider',
	);

	constructor(private readonly httpService: OpenMeteoHttpService) {}

	getType(): string {
		return WEATHER_OPEN_METEO_PLUGIN_TYPE;
	}

	getName(): string {
		return WEATHER_OPEN_METEO_PLUGIN_API_TAG_NAME;
	}

	getDescription(): string {
		return WEATHER_OPEN_METEO_PLUGIN_API_TAG_DESCRIPTION;
	}

	supportsAlerts(): boolean {
		return false;
	}

	async getCurrentWeather(location: WeatherLocationEntity): Promise<CurrentDayModel | null> {
		if (!(location instanceof OpenMeteoLocationEntity)) {
			this.logger.error(`[WEATHER] Invalid location type: expected OpenMeteoLocationEntity`);
			return null;
		}

		this.logger.debug(`[WEATHER] Fetching current weather for location id=${location.id}`);

		const result = await this.httpService.fetchWeatherData(location);

		if (result) {
			this.logger.debug(`[WEATHER] Successfully fetched current weather for location id=${location.id}`);
			return result.current;
		}

		return null;
	}

	async getForecastWeather(location: WeatherLocationEntity): Promise<ForecastDayModel[] | null> {
		if (!(location instanceof OpenMeteoLocationEntity)) {
			this.logger.error(`[WEATHER] Invalid location type: expected OpenMeteoLocationEntity`);
			return null;
		}

		this.logger.debug(`[WEATHER] Fetching forecast weather for location id=${location.id}`);

		const result = await this.httpService.fetchWeatherData(location);

		if (result) {
			this.logger.debug(`[WEATHER] Successfully fetched forecast weather for location id=${location.id}`);
			return result.forecast;
		}

		return null;
	}
}

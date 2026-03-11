import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { WeatherLocationEntity } from '../../../modules/weather/entities/locations.entity';
import { WeatherAlertModel } from '../../../modules/weather/models/alert.model';
import { CurrentDayModel, ForecastDayModel, ForecastHourModel } from '../../../modules/weather/models/weather.model';
import { IWeatherProvider } from '../../../modules/weather/platforms/weather-provider.platform';
import { OpenWeatherMapOneCallLocationEntity } from '../entities/locations-openweathermap-onecall.entity';
import { OpenWeatherMapOneCallHttpService } from '../services/openweathermap-onecall-http.service';
import {
	WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_API_TAG_DESCRIPTION,
	WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_API_TAG_NAME,
	WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_NAME,
	WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_TYPE,
} from '../weather-openweathermap-onecall.constants';

@Injectable()
export class OpenWeatherMapOneCallProvider implements IWeatherProvider {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_NAME,
		'OpenWeatherMapOneCallProvider',
	);

	constructor(private readonly httpService: OpenWeatherMapOneCallHttpService) {}

	getType(): string {
		return WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_TYPE;
	}

	getName(): string {
		return WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_API_TAG_NAME;
	}

	getDescription(): string {
		return WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_API_TAG_DESCRIPTION;
	}

	supportsAlerts(): boolean {
		return true;
	}

	supportsHourlyForecast(): boolean {
		return true;
	}

	async getCurrentWeather(location: WeatherLocationEntity): Promise<CurrentDayModel | null> {
		if (!(location instanceof OpenWeatherMapOneCallLocationEntity)) {
			this.logger.error(`[WEATHER] Invalid location type: expected OpenWeatherMapOneCallLocationEntity`);
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
		if (!(location instanceof OpenWeatherMapOneCallLocationEntity)) {
			this.logger.error(`[WEATHER] Invalid location type: expected OpenWeatherMapOneCallLocationEntity`);
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

	async getHourlyForecast(location: WeatherLocationEntity): Promise<ForecastHourModel[] | null> {
		if (!(location instanceof OpenWeatherMapOneCallLocationEntity)) {
			this.logger.error(`[WEATHER] Invalid location type: expected OpenWeatherMapOneCallLocationEntity`);
			return null;
		}

		this.logger.debug(`[WEATHER] Fetching hourly forecast for location id=${location.id}`);

		const result = await this.httpService.fetchWeatherData(location);

		if (result) {
			this.logger.debug(
				`[WEATHER] Successfully fetched ${result.hourly.length} hourly forecast entries for location id=${location.id}`,
			);
			return result.hourly;
		}

		return null;
	}

	async getAlerts(location: WeatherLocationEntity): Promise<WeatherAlertModel[] | null> {
		if (!(location instanceof OpenWeatherMapOneCallLocationEntity)) {
			this.logger.error(`[WEATHER] Invalid location type: expected OpenWeatherMapOneCallLocationEntity`);
			return null;
		}

		this.logger.debug(`[WEATHER] Fetching weather alerts for location id=${location.id}`);

		const alerts = await this.httpService.fetchAlerts(location);

		if (alerts !== null) {
			this.logger.debug(
				`[WEATHER] Successfully fetched ${alerts.length} weather alert(s) for location id=${location.id}`,
			);
			return alerts;
		}

		return null;
	}
}

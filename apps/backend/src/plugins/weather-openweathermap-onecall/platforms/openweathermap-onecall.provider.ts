import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { WeatherLocationEntity } from '../../../modules/weather/entities/locations.entity';
import { WeatherAlertModel } from '../../../modules/weather/models/alert.model';
import {
	CurrentDayModel,
	ForecastDayModel,
	ForecastHourModel,
	LocationModel,
} from '../../../modules/weather/models/weather.model';
import { IWeatherProvider } from '../../../modules/weather/platforms/weather-provider.platform';
import { OpenWeatherMapOneCallLocationEntity } from '../entities/locations-openweathermap-onecall.entity';
import { OpenWeatherMapOneCallHttpService } from '../services/openweathermap-onecall-http.service';
import {
	WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_API_TAG_DESCRIPTION,
	WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_API_TAG_NAME,
	WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_NAME,
	WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_TYPE,
} from '../weather-openweathermap-onecall.constants';

interface CachedWeatherData {
	current: CurrentDayModel;
	forecast: ForecastDayModel[];
	hourly: ForecastHourModel[];
	location: LocationModel;
	alerts: WeatherAlertModel[];
	timestamp: number;
}

@Injectable()
export class OpenWeatherMapOneCallProvider implements IWeatherProvider {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_NAME,
		'OpenWeatherMapOneCallProvider',
	);

	private readonly cache = new Map<string, CachedWeatherData>();
	private readonly CACHE_TTL_MS = 60_000; // 1 minute

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

		const result = await this.fetchWithCache(location);

		return result?.current ?? null;
	}

	async getForecastWeather(location: WeatherLocationEntity): Promise<ForecastDayModel[] | null> {
		if (!(location instanceof OpenWeatherMapOneCallLocationEntity)) {
			this.logger.error(`[WEATHER] Invalid location type: expected OpenWeatherMapOneCallLocationEntity`);
			return null;
		}

		const result = await this.fetchWithCache(location);

		return result?.forecast ?? null;
	}

	async getHourlyForecast(location: WeatherLocationEntity): Promise<ForecastHourModel[] | null> {
		if (!(location instanceof OpenWeatherMapOneCallLocationEntity)) {
			this.logger.error(`[WEATHER] Invalid location type: expected OpenWeatherMapOneCallLocationEntity`);
			return null;
		}

		const result = await this.fetchWithCache(location);

		return result?.hourly ?? null;
	}

	async getAlerts(location: WeatherLocationEntity): Promise<WeatherAlertModel[] | null> {
		if (!(location instanceof OpenWeatherMapOneCallLocationEntity)) {
			this.logger.error(`[WEATHER] Invalid location type: expected OpenWeatherMapOneCallLocationEntity`);
			return null;
		}

		const result = await this.fetchWithCache(location);

		return result?.alerts ?? null;
	}

	private async fetchWithCache(location: OpenWeatherMapOneCallLocationEntity): Promise<CachedWeatherData | null> {
		const cacheKey = location.id;
		const now = Date.now();

		const cached = this.cache.get(cacheKey);

		if (cached && now - cached.timestamp < this.CACHE_TTL_MS) {
			this.logger.debug(`[WEATHER] Using cached data for location id=${location.id}`);
			return cached;
		}

		if (cached) {
			this.cache.delete(cacheKey);
		}

		this.logger.debug(`[WEATHER] Fetching weather data for location id=${location.id}`);

		const result = await this.httpService.fetchWeatherData(location);

		if (result) {
			const entry: CachedWeatherData = {
				...result,
				timestamp: now,
			};

			this.cache.set(cacheKey, entry);

			this.logger.debug(`[WEATHER] Successfully fetched and cached weather data for location id=${location.id}`);

			return entry;
		}

		return null;
	}
}

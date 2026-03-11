import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { WeatherLocationEntity } from '../../../modules/weather/entities/locations.entity';
import { CurrentDayModel, ForecastDayModel, LocationModel } from '../../../modules/weather/models/weather.model';
import { IWeatherProvider } from '../../../modules/weather/platforms/weather-provider.platform';
import { OpenMeteoLocationEntity } from '../entities/locations-open-meteo.entity';
import { OpenMeteoHttpService } from '../services/open-meteo-http.service';
import {
	WEATHER_OPEN_METEO_PLUGIN_API_TAG_DESCRIPTION,
	WEATHER_OPEN_METEO_PLUGIN_API_TAG_NAME,
	WEATHER_OPEN_METEO_PLUGIN_NAME,
	WEATHER_OPEN_METEO_PLUGIN_TYPE,
} from '../weather-open-meteo.constants';

interface CachedWeatherData {
	current: CurrentDayModel;
	forecast: ForecastDayModel[];
	location: LocationModel;
	timestamp: number;
}

@Injectable()
export class OpenMeteoProvider implements IWeatherProvider {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		WEATHER_OPEN_METEO_PLUGIN_NAME,
		'OpenMeteoProvider',
	);

	private readonly cache = new Map<string, CachedWeatherData>();
	private readonly CACHE_TTL_MS = 60_000; // 1 minute
	private readonly CACHE_MAX_SIZE = 100;

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

		const result = await this.fetchWithCache(location);

		return result?.current ?? null;
	}

	async getForecastWeather(location: WeatherLocationEntity): Promise<ForecastDayModel[] | null> {
		if (!(location instanceof OpenMeteoLocationEntity)) {
			this.logger.error(`[WEATHER] Invalid location type: expected OpenMeteoLocationEntity`);
			return null;
		}

		const result = await this.fetchWithCache(location);

		return result?.forecast ?? null;
	}

	private async fetchWithCache(location: OpenMeteoLocationEntity): Promise<CachedWeatherData | null> {
		const cacheKey = location.id;
		const now = Date.now();

		const cached = this.cache.get(cacheKey);

		if (cached && now - cached.timestamp < this.CACHE_TTL_MS) {
			this.logger.debug(`[WEATHER] Using cached data for location id=${location.id}`);
			return cached;
		}

		// Remove expired entry if present
		if (cached) {
			this.cache.delete(cacheKey);
		}

		this.logger.debug(`[WEATHER] Fetching weather data for location id=${location.id}`);

		const result = await this.httpService.fetchWeatherData(location);

		if (result) {
			this.evictExpiredEntries(now);

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

	private evictExpiredEntries(now: number): void {
		// Always remove expired entries first
		for (const [key, entry] of this.cache) {
			if (now - entry.timestamp >= this.CACHE_TTL_MS) {
				this.cache.delete(key);
			}
		}

		// If still over limit, remove oldest entries
		if (this.cache.size > this.CACHE_MAX_SIZE) {
			const entries = [...this.cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
			const toRemove = this.cache.size - this.CACHE_MAX_SIZE;

			for (let i = 0; i < toRemove; i++) {
				this.cache.delete(entries[i][0]);
			}
		}
	}
}

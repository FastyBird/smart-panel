import { validate } from 'class-validator';
import fetch from 'node-fetch';

import { Injectable, Logger } from '@nestjs/common';

import { toInstance } from '../../../common/utils/transform.utils';
import { TemperatureUnitType, WeatherLocationType } from '../../config/config.constants';
import { ConfigService } from '../../config/services/config.service';
import { GeolocationCityDto, GeolocationZipDto } from '../dto/geolocation.dto';
import { WeatherConfigModel } from '../models/config.model';
import { GeolocationCityModel, GeolocationZipModel } from '../models/geolocation.model';
import { WEATHER_MODULE_NAME } from '../weather.constants';

@Injectable()
export class GeolocationService {
	private readonly logger = new Logger(GeolocationService.name);
	private readonly apiKey: string | null;
	private readonly itemsLimit: number = 5;

	private readonly API_URL = 'https://api.openweathermap.org/geo/1.0';

	constructor(private readonly configService: ConfigService) {
		// Load config lazily - will be loaded on first use
		// This avoids issues during module initialization when mappings might not be registered yet
		try {
			this.apiKey = this.getConfig().openWeatherApiKey;
		} catch {
			// If config is not available yet, use null (will be loaded on first API call)
			this.apiKey = null;
		}
	}

	async getCoordinatesByCity(city: string): Promise<GeolocationCityModel[] | null> {
		try {
			const url = `${this.API_URL}/direct?q=${encodeURIComponent(city)}&limit=${this.itemsLimit}&appid=${this.apiKey}`;

			const response = await fetch(url);

			const data = (await response.json()) as unknown;

			if (!Array.isArray(data)) {
				this.logger.error('[GEOLOCATION] Response has invalid structure');

				return null;
			}

			if (!data.length) {
				this.logger.warn(`[GEOLOCATION] No results found for city=${city}`);

				return null;
			}

			const locations = data.map((item) =>
				toInstance(GeolocationCityDto, item, {
					excludeExtraneousValues: false,
				}),
			);

			const errors = await Promise.all(locations.map((location) => validate(location)));

			if (errors.some((e) => e.length > 0)) {
				this.logger.error(`[VALIDATION] Geolocation response validation failed error=${JSON.stringify(errors)}`);

				return null;
			}

			return locations.map((location) => toInstance(GeolocationCityModel, location));
		} catch (error) {
			this.logger.error(`[GEOLOCATION] Failed to fetch coordinates for city=${city}`, error);

			return null;
		}
	}

	async getCoordinatesByZip(zip: string): Promise<GeolocationZipModel | null> {
		try {
			const url = `${this.API_URL}/zip?zip=${encodeURIComponent(zip)}&limit=${this.itemsLimit}&appid=${this.apiKey}`;

			const response = await fetch(url);

			const data = (await response.json()) as unknown;

			const location = toInstance(GeolocationZipDto, data, {
				excludeExtraneousValues: false,
			});

			const errors = await validate(location);

			if (errors.length > 0) {
				this.logger.error(`[VALIDATION] Geolocation response validation failed error=${JSON.stringify(errors)}`);

				return null;
			}

			return toInstance(GeolocationZipModel, location);
		} catch (error) {
			this.logger.error(`[GEOLOCATION] Failed to fetch coordinates for zip=${zip}`, error);

			return null;
		}
	}

	async getCityByCoordinates(lat: number, lon: number): Promise<GeolocationCityModel[] | null> {
		try {
			const url = `${this.API_URL}/reverse?lat=${lat}&lon=${lon}&limit=${this.itemsLimit}&appid=${this.apiKey}`;

			const response = await fetch(url);

			const data = (await response.json()) as unknown;

			if (!Array.isArray(data)) {
				this.logger.error('[GEOLOCATION] Response has invalid structure');

				return null;
			}

			if (!data.length) {
				this.logger.warn(`[GEOLOCATION] No results found for lat=${lat}, lon=${lon}`);

				return null;
			}

			const locations = data.map((item) =>
				toInstance(GeolocationCityDto, item, {
					excludeExtraneousValues: false,
				}),
			);

			const errors = await Promise.all(locations.map((location) => validate(location)));

			if (errors.some((e) => e.length > 0)) {
				this.logger.error(`[VALIDATION] Geolocation response validation failed error=${JSON.stringify(errors)}`);

				return null;
			}

			return locations.map((location) => toInstance(GeolocationCityModel, location));
		} catch (error) {
			this.logger.error(`[GEOLOCATION] Failed to fetch city for lat=${lat}, lon=${lon}`, error);

			return null;
		}
	}

	private getConfig(): WeatherConfigModel {
		try {
			return this.configService.getModuleConfig<WeatherConfigModel>(WEATHER_MODULE_NAME);
		} catch {
			// If config doesn't exist yet (e.g., during migration or mapping not registered), return default config
			return toInstance(WeatherConfigModel, {
				type: WEATHER_MODULE_NAME,
				locationType: WeatherLocationType.LAT_LON,
				unit: TemperatureUnitType.CELSIUS,
				openWeatherApiKey: null,
				latitude: null,
				longitude: null,
				cityName: null,
				cityId: null,
				zipCode: null,
			});
		}
	}
}

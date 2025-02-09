import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import fetch from 'node-fetch';

import { Injectable, Logger } from '@nestjs/common';

import { WeatherConfigEntity } from '../../config/entities/config.entity';
import { ConfigService } from '../../config/services/config.service';
import { GeolocationDto } from '../dto/geolocation.dto';

@Injectable()
export class GeolocationService {
	private readonly logger = new Logger(GeolocationService.name);
	private readonly apiKey: string | null;
	private readonly itemsLimit: 5;

	private readonly API_URL = 'https://api.openweathermap.org/geo/1.0';

	constructor(private readonly configService: ConfigService) {
		this.apiKey = this.configService.getConfigSection('weather', WeatherConfigEntity).openWeatherApiKey;
	}

	async getCoordinatesByCity(city: string): Promise<GeolocationDto[] | null> {
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

			const locations = data.map((item) => plainToInstance(GeolocationDto, item, { excludeExtraneousValues: true }));

			const errors = await Promise.all(locations.map((location) => validate(location)));

			if (errors.some((e) => e.length > 0)) {
				this.logger.error(`[VALIDATION] Geolocation response validation failed error=${JSON.stringify(errors)}`);

				return null;
			}

			return locations;
		} catch (error) {
			this.logger.error(`[GEOLOCATION] Failed to fetch coordinates for city=${city}`, error);

			return null;
		}
	}

	async getCityByCoordinates(lat: number, lon: number): Promise<GeolocationDto[] | null> {
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

			const locations = data.map((item) => plainToInstance(GeolocationDto, item, { excludeExtraneousValues: true }));

			const errors = await Promise.all(locations.map((location) => validate(location)));

			if (errors.some((e) => e.length > 0)) {
				this.logger.error(`[VALIDATION] Geolocation response validation failed error=${JSON.stringify(errors)}`);

				return null;
			}
		} catch (error) {
			this.logger.error(`[GEOLOCATION] Failed to fetch city for lat=${lat}, lon=${lon}`, error);

			return null;
		}
	}
}

import fetch from 'node-fetch';

import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { toInstance } from '../../../common/utils/transform.utils';
import { ConfigService } from '../../../modules/config/services/config.service';
import { OpenWeatherMapOneCallConfigModel } from '../models/config.model';
import { GeolocationCityModel, GeolocationZipModel } from '../models/geolocation.model';
import { WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_NAME } from '../weather-openweathermap-onecall.constants';

interface OpenWeatherMapGeoCity {
	name: string;
	local_names?: Record<string, string>;
	lat: number;
	lon: number;
	country: string;
	state?: string;
}

interface OpenWeatherMapGeoZip {
	zip: string;
	name: string;
	lat: number;
	lon: number;
	country: string;
}

@Injectable()
export class OpenWeatherMapOneCallGeolocationService {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_NAME,
		'OpenWeatherMapOneCallGeolocationService',
	);
	private readonly itemsLimit: number = 5;
	private readonly API_URL = 'https://api.openweathermap.org/geo/1.0';

	constructor(private readonly configService: ConfigService) {}

	async getCoordinatesByCity(city: string): Promise<GeolocationCityModel[] | null> {
		const apiKey = this.getApiKey();

		if (!apiKey) {
			this.logger.warn('[GEOLOCATION] Missing API key for OpenWeatherMap');
			return null;
		}

		try {
			const url = `${this.API_URL}/direct?q=${encodeURIComponent(city)}&limit=${this.itemsLimit}&appid=${apiKey}`;
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

			return (data as OpenWeatherMapGeoCity[]).map((item) =>
				toInstance(GeolocationCityModel, {
					name: item.name,
					localNames: item.local_names,
					lat: item.lat,
					lon: item.lon,
					country: item.country,
					state: item.state,
				}),
			);
		} catch (error) {
			this.logger.error(`[GEOLOCATION] Failed to fetch coordinates for city=${city}`, error);
			return null;
		}
	}

	async getCoordinatesByZip(zip: string): Promise<GeolocationZipModel | null> {
		const apiKey = this.getApiKey();

		if (!apiKey) {
			this.logger.warn('[GEOLOCATION] Missing API key for OpenWeatherMap');
			return null;
		}

		try {
			const url = `${this.API_URL}/zip?zip=${encodeURIComponent(zip)}&appid=${apiKey}`;
			const response = await fetch(url);

			if (!response.ok) {
				this.logger.warn(`[GEOLOCATION] No results found for zip=${zip}`);
				return null;
			}

			const data = (await response.json()) as OpenWeatherMapGeoZip;

			return toInstance(GeolocationZipModel, {
				zip: data.zip,
				name: data.name,
				lat: data.lat,
				lon: data.lon,
				country: data.country,
			});
		} catch (error) {
			this.logger.error(`[GEOLOCATION] Failed to fetch coordinates for zip=${zip}`, error);
			return null;
		}
	}

	async getCityByCoordinates(lat: number, lon: number): Promise<GeolocationCityModel[] | null> {
		const apiKey = this.getApiKey();

		if (!apiKey) {
			this.logger.warn('[GEOLOCATION] Missing API key for OpenWeatherMap');
			return null;
		}

		try {
			const url = `${this.API_URL}/reverse?lat=${lat}&lon=${lon}&limit=${this.itemsLimit}&appid=${apiKey}`;
			const response = await fetch(url);
			const data = (await response.json()) as unknown;

			if (!Array.isArray(data)) {
				this.logger.error('[GEOLOCATION] Response has invalid structure');
				return null;
			}

			if (!data.length) {
				this.logger.warn(`[GEOLOCATION] No results found for coordinates lat=${lat}, lon=${lon}`);
				return null;
			}

			return (data as OpenWeatherMapGeoCity[]).map((item) =>
				toInstance(GeolocationCityModel, {
					name: item.name,
					localNames: item.local_names,
					lat: item.lat,
					lon: item.lon,
					country: item.country,
					state: item.state,
				}),
			);
		} catch (error) {
			this.logger.error(`[GEOLOCATION] Failed to fetch city for coordinates lat=${lat}, lon=${lon}`, error);
			return null;
		}
	}

	private getApiKey(): string | null {
		try {
			const config = this.configService.getPluginConfig<OpenWeatherMapOneCallConfigModel>(
				WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_NAME,
			);
			return config.apiKey;
		} catch {
			return null;
		}
	}
}

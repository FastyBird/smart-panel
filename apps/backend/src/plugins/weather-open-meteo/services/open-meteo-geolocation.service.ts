import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { toInstance } from '../../../common/utils/transform.utils';
import { OpenMeteoGeolocationCityModel } from '../models/geolocation.model';
import { WEATHER_OPEN_METEO_PLUGIN_NAME } from '../weather-open-meteo.constants';

interface OpenMeteoGeoResult {
	id: number;
	name: string;
	latitude: number;
	longitude: number;
	country_code: string;
	country: string;
	admin1?: string;
}

interface OpenMeteoGeoResponse {
	results?: OpenMeteoGeoResult[];
}

@Injectable()
export class OpenMeteoGeolocationService {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		WEATHER_OPEN_METEO_PLUGIN_NAME,
		'OpenMeteoGeolocationService',
	);
	private readonly itemsLimit: number = 5;
	private readonly API_URL = 'https://geocoding-api.open-meteo.com/v1';

	async getCoordinatesByCity(city: string): Promise<OpenMeteoGeolocationCityModel[] | null> {
		try {
			const url = `${this.API_URL}/search?name=${encodeURIComponent(city)}&count=${this.itemsLimit}&language=en&format=json`;
			const response = await fetch(url);
			const data = (await response.json()) as OpenMeteoGeoResponse;

			if (!data.results || !data.results.length) {
				this.logger.warn(`[GEOLOCATION] No results found for city=${city}`);
				return null;
			}

			return data.results.map((item) =>
				toInstance(OpenMeteoGeolocationCityModel, {
					name: item.name,
					lat: item.latitude,
					lon: item.longitude,
					country: item.country_code,
					state: item.admin1,
				}),
			);
		} catch (error) {
			this.logger.error(
				`[GEOLOCATION] Failed to fetch coordinates for city=${city}`,
				error instanceof Error ? error : String(error),
			);
			return null;
		}
	}
}

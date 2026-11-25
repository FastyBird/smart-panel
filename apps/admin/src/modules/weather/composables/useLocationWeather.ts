import { type ComputedRef, type Ref, computed, ref } from 'vue';

import { useBackend, useLogger } from '../../../common';
import { MODULES_PREFIX } from '../../../app.constants';
import { WEATHER_MODULE_PREFIX } from '../weather.constants';
import { WeatherApiException } from '../weather.exceptions';
import type { IWeatherDay } from '../store/weather-day.store.types';
import type { IWeatherForecast } from '../store/weather-forecast.store.types';
import type { IWeatherHourlyForecast } from '../store/weather-hourly-forecast.store.types';
import { transformWeatherDayResponse } from '../store/weather-day.transformers';
import { transformWeatherForecastResponse } from '../store/weather-forecast.transformers';
import { transformWeatherHourlyForecastResponse } from '../store/weather-hourly-forecast.transformers';

export interface ILocationWeatherDetail {
	current: IWeatherDay;
	forecast: IWeatherForecast;
	hourlyForecast: IWeatherHourlyForecast | null;
}

export interface IUseLocationWeather {
	weather: ComputedRef<ILocationWeatherDetail | null>;
	isLoading: Ref<boolean>;
	hasError: Ref<boolean>;
	fetchLocationWeather: (locationId: string) => Promise<void>;
}

export const useLocationWeather = (): IUseLocationWeather => {
	const backend = useBackend();
	const logger = useLogger();

	const data = ref<ILocationWeatherDetail | null>(null);
	const isLoading = ref<boolean>(false);
	const hasError = ref<boolean>(false);

	const weather = computed<ILocationWeatherDetail | null>(() => data.value);

	// The latest request wins: a page moved to another location while a request was out shows that location's weather,
	// never the answer of the earlier one
	let latestRequest = 0;
	let loadingFor: string | null = null;
	let dataFor: string | null = null;

	const fetchLocationWeather = async (locationId: string): Promise<void> => {
		// The same location is already on its way
		if (isLoading.value && loadingFor === locationId) {
			return;
		}

		const request = ++latestRequest;

		loadingFor = locationId;
		isLoading.value = true;
		hasError.value = false;

		// Another location's weather does not stay on screen while this one loads
		if (dataFor !== locationId) {
			data.value = null;
			dataFor = null;
		}

		try {
			const apiResponse = await backend.client.GET(`/${MODULES_PREFIX}/${WEATHER_MODULE_PREFIX}/weather/{locationId}`, {
				params: {
					path: {
						locationId,
					},
				},
			});

			const { data: responseData, error, response } = apiResponse;

			if (typeof responseData !== 'undefined' && responseData.data) {
				const weatherData = responseData.data as {
					current?: unknown;
					forecast?: unknown[];
					hourly_forecast?: unknown[];
				};

				if (weatherData.current && weatherData.forecast) {
					const transformedCurrent = transformWeatherDayResponse(weatherData.current as Parameters<typeof transformWeatherDayResponse>[0]);
					const transformedForecast = transformWeatherForecastResponse(
						weatherData.forecast as Parameters<typeof transformWeatherForecastResponse>[0]
					);

					let transformedHourly: IWeatherHourlyForecast | null = null;

					if (weatherData.hourly_forecast && Array.isArray(weatherData.hourly_forecast) && weatherData.hourly_forecast.length > 0) {
						try {
							transformedHourly = transformWeatherHourlyForecastResponse(
								weatherData.hourly_forecast as Parameters<typeof transformWeatherHourlyForecastResponse>[0]
							);
						} catch {
							logger.warn('[WEATHER] Failed to transform hourly forecast, skipping');
						}
					}

					if (request !== latestRequest) {
						return;
					}

					data.value = {
						current: transformedCurrent,
						forecast: transformedForecast,
						hourlyForecast: transformedHourly,
					};
					dataFor = locationId;

					return;
				}
			}

			let errorReason: string | null = 'Failed to fetch location weather.';

			if (error) {
				const typedError = error as { message?: string };
				errorReason = typedError.message ?? errorReason;
			}

			throw new WeatherApiException(errorReason, response?.status ?? 500);
		} catch (err) {
			// A newer request has taken over; this one's failure is not the page's any more
			if (request !== latestRequest) {
				return;
			}

			hasError.value = true;

			if (err instanceof WeatherApiException) {
				throw err;
			}

			logger.error('[WEATHER] Failed to fetch location weather', err);
		} finally {
			if (request === latestRequest) {
				isLoading.value = false;
				loadingFor = null;
			}
		}
	};

	return {
		weather,
		isLoading,
		hasError,
		fetchLocationWeather,
	};
};

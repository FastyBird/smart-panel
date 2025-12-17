import { type ComputedRef, type Ref, computed, ref } from 'vue';

import { useBackend, useLogger } from '../../../common';
import { MODULES_PREFIX } from '../../../app.constants';
import { WEATHER_MODULE_PREFIX } from '../weather.constants';
import { WeatherApiException } from '../weather.exceptions';
import type { IWeatherDay } from '../store/weather-day.store.types';
import { transformWeatherDayResponse } from '../store/weather-day.transformers';

export interface ILocationWeatherData {
	current: IWeatherDay;
	locationName: string;
	country: string | null;
}

export interface IUseLocationsWeather {
	weatherByLocation: ComputedRef<Record<string, ILocationWeatherData>>;
	isLoading: Ref<boolean>;
	hasError: Ref<boolean>;
	fetchCompleted: Ref<boolean>;
	fetchLocationsWeather: () => Promise<void>;
}

export const useLocationsWeather = (): IUseLocationsWeather => {
	const backend = useBackend();
	const logger = useLogger();

	const data = ref<Record<string, ILocationWeatherData>>({});
	const isLoading = ref<boolean>(false);
	const hasError = ref<boolean>(false);
	const fetchCompleted = ref<boolean>(false);

	const weatherByLocation = computed<Record<string, ILocationWeatherData>>(() => data.value);

	const fetchLocationsWeather = async (): Promise<void> => {
		if (isLoading.value) {
			return;
		}

		isLoading.value = true;
		hasError.value = false;

		try {
			const apiResponse = await backend.client.GET(`/${MODULES_PREFIX}/${WEATHER_MODULE_PREFIX}/weather`, {});

			const { data: responseData, error, response } = apiResponse;

			if (typeof responseData !== 'undefined' && Array.isArray(responseData.data)) {
				const weatherMap: Record<string, ILocationWeatherData> = {};

				for (const item of responseData.data) {
					if (item.location_id) {
						try {
							const transformedCurrent = transformWeatherDayResponse(item.current);
							const locationData = item.location as { name?: string; country?: string | null } | undefined;

							weatherMap[item.location_id] = {
								current: transformedCurrent,
								locationName: locationData?.name ?? '',
								country: locationData?.country ?? null,
							};
						} catch (transformError) {
							logger.error(`[WEATHER] Failed to transform weather data for location ${item.location_id}`, transformError);
						}
					}
				}

				data.value = weatherMap;

				// Mark as error if:
				// 1. We had items to process but none succeeded (transformation failures)
				// 2. Or response was empty (backend couldn't fetch any weather data)
				if (Object.keys(weatherMap).length === 0) {
					hasError.value = true;
				}

				return;
			}

			let errorReason: string | null = 'Failed to fetch locations weather.';

			if (error) {
				const typedError = error as { message?: string };
				errorReason = typedError.message ?? errorReason;
			}

			throw new WeatherApiException(errorReason, response?.status ?? 500);
		} catch (err) {
			hasError.value = true;

			if (err instanceof WeatherApiException) {
				throw err;
			}

			logger.error('[WEATHER] Failed to fetch locations weather', err);
		} finally {
			isLoading.value = false;
			fetchCompleted.value = true;
		}
	};

	return {
		weatherByLocation,
		isLoading,
		hasError,
		fetchCompleted,
		fetchLocationsWeather,
	};
};

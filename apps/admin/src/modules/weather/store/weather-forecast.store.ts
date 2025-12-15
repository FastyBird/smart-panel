import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { getErrorReason, useBackend, useLogger } from '../../../common';
import { MODULES_PREFIX } from '../../../app.constants';
import type { WeatherModuleGetCurrentOperation } from '../../../openapi.constants';
import { WEATHER_MODULE_PREFIX } from '../weather.constants';
import { WeatherApiException, WeatherValidationException } from '../weather.exceptions';

import { WeatherForecastSchema } from './weather-forecast.store.schemas';
import type {
	IWeatherForecast,
	IWeatherForecastDayRes,
	IWeatherForecastOnEventActionPayload,
	IWeatherForecastSetActionPayload,
	IWeatherForecastStateSemaphore,
	IWeatherForecastStoreActions,
	IWeatherForecastStoreState,
	WeatherForecastStoreSetup,
} from './weather-forecast.store.types';
import { transformWeatherForecastResponse } from './weather-forecast.transformers';

const defaultSemaphore: IWeatherForecastStateSemaphore = {
	getting: false,
};

export const useWeatherForecast = defineStore<'weather_module-weather-forecast', WeatherForecastStoreSetup>(
	'weather_module-weather-forecast',
	(): WeatherForecastStoreSetup => {
		const backend = useBackend();
		const logger = useLogger();

		const semaphore = ref<IWeatherForecastStateSemaphore>(defaultSemaphore);

		const firstLoad = ref<boolean>(false);

		const data = ref<IWeatherForecast | null>(null);

		const firstLoadFinished = (): boolean => firstLoad.value;

		const getting = (): boolean => semaphore.value.getting;

		let pendingGetPromises: Promise<IWeatherForecast> | null = null;

		const onEvent = (payload: IWeatherForecastOnEventActionPayload): IWeatherForecast => {
			return set({
				data: transformWeatherForecastResponse(payload.data as unknown as IWeatherForecastDayRes[]),
			});
		};

		const set = (payload: IWeatherForecastSetActionPayload): IWeatherForecast => {
			const parsedWeatherForecast = WeatherForecastSchema.safeParse(payload.data);

			if (!parsedWeatherForecast.success) {
				logger.error('Schema validation failed with:', parsedWeatherForecast.error);

				throw new WeatherValidationException('Failed to insert weather forecast.');
			}

			data.value = data.value ?? null;

			return (data.value = parsedWeatherForecast.data);
		};

		const get = async (): Promise<IWeatherForecast> => {
			if (pendingGetPromises) {
				return pendingGetPromises;
			}

			const fetchPromise = (async (): Promise<IWeatherForecast> => {
				if (semaphore.value.getting) {
					throw new WeatherApiException('Already getting weather forecast.');
				}

				semaphore.value.getting = true;

				try {
					const apiResponse = await backend.client.GET(`/${MODULES_PREFIX}/${WEATHER_MODULE_PREFIX}/weather/forecast`);

					const { data: responseData, error, response } = apiResponse;

					if (typeof responseData !== 'undefined') {
						data.value = transformWeatherForecastResponse(responseData.data);

						return data.value;
					}

					let errorReason: string | null = 'Failed to fetch weather forecast.';

					if (error) {
						errorReason = getErrorReason<WeatherModuleGetCurrentOperation>(error, errorReason);
					}

					throw new WeatherApiException(errorReason, response.status);
				} finally {
					semaphore.value.getting = false;
				}
			})();

			pendingGetPromises = fetchPromise;

			try {
				return await fetchPromise;
			} finally {
				pendingGetPromises = null;
			}
		};

		return {
			semaphore,
			firstLoad,
			data,
			firstLoadFinished,
			getting,
			onEvent,
			set,
			get,
		};
	}
);

export const registerWeatherForecastStore = (pinia: Pinia): Store<string, IWeatherForecastStoreState, object, IWeatherForecastStoreActions> => {
	return useWeatherForecast(pinia);
};

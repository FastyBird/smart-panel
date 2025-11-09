import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { getErrorReason, useBackend, useLogger } from '../../../common';
import type { operations } from '../../../openapi';
import { WEATHER_MODULE_PREFIX } from '../weather.constants';
import { WeatherApiException, WeatherValidationException } from '../weather.exceptions';

import { WeatherDaySchema } from './weather-day.store.schemas';
import type {
	IWeatherDay,
	IWeatherDayOnEventActionPayload,
	IWeatherDayRes,
	IWeatherDaySetActionPayload,
	IWeatherDayStateSemaphore,
	IWeatherDayStoreActions,
	IWeatherDayStoreState,
	WeatherDayStoreSetup,
} from './weather-day.store.types';
import { transformWeatherDayResponse } from './weather-day.transformers';

const defaultSemaphore: IWeatherDayStateSemaphore = {
	getting: false,
};

export const useWeatherDay = defineStore<'weather_module-weather-day', WeatherDayStoreSetup>(
	'weather_module-weather-day',
	(): WeatherDayStoreSetup => {
		const backend = useBackend();
		const logger = useLogger();

		const semaphore = ref<IWeatherDayStateSemaphore>(defaultSemaphore);

		const firstLoad = ref<boolean>(false);

		const data = ref<IWeatherDay | null>(null);

		const firstLoadFinished = (): boolean => firstLoad.value;

		const getting = (): boolean => semaphore.value.getting;

		let pendingGetPromises: Promise<IWeatherDay> | null = null;

		const onEvent = (payload: IWeatherDayOnEventActionPayload): IWeatherDay => {
			return set({
				data: transformWeatherDayResponse(payload.data as unknown as IWeatherDayRes),
			});
		};

		const set = (payload: IWeatherDaySetActionPayload): IWeatherDay => {
			const parsedWeatherDay = WeatherDaySchema.safeParse(payload.data);

			if (!parsedWeatherDay.success) {
				logger.error('Schema validation failed with:', parsedWeatherDay.error);

				throw new WeatherValidationException('Failed to insert weather day.');
			}

			data.value = data.value ?? null;

			return (data.value = parsedWeatherDay.data);
		};

		const get = async (): Promise<IWeatherDay> => {
			if (pendingGetPromises) {
				return pendingGetPromises;
			}

			const fetchPromise = (async (): Promise<IWeatherDay> => {
				if (semaphore.value.getting) {
					throw new WeatherApiException('Already getting weather day.');
				}

				semaphore.value.getting = true;

				try {
					const apiResponse = await backend.client.GET(`/${WEATHER_MODULE_PREFIX}/weather/current`);

					const { data: responseData, error, response } = apiResponse;

					if (typeof responseData !== 'undefined') {
						data.value = transformWeatherDayResponse(responseData.data);

						return data.value;
					}

					let errorReason: string | null = 'Failed to fetch weather day.';

					if (error) {
						errorReason = getErrorReason<operations['get-weather-module-current']>(error, errorReason);
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

export const registerWeatherDayStore = (pinia: Pinia): Store<string, IWeatherDayStoreState, object, IWeatherDayStoreActions> => {
	return useWeatherDay(pinia);
};

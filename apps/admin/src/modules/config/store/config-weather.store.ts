import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { isUndefined, omitBy } from 'lodash';

import { getErrorReason, useBackend, useLogger } from '../../../common';
import { ConfigModuleWeatherType, PathsConfigModuleConfigSectionGetParametersPathSection, type operations } from '../../../openapi';
import { CONFIG_MODULE_PREFIX } from '../config.constants';
import { ConfigApiException, ConfigException, ConfigValidationException } from '../config.exceptions';

import { ConfigWeatherEditActionPayloadSchema, ConfigWeatherSchema } from './config-weather.store.schemas';
import type {
	ConfigWeatherStoreSetup,
	IConfigWeather,
	IConfigWeatherEditActionPayload,
	IConfigWeatherOnEventActionPayload,
	IConfigWeatherRes,
	IConfigWeatherSetActionPayload,
	IConfigWeatherStateSemaphore,
	IConfigWeatherStoreActions,
	IConfigWeatherStoreState,
} from './config-weather.store.types';
import { transformConfigWeatherResponse, transformConfigWeatherUpdateRequest } from './config-weather.transformers';

const defaultSemaphore: IConfigWeatherStateSemaphore = {
	getting: false,
	updating: false,
};

export const useConfigWeather = defineStore<'config-module_config_weather', ConfigWeatherStoreSetup>(
	'config-module_config_weather',
	(): ConfigWeatherStoreSetup => {
		const backend = useBackend();
		const logger = useLogger();

		const semaphore = ref<IConfigWeatherStateSemaphore>(defaultSemaphore);

		const firstLoad = ref<boolean>(false);

		const data = ref<IConfigWeather | null>(null);

		const firstLoadFinished = (): boolean => firstLoad.value;

		const getting = (): boolean => semaphore.value.getting;

		let pendingGetPromises: Promise<IConfigWeather> | null = null;

		const onEvent = (payload: IConfigWeatherOnEventActionPayload): IConfigWeather => {
			return set({
				data: transformConfigWeatherResponse(payload.data as unknown as IConfigWeatherRes),
			});
		};

		const set = (payload: IConfigWeatherSetActionPayload): IConfigWeather => {
			const parsedConfigWeather = ConfigWeatherSchema.safeParse({ ...payload.data, type: ConfigModuleWeatherType.weather });

			if (!parsedConfigWeather.success) {
				logger.error('Schema validation failed with:', parsedConfigWeather.error);

				throw new ConfigValidationException('Failed to insert weather config.');
			}

			data.value = data.value ?? null;

			return (data.value = parsedConfigWeather.data);
		};

		const get = async (): Promise<IConfigWeather> => {
			if (pendingGetPromises) {
				return pendingGetPromises;
			}

			const fetchPromise = (async (): Promise<IConfigWeather> => {
				if (semaphore.value.getting) {
					throw new ConfigApiException('Already getting weather config.');
				}

				semaphore.value.getting = true;

				const apiResponse = await backend.client.GET(`/${CONFIG_MODULE_PREFIX}/config/{section}`, {
					params: {
						path: {
							section: PathsConfigModuleConfigSectionGetParametersPathSection.weather,
						},
					},
				});

				const { data: responseData, error, response } = apiResponse;

				semaphore.value.getting = false;

				if (typeof responseData !== 'undefined') {
					data.value = transformConfigWeatherResponse(responseData.data);

					return data.value;
				}

				let errorReason: string | null = 'Failed to fetch weather config.';

				if (error) {
					errorReason = getErrorReason<operations['get-config-module-config-section']>(error, errorReason);
				}

				throw new ConfigApiException(errorReason, response.status);
			})();

			pendingGetPromises = fetchPromise;

			try {
				return await fetchPromise;
			} finally {
				pendingGetPromises = null;
			}
		};

		const edit = async (payload: IConfigWeatherEditActionPayload): Promise<IConfigWeather> => {
			const parsedPayload = ConfigWeatherEditActionPayloadSchema.safeParse(payload);

			if (!parsedPayload.success) {
				logger.error('Schema validation failed with:', parsedPayload.error);

				throw new ConfigValidationException('Failed to edit weather config.');
			}

			if (semaphore.value.updating) {
				throw new ConfigException('Weather config is already being updated.');
			}

			const parsedEditedConfig = ConfigWeatherSchema.safeParse({
				...data.value,
				...omitBy(parsedPayload.data.data, isUndefined),
			});

			if (!parsedEditedConfig.success) {
				logger.error('Schema validation failed with:', parsedEditedConfig.error);

				throw new ConfigValidationException('Failed to edit weather config.');
			}

			semaphore.value.updating = true;

			data.value = parsedEditedConfig.data;

			const apiResponse = await backend.client.PATCH(`/${CONFIG_MODULE_PREFIX}/config/{section}`, {
				params: {
					path: {
						section: PathsConfigModuleConfigSectionGetParametersPathSection.weather,
					},
				},
				body: {
					data: transformConfigWeatherUpdateRequest(parsedEditedConfig.data),
				},
			});

			const { data: responseData, error, response } = apiResponse;

			semaphore.value.updating = false;

			if (typeof responseData !== 'undefined') {
				data.value = transformConfigWeatherResponse(responseData.data);

				return data.value;
			}

			// Updating the record on api failed, we need to refresh the record
			await get();

			let errorReason: string | null = 'Failed to update weather config.';

			if (error) {
				errorReason = getErrorReason<operations['update-config-module-config-section']>(error, errorReason);
			}

			throw new ConfigApiException(errorReason, response.status);
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
			edit,
		};
	}
);

export const registerConfigWeatherStore = (pinia: Pinia): Store<string, IConfigWeatherStoreState, object, IConfigWeatherStoreActions> => {
	return useConfigWeather(pinia);
};

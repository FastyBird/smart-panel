import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { isUndefined, omitBy } from 'lodash';

import { getErrorReason, useBackend } from '../../../common';
import { ConfigModuleLanguageType, PathsConfigModuleConfigSectionParametersParametersPathSection, type operations } from '../../../openapi';
import { CONFIG_MODULE_PREFIX } from '../config.constants';
import { ConfigApiException, ConfigException, ConfigValidationException } from '../config.exceptions';

import { ConfigLanguageEditActionPayloadSchema, ConfigLanguageSchema } from './config-language.store.schemas';
import type {
	ConfigLanguageStoreSetup,
	IConfigLanguage,
	IConfigLanguageEditActionPayload,
	IConfigLanguageSetActionPayload,
	IConfigLanguageStateSemaphore,
	IConfigLanguageStoreActions,
	IConfigLanguageStoreState,
} from './config-language.store.types';
import { transformConfigLanguageResponse, transformConfigLanguageUpdateRequest } from './config-language.transformers';

const defaultSemaphore: IConfigLanguageStateSemaphore = {
	getting: false,
	updating: false,
};

export const useConfigLanguage = defineStore<'config-module_config_language', ConfigLanguageStoreSetup>(
	'config-module_config_language',
	(): ConfigLanguageStoreSetup => {
		const backend = useBackend();

		const semaphore = ref<IConfigLanguageStateSemaphore>(defaultSemaphore);

		const firstLoad = ref<boolean>(false);

		const data = ref<IConfigLanguage | null>(null);

		const firstLoadFinished = (): boolean => firstLoad.value;

		const getting = (): boolean => semaphore.value.getting;

		let pendingGetPromises: Promise<IConfigLanguage> | null = null;

		const set = (payload: IConfigLanguageSetActionPayload): IConfigLanguage => {
			const parsedConfigLanguage = ConfigLanguageSchema.safeParse({ ...payload.data, type: ConfigModuleLanguageType.language });

			if (!parsedConfigLanguage.success) {
				console.error('Schema validation failed with:', parsedConfigLanguage.error);

				throw new ConfigValidationException('Failed to insert language config.');
			}

			data.value = data.value ?? null;

			return (data.value = parsedConfigLanguage.data);
		};

		const get = async (): Promise<IConfigLanguage> => {
			if (pendingGetPromises) {
				return pendingGetPromises;
			}

			const fetchPromise = (async (): Promise<IConfigLanguage> => {
				if (semaphore.value.getting) {
					throw new ConfigApiException('Already getting language config.');
				}

				semaphore.value.getting = true;

				const apiResponse = await backend.client.GET(`/${CONFIG_MODULE_PREFIX}/config/{section}`, {
					params: {
						path: {
							section: PathsConfigModuleConfigSectionParametersParametersPathSection.language,
						},
					},
				});

				const { data: responseData, error, response } = apiResponse;

				semaphore.value.getting = false;

				if (typeof responseData !== 'undefined') {
					data.value = transformConfigLanguageResponse(responseData.data);

					return data.value;
				}

				let errorReason: string | null = 'Failed to fetch language config.';

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

		const edit = async (payload: IConfigLanguageEditActionPayload): Promise<IConfigLanguage> => {
			const parsedPayload = ConfigLanguageEditActionPayloadSchema.safeParse(payload);

			if (!parsedPayload.success) {
				console.error('Schema validation failed with:', parsedPayload.error);

				throw new ConfigValidationException('Failed to edit language config.');
			}

			if (semaphore.value.updating) {
				throw new ConfigException('Language config is already being updated.');
			}

			const parsedEditedConfig = ConfigLanguageSchema.safeParse({
				...data.value,
				...omitBy(parsedPayload.data.data, isUndefined),
			});

			if (!parsedEditedConfig.success) {
				console.error('Schema validation failed with:', parsedEditedConfig.error);

				throw new ConfigValidationException('Failed to edit language config.');
			}

			semaphore.value.updating = true;

			data.value = parsedEditedConfig.data;

			const apiResponse = await backend.client.PATCH(`/${CONFIG_MODULE_PREFIX}/config/{section}`, {
				params: {
					path: {
						section: PathsConfigModuleConfigSectionParametersParametersPathSection.language,
					},
				},
				body: {
					data: transformConfigLanguageUpdateRequest(parsedEditedConfig.data),
				},
			});

			const { data: responseData, error, response } = apiResponse;

			semaphore.value.updating = false;

			if (typeof responseData !== 'undefined') {
				data.value = transformConfigLanguageResponse(responseData.data);

				return data.value;
			}

			// Updating record on api failed, we need to refresh record
			await get();

			let errorReason: string | null = 'Failed to update language config.';

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
			set,
			get,
			edit,
		};
	}
);

export const registerConfigLanguageStore = (pinia: Pinia): Store<string, IConfigLanguageStoreState, object, IConfigLanguageStoreActions> => {
	return useConfigLanguage(pinia);
};

import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { isUndefined, omitBy } from 'lodash';

import { getErrorReason, useBackend } from '../../../common';
import { ConfigModuleDisplayType, PathsConfigModuleConfigSectionParametersParametersPathSection, type operations } from '../../../openapi';
import { CONFIG_MODULE_PREFIX } from '../config.constants';
import { ConfigApiException, ConfigException, ConfigValidationException } from '../config.exceptions';

import { ConfigDisplayEditActionPayloadSchema, ConfigDisplaySchema } from './config-display.store.schemas';
import type {
	ConfigDisplayStoreSetup,
	IConfigDisplay,
	IConfigDisplayEditActionPayload,
	IConfigDisplayOnEventActionPayload,
	IConfigDisplayRes,
	IConfigDisplaySetActionPayload,
	IConfigDisplayStateSemaphore,
	IConfigDisplayStoreActions,
	IConfigDisplayStoreState,
} from './config-display.store.types';
import { transformConfigDisplayResponse, transformConfigDisplayUpdateRequest } from './config-display.transformers';

const defaultSemaphore: IConfigDisplayStateSemaphore = {
	getting: false,
	updating: false,
};

export const useConfigDisplay = defineStore<'config-module_config_display', ConfigDisplayStoreSetup>(
	'config-module_config_display',
	(): ConfigDisplayStoreSetup => {
		const backend = useBackend();

		const semaphore = ref<IConfigDisplayStateSemaphore>(defaultSemaphore);

		const firstLoad = ref<boolean>(false);

		const data = ref<IConfigDisplay | null>(null);

		const firstLoadFinished = (): boolean => firstLoad.value;

		const getting = (): boolean => semaphore.value.getting;

		let pendingGetPromises: Promise<IConfigDisplay> | null = null;

		const onEvent = (payload: IConfigDisplayOnEventActionPayload): IConfigDisplay => {
			return set({
				data: transformConfigDisplayResponse(payload.data as unknown as IConfigDisplayRes),
			});
		};

		const set = (payload: IConfigDisplaySetActionPayload): IConfigDisplay => {
			const parsedConfigDisplay = ConfigDisplaySchema.safeParse({ ...payload.data, type: ConfigModuleDisplayType.display });

			if (!parsedConfigDisplay.success) {
				console.error('Schema validation failed with:', parsedConfigDisplay.error);

				throw new ConfigValidationException('Failed to insert display config.');
			}

			data.value = data.value ?? null;

			return (data.value = parsedConfigDisplay.data);
		};

		const get = async (): Promise<IConfigDisplay> => {
			if (pendingGetPromises) {
				return pendingGetPromises;
			}

			const fetchPromise = (async (): Promise<IConfigDisplay> => {
				if (semaphore.value.getting) {
					throw new ConfigApiException('Already getting display config.');
				}

				semaphore.value.getting = true;

				const apiResponse = await backend.client.GET(`/${CONFIG_MODULE_PREFIX}/config/{section}`, {
					params: {
						path: {
							section: PathsConfigModuleConfigSectionParametersParametersPathSection.display,
						},
					},
				});

				const { data: responseData, error, response } = apiResponse;

				semaphore.value.getting = false;

				if (typeof responseData !== 'undefined') {
					data.value = transformConfigDisplayResponse(responseData.data);

					return data.value;
				}

				let errorReason: string | null = 'Failed to fetch display config.';

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

		const edit = async (payload: IConfigDisplayEditActionPayload): Promise<IConfigDisplay> => {
			const parsedPayload = ConfigDisplayEditActionPayloadSchema.safeParse(payload);

			if (!parsedPayload.success) {
				console.error('Schema validation failed with:', parsedPayload.error);

				throw new ConfigValidationException('Failed to edit display config.');
			}

			if (semaphore.value.updating) {
				throw new ConfigException('Display config is already being updated.');
			}

			const parsedEditedConfig = ConfigDisplaySchema.safeParse({
				...data.value,
				...omitBy(parsedPayload.data.data, isUndefined),
			});

			if (!parsedEditedConfig.success) {
				console.error('Schema validation failed with:', parsedEditedConfig.error);

				throw new ConfigValidationException('Failed to edit display config.');
			}

			semaphore.value.updating = true;

			data.value = parsedEditedConfig.data;

			const apiResponse = await backend.client.PATCH(`/${CONFIG_MODULE_PREFIX}/config/{section}`, {
				params: {
					path: {
						section: PathsConfigModuleConfigSectionParametersParametersPathSection.display,
					},
				},
				body: {
					data: transformConfigDisplayUpdateRequest(parsedEditedConfig.data),
				},
			});

			const { data: responseData, error, response } = apiResponse;

			semaphore.value.updating = false;

			if (typeof responseData !== 'undefined') {
				data.value = transformConfigDisplayResponse(responseData.data);

				return data.value;
			}

			// Updating the record on api failed, we need to refresh the record
			await get();

			let errorReason: string | null = 'Failed to update display config.';

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

export const registerConfigDisplayStore = (pinia: Pinia): Store<string, IConfigDisplayStoreState, object, IConfigDisplayStoreActions> => {
	return useConfigDisplay(pinia);
};

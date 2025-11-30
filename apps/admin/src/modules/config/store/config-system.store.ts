import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { isUndefined, omitBy } from 'lodash';

import { getErrorReason, useBackend, useLogger } from '../../../common';
import { ConfigModuleDataSystemType } from '../../../openapi.constants';
import { PathsConfigModuleConfigSectionGetParametersPathSection, type operations } from '../../../openapi';
import { CONFIG_MODULE_PREFIX } from '../config.constants';
import { ConfigApiException, ConfigException, ConfigValidationException } from '../config.exceptions';

import { ConfigSystemEditActionPayloadSchema, ConfigSystemSchema } from './config-system.store.schemas';
import type {
	ConfigSystemStoreSetup,
	IConfigSystem,
	IConfigSystemEditActionPayload,
	IConfigSystemOnEventActionPayload,
	IConfigSystemRes,
	IConfigSystemSetActionPayload,
	IConfigSystemStateSemaphore,
	IConfigSystemStoreActions,
	IConfigSystemStoreState,
} from './config-system.store.types';
import { transformConfigSystemResponse, transformConfigSystemUpdateRequest } from './config-system.transformers';

const defaultSemaphore: IConfigSystemStateSemaphore = {
	getting: false,
	updating: false,
};

export const useConfigSystem = defineStore<'config-module_config_system', ConfigSystemStoreSetup>(
	'config-module_config_system',
	(): ConfigSystemStoreSetup => {
		const backend = useBackend();
		const logger = useLogger();

		const semaphore = ref<IConfigSystemStateSemaphore>(defaultSemaphore);

		const firstLoad = ref<boolean>(false);

		const data = ref<IConfigSystem | null>(null);

		const firstLoadFinished = (): boolean => firstLoad.value;

		const getting = (): boolean => semaphore.value.getting;

		let pendingGetPromises: Promise<IConfigSystem> | null = null;

		const onEvent = (payload: IConfigSystemOnEventActionPayload): IConfigSystem => {
			return set({
				data: transformConfigSystemResponse(payload.data as unknown as IConfigSystemRes),
			});
		};

		const set = (payload: IConfigSystemSetActionPayload): IConfigSystem => {
			const parsedConfigSystem = ConfigSystemSchema.safeParse({ ...payload.data, type: ConfigModuleDataSystemType.system });

			if (!parsedConfigSystem.success) {
				logger.error('Schema validation failed with:', parsedConfigSystem.error);

				throw new ConfigValidationException('Failed to insert system config.');
			}

			data.value = data.value ?? null;

			return (data.value = parsedConfigSystem.data);
		};

		const get = async (): Promise<IConfigSystem> => {
			if (pendingGetPromises) {
				return pendingGetPromises;
			}

			const fetchPromise = (async (): Promise<IConfigSystem> => {
				if (semaphore.value.getting) {
					throw new ConfigApiException('Already getting system config.');
				}

				semaphore.value.getting = true;

				try {
					const apiResponse = await backend.client.GET(`/${CONFIG_MODULE_PREFIX}/config/{section}`, {
						params: {
							path: {
								section: PathsConfigModuleConfigSectionGetParametersPathSection.system,
							},
						},
					});

					const { data: responseData, error, response } = apiResponse;

					if (typeof responseData !== 'undefined') {
						data.value = transformConfigSystemResponse(responseData.data);

						return data.value;
					}

					let errorReason: string | null = 'Failed to fetch system config.';

					if (error) {
						errorReason = getErrorReason<operations['get-config-module-config-section']>(error, errorReason);
					}

					throw new ConfigApiException(errorReason, response.status);
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

		const edit = async (payload: IConfigSystemEditActionPayload): Promise<IConfigSystem> => {
			const parsedPayload = ConfigSystemEditActionPayloadSchema.safeParse(payload);

			if (!parsedPayload.success) {
				logger.error('Schema validation failed with:', parsedPayload.error);

				throw new ConfigValidationException('Failed to edit system config.');
			}

			if (semaphore.value.updating) {
				throw new ConfigException('System config is already being updated.');
			}

			const parsedEditedConfig = ConfigSystemSchema.safeParse({
				...data.value,
				...omitBy(parsedPayload.data.data, isUndefined),
			});

			if (!parsedEditedConfig.success) {
				logger.error('Schema validation failed with:', parsedEditedConfig.error);

				throw new ConfigValidationException('Failed to edit system config.');
			}

			semaphore.value.updating = true;

			data.value = parsedEditedConfig.data;

			try {
				const apiResponse = await backend.client.PATCH(`/${CONFIG_MODULE_PREFIX}/config/{section}`, {
					params: {
						path: {
							section: PathsConfigModuleConfigSectionGetParametersPathSection.system,
						},
					},
					body: {
						data: transformConfigSystemUpdateRequest(parsedEditedConfig.data),
					},
				});

				const { data: responseData, error, response } = apiResponse;

				if (typeof responseData !== 'undefined') {
					data.value = transformConfigSystemResponse(responseData.data);

					return data.value;
				}

				// Updating the record on api failed, we need to refresh the record
				await get();

				let errorReason: string | null = 'Failed to update system config.';

				if (error) {
					errorReason = getErrorReason<operations['update-config-module-config-section']>(error, errorReason);
				}

				throw new ConfigApiException(errorReason, response.status);
			} finally {
				semaphore.value.updating = false;
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
			edit,
		};
	}
);

export const registerConfigSystemStore = (pinia: Pinia): Store<string, IConfigSystemStoreState, object, IConfigSystemStoreActions> => {
	return useConfigSystem(pinia);
};

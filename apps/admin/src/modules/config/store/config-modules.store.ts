import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { isUndefined, omitBy } from 'lodash';

import { getErrorReason, useBackend, useLogger } from '../../../common';
import { MODULES_PREFIX } from '../../../app.constants';
import type {
	ConfigModuleGetConfigModuleOperation,
	ConfigModuleGetConfigOperation,
	ConfigModuleUpdateConfigModuleOperation,
} from '../../../openapi.constants';
import { useModules } from '../composables/useModules';
import { CONFIG_MODULE_PREFIX } from '../config.constants';
import { ConfigApiException, ConfigException, ConfigValidationException } from '../config.exceptions';

import { ConfigModuleSchema, ConfigModuleUpdateReqSchema, ConfigModulesEditActionPayloadSchema } from './config-modules.store.schemas';
import type {
	ConfigModulesStoreSetup,
	IConfigModule,
	IConfigModuleRes,
	IConfigModuleUpdateReq,
	IConfigModulesEditActionPayload,
	IConfigModulesGetActionPayload,
	IConfigModulesOnEventActionPayload,
	IConfigModulesSetActionPayload,
	IConfigModulesStateSemaphore,
	IConfigModulesStoreActions,
	IConfigModulesStoreState,
} from './config-modules.store.types';
import { transformConfigModuleResponse, transformConfigModuleUpdateRequest } from './config-modules.store.transformers';

const defaultSemaphore: IConfigModulesStateSemaphore = {
	fetching: {
		items: false,
		item: [],
	},
	updating: [],
};

export const useConfigModule = defineStore<'config-module_config_module', ConfigModulesStoreSetup>(
	'config-module_config_module',
	(): ConfigModulesStoreSetup => {
		const backend = useBackend();
		const logger = useLogger();

		const { getElement: getModuleElement } = useModules();

		const semaphore = ref<IConfigModulesStateSemaphore>(defaultSemaphore);

		const firstLoad = ref<boolean>(false);

		const data = ref<{ [key: IConfigModule['type']]: IConfigModule }>({});

		const firstLoadFinished = (): boolean => firstLoad.value;

		const getting = (type: IConfigModule['type']): boolean => semaphore.value.fetching.item.includes(type);

		const fetching = (): boolean => semaphore.value.fetching.items;

		const findAll = (): IConfigModule[] => Object.values(data.value);

		const findByType = (type: IConfigModule['type']): IConfigModule | null => data.value[type] ?? null;

		const pendingGetPromises: Record<string, Promise<IConfigModule>> = {};

		const pendingFetchPromises: Record<string, Promise<IConfigModule[]>> = {};

		const updating = (module: IConfigModule['type']): boolean => semaphore.value.updating.includes(module);

		const onEvent = (payload: IConfigModulesOnEventActionPayload): IConfigModule => {
			const element = getModuleElement(payload.type);

			return set({
				data: transformConfigModuleResponse(payload.data as unknown as IConfigModuleRes, element?.schemas?.moduleConfigSchema || ConfigModuleSchema),
			});
		};

		const set = (payload: IConfigModulesSetActionPayload): IConfigModule => {
			const element = getModuleElement(payload.data.type);

			if (data.value && payload.data.type in data.value) {
				const parsed = (element?.schemas?.moduleConfigSchema || ConfigModuleSchema).safeParse({ ...data.value[payload.data.type], ...payload.data });

				if (!parsed.success) {
					logger.error('Schema validation failed with:', parsed.error);

					throw new ConfigValidationException('Failed to insert module configuration.');
				}

				return (data.value[parsed.data.type] = parsed.data);
			}

			const parsed = (element?.schemas?.moduleConfigSchema || ConfigModuleSchema).safeParse(payload.data);

			if (!parsed.success) {
				logger.error('Schema validation failed with:', parsed.error);

				throw new ConfigValidationException('Failed to insert module config.');
			}

			data.value ??= {};

			return (data.value[parsed.data.type] = parsed.data);
		};

		const get = async (payload: IConfigModulesGetActionPayload): Promise<IConfigModule> => {
			const existingPromise = pendingGetPromises[payload.type];
			if (existingPromise) {
				return existingPromise;
			}

			const getPromise = (async (): Promise<IConfigModule> => {
				if (semaphore.value.fetching.item.includes(payload.type)) {
					throw new ConfigApiException('Already getting module config.');
				}

				semaphore.value.fetching.item.push(payload.type);

				try {
					const {
						data: responseData,
						error,
						response,
					} = await backend.client.GET(`/${MODULES_PREFIX}/${CONFIG_MODULE_PREFIX}/config/module/{module}`, {
						params: {
							path: {
								module: payload.type,
							},
						},
					});

					if (typeof responseData !== 'undefined') {
						const element = getModuleElement(responseData.data.type);

						const transformed = transformConfigModuleResponse(responseData.data, element?.schemas?.moduleConfigSchema || ConfigModuleSchema);

						data.value[transformed.type] = transformed;

						return transformed;
					}

					let errorReason: string | null = 'Failed to fetch module config.';

					if (error) {
						errorReason = getErrorReason<ConfigModuleGetConfigModuleOperation>(error, errorReason);
					}

					throw new ConfigApiException(errorReason, response.status);
				} finally {
					semaphore.value.fetching.item = semaphore.value.fetching.item.filter((item) => item !== payload.type);
				}
			})();

			pendingGetPromises[payload.type] = getPromise;

			try {
				return await getPromise;
			} finally {
				delete pendingGetPromises[payload.type];
			}
		};

		const fetch = async (): Promise<IConfigModule[]> => {
			if ('all' in pendingFetchPromises) {
				return pendingFetchPromises['all'];
			}

			const fetchPromise = (async (): Promise<IConfigModule[]> => {
				if (semaphore.value.fetching.items) {
					throw new ConfigApiException('Already fetching modules config.');
				}

				semaphore.value.fetching.items = true;

				try {
					const { data: responseData, error, response } = await backend.client.GET(`/${MODULES_PREFIX}/${CONFIG_MODULE_PREFIX}/config/modules`);

				if (typeof responseData !== 'undefined') {
					data.value = Object.fromEntries(
						responseData.data.map((module) => {
							const element = getModuleElement(module.type);

							const transformed = transformConfigModuleResponse(module, element?.schemas?.moduleConfigSchema || ConfigModuleSchema);

							return [transformed.type, transformed];
						})
					);

						firstLoad.value = true;

						return Object.values(data.value);
					}

					let errorReason: string | null = 'Failed to fetch modules config.';

					if (error) {
						errorReason = getErrorReason<ConfigModuleGetConfigOperation>(error, errorReason);
					}

					throw new ConfigApiException(errorReason, response.status);
				} finally {
					semaphore.value.fetching.items = false;
				}
			})();

			pendingFetchPromises['all'] = fetchPromise;

			try {
				return await fetchPromise;
			} finally {
				delete pendingFetchPromises['all'];
			}
		};

		const edit = async (payload: IConfigModulesEditActionPayload): Promise<IConfigModule> => {
			if (semaphore.value.updating.includes(payload.data.type)) {
				throw new ConfigException('Module config is already being updated.');
			}

			if (!(payload.data.type in data.value)) {
				throw new ConfigException('Failed to get module config data to update.');
			}

			const parsedPayload = ConfigModulesEditActionPayloadSchema.safeParse(payload);

			if (!parsedPayload.success) {
				logger.error('Schema validation failed with:', parsedPayload.error);

				throw new ConfigValidationException('Failed to edit module config.');
			}

			const element = getModuleElement(payload.data.type);

			const parsedEditedConfig = (element?.schemas?.moduleConfigSchema || ConfigModuleSchema).safeParse({
				...data.value[payload.data.type],
				...omitBy(payload.data, isUndefined),
			});

			if (!parsedEditedConfig.success) {
				logger.error('Schema validation failed with:', parsedEditedConfig.error);

				throw new ConfigValidationException('Failed to edit module.');
			}

			semaphore.value.updating.push(payload.data.type);

			data.value[parsedEditedConfig.data.type] = parsedEditedConfig.data;

			try {
				const {
					data: responseData,
					error,
					response,
				} = await backend.client.PATCH(`/${MODULES_PREFIX}/${CONFIG_MODULE_PREFIX}/config/module/{module}`, {
					params: {
						path: {
							module: payload.data.type,
						},
					},
					body: {
						data: transformConfigModuleUpdateRequest<IConfigModuleUpdateReq>(
							parsedEditedConfig.data,
							element?.schemas?.moduleConfigUpdateReqSchema || ConfigModuleUpdateReqSchema
						),
					},
				});

				if (typeof responseData !== 'undefined') {
					const transformed = transformConfigModuleResponse(responseData.data, element?.schemas?.moduleConfigSchema || ConfigModuleSchema);

					data.value[transformed.type] = transformed;

					return transformed;
				}

				// Updating the record on api failed, we need to refresh the record
				await get({ type: payload.data.type });

				let errorReason: string | null = 'Failed to update module config.';

				if (error) {
					errorReason = getErrorReason<ConfigModuleUpdateConfigModuleOperation>(error, errorReason);
				}

				throw new ConfigApiException(errorReason, response.status);
			} finally {
				semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.data.type);
			}
		};

		return {
			semaphore,
			firstLoad,
			data,
			firstLoadFinished,
			getting,
			fetching,
			findAll,
			findByType,
			updating,
			onEvent,
			set,
			get,
			fetch,
			edit,
		};
	}
);

export const registerConfigModuleStore = (pinia: Pinia): Store<string, IConfigModulesStoreState, object, IConfigModulesStoreActions> => {
	return useConfigModule(pinia);
};


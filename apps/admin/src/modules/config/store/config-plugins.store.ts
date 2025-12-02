import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { isUndefined, omitBy } from 'lodash';

import { getErrorReason, useBackend, useLogger } from '../../../common';
import type {
	ConfigModuleGetConfigPluginOperation,
	ConfigModuleGetConfigOperation,
	ConfigModuleUpdateConfigPluginOperation,
} from '../../../openapi.constants';
import { usePlugins } from '../composables/usePlugins';
import { CONFIG_MODULE_PREFIX } from '../config.constants';
import { ConfigApiException, ConfigException, ConfigValidationException } from '../config.exceptions';

import { ConfigPluginSchema, ConfigPluginUpdateReqSchema, ConfigPluginsEditActionPayloadSchema } from './config-plugins.store.schemas';
import type {
	ConfigPluginsStoreSetup,
	IConfigPlugin,
	IConfigPluginRes,
	IConfigPluginUpdateReq,
	IConfigPluginsEditActionPayload,
	IConfigPluginsGetActionPayload,
	IConfigPluginsOnEventActionPayload,
	IConfigPluginsSetActionPayload,
	IConfigPluginsStateSemaphore,
	IConfigPluginsStoreActions,
	IConfigPluginsStoreState,
} from './config-plugins.store.types';
import { transformConfigPluginResponse, transformConfigPluginUpdateRequest } from './config-plugins.transformers';

const defaultSemaphore: IConfigPluginsStateSemaphore = {
	fetching: {
		items: false,
		item: [],
	},
	updating: [],
};

export const useConfigPlugin = defineStore<'config-module_config_plugin', ConfigPluginsStoreSetup>(
	'config-module_config_plugin',
	(): ConfigPluginsStoreSetup => {
		const backend = useBackend();
		const logger = useLogger();

		const { getElement: getPluginElement } = usePlugins();

		const semaphore = ref<IConfigPluginsStateSemaphore>(defaultSemaphore);

		const firstLoad = ref<boolean>(false);

		const data = ref<{ [key: IConfigPlugin['type']]: IConfigPlugin }>({});

		const firstLoadFinished = (): boolean => firstLoad.value;

		const getting = (type: IConfigPlugin['type']): boolean => semaphore.value.fetching.item.includes(type);

		const fetching = (): boolean => semaphore.value.fetching.items;

		const findAll = (): IConfigPlugin[] => Object.values(data.value);

		const findByType = (type: IConfigPlugin['type']): IConfigPlugin | null => (type in data.value ? data.value[type] : null);

		const pendingGetPromises: Record<string, Promise<IConfigPlugin>> = {};

		const pendingFetchPromises: Record<string, Promise<IConfigPlugin[]>> = {};

		const updating = (plugin: IConfigPlugin['type']): boolean => semaphore.value.updating.includes(plugin);

		const onEvent = (payload: IConfigPluginsOnEventActionPayload): IConfigPlugin => {
			const element = getPluginElement(payload.type);

			return set({
				data: transformConfigPluginResponse(payload.data as unknown as IConfigPluginRes, element?.schemas?.pluginConfigSchema || ConfigPluginSchema),
			});
		};

		const set = (payload: IConfigPluginsSetActionPayload): IConfigPlugin => {
			const element = getPluginElement(payload.data.type);

			if (data.value && payload.data.type in data.value) {
				const parsed = (element?.schemas?.pluginConfigSchema || ConfigPluginSchema).safeParse({ ...data.value[payload.data.type], ...payload.data });

				if (!parsed.success) {
					logger.error('Schema validation failed with:', parsed.error);

					throw new ConfigValidationException('Failed to insert plugin configuration.');
				}

				return (data.value[parsed.data.type] = parsed.data);
			}

			const parsed = (element?.schemas?.pluginConfigSchema || ConfigPluginSchema).safeParse(payload.data);

			if (!parsed.success) {
				logger.error('Schema validation failed with:', parsed.error);

				throw new ConfigValidationException('Failed to insert plugin config.');
			}

			data.value ??= {};

			return (data.value[parsed.data.type] = parsed.data);
		};

		const get = async (payload: IConfigPluginsGetActionPayload): Promise<IConfigPlugin> => {
			if (payload.type in pendingGetPromises) {
				return pendingGetPromises[payload.type];
			}

			const getPromise = (async (): Promise<IConfigPlugin> => {
				if (semaphore.value.fetching.item.includes(payload.type)) {
					throw new ConfigApiException('Already getting plugin config.');
				}

				semaphore.value.fetching.item.push(payload.type);

				try {
					const {
						data: responseData,
						error,
						response,
					} = await backend.client.GET(`/${CONFIG_MODULE_PREFIX}/config/plugin/{plugin}`, {
						params: {
							path: {
								plugin: payload.type,
							},
						},
					});

					if (typeof responseData !== 'undefined') {
						const element = getPluginElement(responseData.data.type);

						const transformed = transformConfigPluginResponse(responseData.data, element?.schemas?.pluginConfigSchema || ConfigPluginSchema);

						data.value[transformed.type] = transformed;

						return transformed;
					}

					let errorReason: string | null = 'Failed to fetch plugin config.';

					if (error) {
						errorReason = getErrorReason<ConfigModuleGetConfigPluginOperation>(error, errorReason);
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

		const fetch = async (): Promise<IConfigPlugin[]> => {
			if ('all' in pendingFetchPromises) {
				return pendingFetchPromises['all'];
			}

			const fetchPromise = (async (): Promise<IConfigPlugin[]> => {
				if (semaphore.value.fetching.items) {
					throw new ConfigApiException('Already fetching plugins config.');
				}

				semaphore.value.fetching.items = true;

				try {
					const { data: responseData, error, response } = await backend.client.GET(`/${CONFIG_MODULE_PREFIX}/config/plugins`);

					if (typeof responseData !== 'undefined') {
						data.value = Object.fromEntries(
							responseData.data.map((plugin) => {
								const element = getPluginElement(plugin.type);

								const transformed = transformConfigPluginResponse(plugin, element?.schemas?.pluginConfigSchema || ConfigPluginSchema);

								data.value[transformed.type] = transformed;

								return [transformed.type, transformed];
							})
						);

						firstLoad.value = true;

						return Object.values(data.value);
					}

					let errorReason: string | null = 'Failed to fetch plugins config.';

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

		const edit = async (payload: IConfigPluginsEditActionPayload): Promise<IConfigPlugin> => {
			if (semaphore.value.updating.includes(payload.data.type)) {
				throw new ConfigException('Plugin config is already being updated.');
			}

			if (!(payload.data.type in data.value)) {
				throw new ConfigException('Failed to get plugin config data to update.');
			}

			const parsedPayload = ConfigPluginsEditActionPayloadSchema.safeParse(payload);

			if (!parsedPayload.success) {
				logger.error('Schema validation failed with:', parsedPayload.error);

				throw new ConfigValidationException('Failed to edit plugin config.');
			}

			const element = getPluginElement(payload.data.type);

			const parsedEditedConfig = (element?.schemas?.pluginConfigSchema || ConfigPluginSchema).safeParse({
				...data.value[payload.data.type],
				...omitBy(payload.data, isUndefined),
			});

			if (!parsedEditedConfig.success) {
				logger.error('Schema validation failed with:', parsedEditedConfig.error);

				throw new ConfigValidationException('Failed to edit tile.');
			}

			semaphore.value.updating.push(payload.data.type);

			data.value[parsedEditedConfig.data.type] = parsedEditedConfig.data;

			try {
				const {
					data: responseData,
					error,
					response,
				} = await backend.client.PATCH(`/${CONFIG_MODULE_PREFIX}/config/plugin/{plugin}`, {
					params: {
						path: {
							plugin: payload.data.type,
						},
					},
					body: {
						data: transformConfigPluginUpdateRequest<IConfigPluginUpdateReq>(
							parsedEditedConfig.data,
							element?.schemas?.pluginConfigUpdateReqSchema || ConfigPluginUpdateReqSchema
						),
					},
				});

				if (typeof responseData !== 'undefined') {
					const transformed = transformConfigPluginResponse(responseData.data, element?.schemas?.pluginConfigSchema || ConfigPluginSchema);

					data.value[transformed.type] = transformed;

					return transformed;
				}

				// Updating the record on api failed, we need to refresh the record
				await get({ type: payload.data.type });

				let errorReason: string | null = 'Failed to update plugin config.';

				if (error) {
					errorReason = getErrorReason<ConfigModuleUpdateConfigPluginOperation>(error, errorReason);
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

export const registerConfigPluginStore = (pinia: Pinia): Store<string, IConfigPluginsStoreState, object, IConfigPluginsStoreActions> => {
	return useConfigPlugin(pinia);
};

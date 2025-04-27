import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { isUndefined, omitBy } from 'lodash';

import { getErrorReason, useBackend } from '../../../common';
import { type operations } from '../../../openapi';
import { usePlugins } from '../composables/usePlugins';
import { CONFIG_MODULE_PREFIX } from '../config.constants';
import { ConfigApiException, ConfigException, ConfigValidationException } from '../config.exceptions';

import { ConfigPluginSchema, ConfigPluginUpdateReqSchema, ConfigPluginsEditActionPayloadSchema } from './config-plugins.store.schemas';
import type {
	ConfigPluginsStoreSetup,
	IConfigPlugin,
	IConfigPluginUpdateReq,
	IConfigPluginsEditActionPayload,
	IConfigPluginsGetActionPayload,
	IConfigPluginsSetActionPayload,
	IConfigPluginsStateSemaphore,
	IConfigPluginsStoreActions,
	IConfigPluginsStoreState,
} from './config-plugins.store.types';
import { transformConfigPluginResponse, transformConfigPluginUpdateRequest } from './config-plugins.transformers';

const defaultSemaphore: IConfigPluginsStateSemaphore = {
	getting: [],
	updating: [],
};

export const useConfigPlugin = defineStore<'config-module_config_plugin', ConfigPluginsStoreSetup>(
	'config-module_config_plugin',
	(): ConfigPluginsStoreSetup => {
		const backend = useBackend();

		const { getByType: getPluginByType } = usePlugins();

		const semaphore = ref<IConfigPluginsStateSemaphore>(defaultSemaphore);

		const data = ref<{ [key: IConfigPlugin['type']]: IConfigPlugin }>({});

		const getting = (plugin: IConfigPlugin['type']): boolean => semaphore.value.getting.includes(plugin);

		const updating = (plugin: IConfigPlugin['type']): boolean => semaphore.value.updating.includes(plugin);

		const pendingGetPromises: Record<IConfigPlugin['type'], Promise<IConfigPlugin>> = {};

		const set = (payload: IConfigPluginsSetActionPayload): IConfigPlugin => {
			const plugin = getPluginByType(payload.data.type);

			if (data.value && payload.data.type in data.value) {
				const parsed = (plugin?.schemas?.pluginConfigSchema || ConfigPluginSchema).safeParse({ ...data.value[payload.data.type], ...payload.data });

				if (!parsed.success) {
					console.error('Schema validation failed with:', parsed.error);

					throw new ConfigValidationException('Failed to insert plugin configuration.');
				}

				return (data.value[parsed.data.type] = parsed.data);
			}

			const parsed = (plugin?.schemas?.pluginConfigSchema || ConfigPluginSchema).safeParse(payload.data);

			if (!parsed.success) {
				console.error('Schema validation failed with:', parsed.error);

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
				if (semaphore.value.getting.includes(payload.type)) {
					throw new ConfigApiException('Already getting plugin config.');
				}

				semaphore.value.getting.push(payload.type);

				const apiResponse = await backend.client.GET(`/${CONFIG_MODULE_PREFIX}/config/plugin/{plugin}`, {
					params: {
						path: {
							plugin: payload.type,
						},
					},
				});

				const { data: responseData, error, response } = apiResponse;

				semaphore.value.getting = semaphore.value.getting.filter((item) => item !== payload.type);

				if (typeof responseData !== 'undefined') {
					const plugin = getPluginByType(responseData.data.type);

					const transformed = transformConfigPluginResponse(responseData.data, plugin?.schemas?.pluginConfigSchema || ConfigPluginSchema);

					data.value[transformed.type] = transformed;

					return transformed;
				}

				let errorReason: string | null = 'Failed to fetch plugin config.';

				if (error) {
					errorReason = getErrorReason<operations['get-config-module-config-plugin']>(error, errorReason);
				}

				throw new ConfigApiException(errorReason, response.status);
			})();

			pendingGetPromises[payload.type] = getPromise;

			try {
				return await getPromise;
			} finally {
				delete pendingGetPromises[payload.type];
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
				console.error('Schema validation failed with:', parsedPayload.error);

				throw new ConfigValidationException('Failed to edit plugin config.');
			}

			const plugin = getPluginByType(payload.data.type);

			const parsedEditedConfig = (plugin?.schemas?.pluginConfigSchema || ConfigPluginSchema).safeParse({
				...data.value[payload.data.type],
				...omitBy(payload.data, isUndefined),
			});

			if (!parsedEditedConfig.success) {
				console.error('Schema validation failed with:', parsedEditedConfig.error);

				throw new ConfigValidationException('Failed to edit tile.');
			}

			semaphore.value.updating.push(payload.data.type);

			data.value[parsedEditedConfig.data.type] = parsedEditedConfig.data;

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
						plugin?.schemas?.pluginConfigUpdateReqSchema || ConfigPluginUpdateReqSchema
					),
				},
			});

			semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.data.type);

			if (typeof responseData !== 'undefined') {
				const transformed = transformConfigPluginResponse(responseData.data, plugin?.schemas?.pluginConfigSchema || ConfigPluginSchema);

				data.value[transformed.type] = transformed;

				return transformed;
			}

			// Updating record on api failed, we need to refresh record
			await get({ type: payload.data.type });

			let errorReason: string | null = 'Failed to update plugin config.';

			if (error) {
				errorReason = getErrorReason<operations['update-config-module-config-plugin']>(error, errorReason);
			}

			throw new ConfigApiException(errorReason, response.status);
		};

		return {
			semaphore,
			data,
			getting,
			updating,
			set,
			get,
			edit,
		};
	}
);

export const registerConfigPluginStore = (pinia: Pinia): Store<string, IConfigPluginsStoreState, object, IConfigPluginsStoreActions> => {
	return useConfigPlugin(pinia);
};

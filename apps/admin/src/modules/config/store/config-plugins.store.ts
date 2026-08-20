import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { isUndefined, omitBy } from 'lodash';

import { getErrorReason, useBackend, useLogger } from '../../../common';
import { MODULES_PREFIX } from '../../../app.constants';
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
	IConfigPluginValidationResult,
	IConfigPluginsEditActionPayload,
	IConfigPluginsGetActionPayload,
	IConfigPluginsOnEventActionPayload,
	IConfigPluginsSetActionPayload,
	IConfigPluginsStateSemaphore,
	IConfigPluginsStoreActions,
	IConfigPluginsStoreState,
	IConfigPluginsValidateActionPayload,
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

		const findByType = (type: IConfigPlugin['type']): IConfigPlugin | null => data.value[type] ?? null;

		const pendingGetPromises: Record<string, Promise<IConfigPlugin>> = {};

		const pendingFetchPromises: Record<string, Promise<IConfigPlugin[]>> = {};

		// Stamped on every write that is not `fetch()` applying its own response — a websocket event,
		// a change-driven `get()`, an `edit()`. `fetch()` remembers the stamp it went out under, so
		// when its response lands it can tell which entries were written since: for those the snapshot
		// is the older story and must not overwrite them. See the guard inside `fetch()` below.
		let mutationToken = 0;
		const mutationTokenByType: Record<IConfigPlugin['type'], number> = {};

		// The one way an entry is written outside `fetch()`. Every direct `data.value[...] = ...`
		// write below goes through it, which is what keeps the stamp complete.
		const commit = (config: IConfigPlugin): IConfigPlugin => {
			mutationTokenByType[config.type] = ++mutationToken;

			return (data.value[config.type] = config);
		};

		const updating = (plugin: IConfigPlugin['type']): boolean => semaphore.value.updating.includes(plugin);

		const onEvent = (payload: IConfigPluginsOnEventActionPayload): IConfigPlugin => {
			const element = getPluginElement(payload.type);

			return set({
				data: transformConfigPluginResponse(payload.data as IConfigPluginRes, element?.schemas?.pluginConfigSchema || ConfigPluginSchema),
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

				return commit(parsed.data);
			}

			const parsed = (element?.schemas?.pluginConfigSchema || ConfigPluginSchema).safeParse(payload.data);

			if (!parsed.success) {
				logger.error('Schema validation failed with:', parsed.error);

				throw new ConfigValidationException('Failed to insert plugin config.');
			}

			data.value ??= {};

			return commit(parsed.data);
		};

		const get = async (payload: IConfigPluginsGetActionPayload): Promise<IConfigPlugin> => {
			const existingPromise = pendingGetPromises[payload.type];
			if (existingPromise) {
				if (payload.force) {
					// A change-driven refresh must be a genuinely fresh read: reusing an in-flight
					// request could hand back a snapshot taken before the change this call is
					// reacting to. Its result does not matter here, only that it has finished — that
					// is what frees the semaphore below for the new request this call makes instead
					// of throwing 'Already getting plugin config.' by firing concurrently.
					await existingPromise.catch(() => undefined);
				} else {
					return existingPromise;
				}
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
					} = await backend.client.GET(`/${MODULES_PREFIX}/${CONFIG_MODULE_PREFIX}/config/plugin/{plugin}`, {
						params: {
							path: {
								plugin: payload.type,
							},
						},
					});

					if (typeof responseData !== 'undefined') {
						const element = getPluginElement(responseData.data.type);

						const transformed = transformConfigPluginResponse(responseData.data, element?.schemas?.pluginConfigSchema || ConfigPluginSchema);

						return commit(transformed);
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

			// Read before the request goes out: every entry stamped later than this was written while
			// the server was assembling its answer, so for those entries this response is out of date.
			const requestedAt = mutationToken;

			const fetchPromise = (async (): Promise<IConfigPlugin[]> => {
				if (semaphore.value.fetching.items) {
					throw new ConfigApiException('Already fetching plugins config.');
				}

				semaphore.value.fetching.items = true;

				try {
					const { data: responseData, error, response } = await backend.client.GET(`/${MODULES_PREFIX}/${CONFIG_MODULE_PREFIX}/config/plugins`);

					if (typeof responseData !== 'undefined') {
						// Applied entry by entry rather than assigned wholesale: an entry written since
						// `requestedAt` is newer than this snapshot and keeps what it holds — including
						// having been dropped locally, which is why a stamped type with nothing behind
						// it is left out rather than restored. Entries the response does not carry are
						// still evicted, which is what makes this a replacement rather than a merge
						// that can only ever grow.
						const applied: { [key: IConfigPlugin['type']]: IConfigPlugin } = {};

						for (const plugin of responseData.data) {
							const element = getPluginElement(plugin.type);

							const transformed = transformConfigPluginResponse(plugin, element?.schemas?.pluginConfigSchema || ConfigPluginSchema);

							if ((mutationTokenByType[transformed.type] ?? 0) > requestedAt) {
								const local = data.value[transformed.type];

								if (local) {
									applied[transformed.type] = local;
								}

								continue;
							}

							applied[transformed.type] = transformed;
						}

						// Written while the request was in flight and absent from its answer: the
						// server read its list before this entry's local write landed.
						for (const [type, token] of Object.entries(mutationTokenByType)) {
							if (token > requestedAt && !(type in applied) && data.value[type]) {
								applied[type] = data.value[type];
							}
						}

						data.value = applied;

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

			commit(parsedEditedConfig.data);

			try {
				const {
					data: responseData,
					error,
					response,
				} = await backend.client.PATCH(`/${MODULES_PREFIX}/${CONFIG_MODULE_PREFIX}/config/plugin/{plugin}`, {
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

					return commit(transformed);
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

		const validateConfig = async (payload: IConfigPluginsValidateActionPayload): Promise<IConfigPluginValidationResult> => {
			const element = getPluginElement(payload.data.type);

			const parsedConfig = (element?.schemas?.pluginConfigSchema || ConfigPluginSchema).safeParse({
				...data.value[payload.data.type],
				...omitBy(payload.data, isUndefined),
			});

			if (!parsedConfig.success) {
				return { valid: false, errors: [{ message: 'Local schema validation failed' }] };
			}

			const { data: responseData, error } = await backend.client.POST(
				`/${MODULES_PREFIX}/${CONFIG_MODULE_PREFIX}/config/plugin/{plugin}/validate`,
				{
					params: { path: { plugin: payload.data.type } },
					body: {
						data: transformConfigPluginUpdateRequest<IConfigPluginUpdateReq>(
							parsedConfig.data,
							element?.schemas?.pluginConfigUpdateReqSchema || ConfigPluginUpdateReqSchema,
						),
					},
				},
			);

			if (responseData) {
				const result = responseData as { data: IConfigPluginValidationResult };

				return result.data;
			}

			if (error) {
				const errorReason = getErrorReason<ConfigModuleUpdateConfigPluginOperation>(error, 'Validation request failed.');

				return { valid: false, errors: [{ message: errorReason ?? 'Validation request failed' }] };
			}

			return { valid: false, errors: [{ message: 'Validation request failed' }] };
		};

		// Reconnect refresh contract: the store itself says whether it holds anything worth
		// re-reading, so the caller never has to guess from a flag it does not maintain.
		const isLoaded = (): boolean => firstLoadFinished() || findAll().length > 0;

		const refresh = (): Promise<unknown> => fetch();

		return {
			isLoaded,
			refresh,
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
			validateConfig,
		};
	}
);

export const registerConfigPluginStore = (pinia: Pinia): Store<string, IConfigPluginsStoreState, object, IConfigPluginsStoreActions> => {
	return useConfigPlugin(pinia);
};

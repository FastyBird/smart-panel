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

		// Everything that can write an entry draws a number from one sequence, and each entry
		// remembers the number behind what it currently holds. A write — a websocket event, an
		// `edit()` — draws its number as it lands, because a write is authoritative the moment it
		// happens. A read draws its number as the request goes out, because a response only ever
		// tells the story of that moment: two reads issued in one order can come back in the
		// other, and it is the earlier request's answer that is stale, however late it arrives.
		let sequence = 0;

		const nextSequence = (): number => ++sequence;

		const appliedSequence: Record<IConfigPlugin['type'], number> = {};

	// Types whose write is in flight. A read issued after that write went out is *not*
	// guaranteed to include it - the server may not have committed it yet - so for as long as
	// one is outstanding no read may speak for the entry, however new its number looks. Without
	// this, a list read issued mid-edit lands with the pre-edit value, takes the higher number,
	// and then rejects the edit's own confirmation as the older story.
	const pendingWrites: Record<IConfigPlugin['type'], number> = {};

	const beginWrite = (type: IConfigPlugin['type']): void => {
		pendingWrites[type] = (pendingWrites[type] ?? 0) + 1;
	};

	const endWrite = (type: IConfigPlugin['type']): void => {
		const remaining = (pendingWrites[type] ?? 1) - 1;

		if (remaining > 0) {
			pendingWrites[type] = remaining;
		} else {
			delete pendingWrites[type];
		}
	};

	const writePending = (type: IConfigPlugin['type']): boolean => (pendingWrites[type] ?? 0) > 0;

		// The one way an entry is written outside `fetch()`. Every direct `data.value[...] = ...`
		// write below goes through it, which is what keeps the sequence complete. `at` places the
		// write in that sequence; omitting it claims the moment of the call, which is what a write
		// wants and a read does not.
		const commit = (config: IConfigPlugin, at: number = nextSequence()): IConfigPlugin => {
			if ((appliedSequence[config.type] ?? 0) > at) {
				// Something newer is already held, so this is the older story and is not applied.
				// The caller still gets an answer about what it asked for — the newer one.
				return data.value[config.type] ?? config;
			}

			appliedSequence[config.type] = at;

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
			const inFlight = pendingGetPromises[payload.type];

			if (inFlight && !payload.force) {
				return inFlight;
			}

			const getPromise = (async (): Promise<IConfigPlugin> => {
				if (inFlight) {
					// A change-driven refresh must be a genuinely fresh read: reusing an in-flight
					// request could hand back a snapshot taken before the change this call is
					// reacting to. Its result does not matter here, only that it has finished — that
					// is what frees the semaphore below for the request this call makes instead.
					//
					// Waiting in here rather than before registering below is what serializes forced
					// refreshes. Two arriving together would otherwise wait on the same request, both
					// resume, and the second would find the semaphore still held by the first and
					// reject with 'Already getting plugin config.' — after its own registration,
					// made later, had already displaced the first's.
					await inFlight.catch(() => undefined);
				}

				if (semaphore.value.fetching.item.includes(payload.type)) {
					throw new ConfigApiException('Already getting plugin config.');
				}

				semaphore.value.fetching.item.push(payload.type);

				// Drawn as the request goes out, not when its answer lands: what comes back
				// describes the configuration as of now, whatever is written while it travels.
				const requestedAt = nextSequence();

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

						// A write for this type is in flight, so this answer is not guaranteed to
						// include it - the server may not have committed it when it was read. The
						// caller still gets the entry, just the copy the write is putting there.
						if (writePending(payload.type)) {
							return data.value[payload.type] ?? transformed;
						}

						return commit(transformed, requestedAt);
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
				// Only the registration this call owns. A forced refresh arriving while this read is
				// still running has already replaced it with its own successor, and deleting that
				// would leave the next caller unable to find — or queue behind — the read that is
				// actually in flight.
				if (pendingGetPromises[payload.type] === getPromise) {
					delete pendingGetPromises[payload.type];
				}
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

				// Drawn as the request goes out: an entry numbered higher than this was written, or
				// read, after the server was asked, so for that entry this response is the older
				// story.
				const requestedAt = nextSequence();

				try {
					const { data: responseData, error, response } = await backend.client.GET(`/${MODULES_PREFIX}/${CONFIG_MODULE_PREFIX}/config/plugins`);

					if (typeof responseData !== 'undefined') {
						// Applied entry by entry rather than assigned wholesale: an entry numbered higher
						// than `requestedAt` was written, or read, after this request went out and keeps
						// what it holds — including having been dropped locally, which is why a numbered
						// type with nothing behind it is left out rather than restored. Entries the
						// response does not carry are still evicted, which is what makes this a
						// replacement rather than a merge that can only ever grow.
						const applied: { [key: IConfigPlugin['type']]: IConfigPlugin } = {};

						for (const plugin of responseData.data) {
							const element = getPluginElement(plugin.type);

							const transformed = transformConfigPluginResponse(plugin, element?.schemas?.pluginConfigSchema || ConfigPluginSchema);

							if (writePending(transformed.type) || (appliedSequence[transformed.type] ?? 0) > requestedAt) {
								const local = data.value[transformed.type];

								if (local) {
									applied[transformed.type] = local;
								}

								continue;
							}

							applied[transformed.type] = transformed;
							appliedSequence[transformed.type] = requestedAt;
						}

						// Written while the request was in flight and absent from its answer: the
						// server read its list before this entry's local write landed.
						for (const [type, at] of Object.entries(appliedSequence)) {
							if (at > requestedAt && !(type in applied) && data.value[type]) {
								applied[type] = data.value[type];
							}
						}

						// An entry this response does not carry is evicted, and the eviction takes this
						// response's number like every other write it makes: a read still in flight
						// from before it must not put back what a newer answer says is gone.
						//
						// The tombstone has to cover more than what is held right now. A `get()` for a
						// type that is currently absent carries no number yet, so without a tombstone
						// of its own it would be free to reinstate an entry this list says no longer
						// exists. Every type this store has heard of - held, numbered before, or being
						// read at this moment - gets one.
						const known = new Set([...Object.keys(data.value), ...Object.keys(appliedSequence), ...Object.keys(pendingGetPromises)]);

						for (const type of known) {
							if (!(type in applied)) {
								appliedSequence[type] = requestedAt;
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

			// Drawn as the request goes out, and so after the optimistic write above, which it is
			// meant to confirm. What comes back describes the configuration as of the moment the
			// server was asked, so a read issued later - a change event's forced refresh, say,
			// picking up somebody else's edit - is the newer story even if it lands first.
			const requestedAt = nextSequence();

			// Held from the moment the request goes out until its answer is in hand. A read issued
			// inside that window carries a higher number but can still be answered from before the
			// write was committed, so it must not be allowed to speak for the entry.
			beginWrite(payload.data.type);

			let writeReleased = false;

			const releaseWrite = (): void => {
				if (writeReleased) {
					return;
				}

				writeReleased = true;

				endWrite(payload.data.type);
			};

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

				releaseWrite();

				if (typeof responseData !== 'undefined') {
					const transformed = transformConfigPluginResponse(responseData.data, element?.schemas?.pluginConfigSchema || ConfigPluginSchema);

					return commit(transformed, requestedAt);
				}

				// Updating the record on api failed, so the optimistic write above has to be rolled
				// back to whatever the server actually holds. Forced, because a plain read would
				// be allowed to join a request that went out before that optimistic write: its
				// answer carries a lower number and would be dropped, leaving the value the failed
				// edit put there in place.
				await get({ type: payload.data.type, force: true });

				let errorReason: string | null = 'Failed to update plugin config.';

				if (error) {
					errorReason = getErrorReason<ConfigModuleUpdateConfigPluginOperation>(error, errorReason);
				}

				throw new ConfigApiException(errorReason, response.status);
			} finally {
				// A backstop for the request throwing outright, which would otherwise leave the
				// entry held for good.
				releaseWrite();

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

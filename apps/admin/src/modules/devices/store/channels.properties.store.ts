import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { isUndefined, omitBy } from 'lodash';

import { MODULES_PREFIX } from '../../../app.constants';
import { getErrorReason, useBackend, useLogger } from '../../../common';
import type {
	DevicesModuleCreateChannelPropertyOperation,
	DevicesModuleDeleteChannelPropertyOperation,
	DevicesModuleGetChannelPropertiesOperation,
	DevicesModuleGetChannelPropertyOperation,
	DevicesModuleUpdateChannelPropertyOperation,
} from '../../../openapi.constants';
import { useChannelsPropertiesPlugins } from '../composables/useChannelsPropertiesPlugins';
import { DEVICES_MODULE_PREFIX } from '../devices.constants';
import { DevicesApiException, DevicesException, DevicesValidationException } from '../devices.exceptions';

import {
	ChannelPropertyCreateReqSchema,
	ChannelPropertySchema,
	ChannelPropertyUpdateReqSchema,
	ChannelsPropertiesAddActionPayloadSchema,
	ChannelsPropertiesEditActionPayloadSchema,
} from './channels.properties.store.schemas';
import type {
	ChannelsPropertiesStoreSetup,
	IChannelProperty,
	IChannelPropertyCreateReq,
	IChannelPropertyRes,
	IChannelPropertyUpdateReq,
	IChannelsPropertiesAddActionPayload,
	IChannelsPropertiesEditActionPayload,
	IChannelsPropertiesFetchActionPayload,
	IChannelsPropertiesGetActionPayload,
	IChannelsPropertiesOnEventActionPayload,
	IChannelsPropertiesRemoveActionPayload,
	IChannelsPropertiesSaveActionPayload,
	IChannelsPropertiesSetActionPayload,
	IChannelsPropertiesStateSemaphore,
	IChannelsPropertiesStoreActions,
	IChannelsPropertiesStoreState,
	IChannelsPropertiesUnsetActionPayload,
} from './channels.properties.store.types';
import {
	transformChannelPropertyCreateRequest,
	transformChannelPropertyResponse,
	transformChannelPropertyUpdateRequest,
} from './channels.properties.transformers';
import type { IChannel } from './channels.store.types';

const defaultSemaphore: IChannelsPropertiesStateSemaphore = {
	fetching: {
		items: [],
		item: [],
	},
	creating: [],
	updating: [],
	deleting: [],
};

export const useChannelsProperties = defineStore<'devices_module-channels_properties', ChannelsPropertiesStoreSetup>(
	'devices_module-channels_properties',
	(): ChannelsPropertiesStoreSetup => {
		const backend = useBackend();
		const logger = useLogger();

		const { getElement: getPluginElement } = useChannelsPropertiesPlugins();

		const semaphore = ref<IChannelsPropertiesStateSemaphore>(defaultSemaphore);

		const firstLoad = ref<IChannel['id'][]>([]);

		const data = ref<{ [key: IChannelProperty['id']]: IChannelProperty }>({});

		const firstLoadFinished = (channelId: IChannel['id']): boolean => firstLoad.value.includes(channelId);

		const getting = (id: IChannelProperty['id']): boolean => semaphore.value.fetching.item.includes(id);

		const fetching = (channelId: IChannel['id']): boolean => semaphore.value.fetching.items.includes(channelId);

		const findAll = (): IChannelProperty[] => Object.values(data.value);

		const findForChannel = (channelId: IChannel['id']): IChannelProperty[] =>
			Object.values(data.value ?? {}).filter((property: IChannelProperty): boolean => property.channel === channelId);

		const findById = (id: IChannelProperty['id']): IChannelProperty | null => data.value[id] ?? null;

		const pendingGetPromises: Record<string, Promise<IChannelProperty>> = {};

		const pendingFetchPromises: Record<string, Promise<IChannelProperty[]>> = {};

		// Writes (including deletion tombstones) fence snapshots requested before them.
		let mutationToken = 0;
		const mutationTokenById: Record<IChannelProperty['id'], number> = {};
		const scopeMutationToken: Record<string, number> = {};
		let requestGeneration = 0;
		const readGenerationById: Record<IChannelProperty['id'], number> = {};

		const commit = (item: IChannelProperty): IChannelProperty => {
			mutationTokenById[item.id] = ++mutationToken;
			return (data.value[item.id] = item);
		};

		const forget = (id: IChannelProperty['id']): void => {
			mutationTokenById[id] = ++mutationToken;
			delete data.value[id];
		};

		const unchangedSince = (item: IChannelProperty, requestedAt: number): boolean =>
			(mutationTokenById[item.id] ?? 0) <= requestedAt && (scopeMutationToken[item.channel] ?? 0) <= requestedAt;

		const canApplyRead = (item: IChannelProperty, requestedAt: number, generation: number): boolean =>
			unchangedSince(item, requestedAt) && (readGenerationById[item.id] ?? 0) <= generation;

		// Shared by `set` and `onEvent` so a single incoming event scans the plugin registry once,
		// not twice: each caller resolves `element` itself and hands it in here.
		const applySet = (
			payload: IChannelsPropertiesSetActionPayload,
			element: ReturnType<typeof getPluginElement>,
			apply: (item: IChannelProperty) => IChannelProperty = commit
		): IChannelProperty => {
			if (payload.id && data.value && payload.id in data.value) {
				const parsed = (element?.schemas?.channelPropertySchema || ChannelPropertySchema).safeParse({ ...data.value[payload.id], ...payload.data });

				if (!parsed.success) {
					logger.error('Schema validation failed with:', parsed.error);

					throw new DevicesValidationException('Failed to insert channel property.');
				}

				return apply(parsed.data);
			}

			const parsed = (element?.schemas?.channelPropertySchema || ChannelPropertySchema).safeParse({ ...payload.data, id: payload.id });

			if (!parsed.success) {
				logger.error('Schema validation failed with:', parsed.error);

				throw new DevicesValidationException('Failed to insert channel property.');
			}

			data.value = data.value ?? {};

			return apply(parsed.data);
		};

		const onEvent = (payload: IChannelsPropertiesOnEventActionPayload): IChannelProperty => {
			const element = getPluginElement(payload.type);

			return applySet(
				{
					id: payload.id,
					data: transformChannelPropertyResponse(
						payload.data as IChannelPropertyRes,
						element?.schemas?.channelPropertySchema || ChannelPropertySchema
					),
				},
				element
			);
		};

		const set = (payload: IChannelsPropertiesSetActionPayload): IChannelProperty => applySet(payload, getPluginElement(payload.data.type));

		// Parents capture this before their request, so embedded snapshots share the child's fences.
		const captureReadSnapshot: IChannelsPropertiesStoreActions['captureReadSnapshot'] = () => {
			const requestedAt = mutationToken;
			const generation = ++requestGeneration;
			return (payload: IChannelsPropertiesSetActionPayload): IChannelProperty =>
				applySet(payload, getPluginElement(payload.data.type), (item: IChannelProperty): IChannelProperty => {
					if (canApplyRead(item, requestedAt, generation)) {
						readGenerationById[item.id] = generation;
						data.value[item.id] = item;
					}
					return data.value[item.id] ?? item;
				});
		};

		const unset = (payload: IChannelsPropertiesUnsetActionPayload): void => {
			if (!data.value) {
				return;
			}

			if (payload.channelId !== undefined) {
				scopeMutationToken[payload.channelId] = ++mutationToken;
				const items = findForChannel(payload.channelId);

				for (const item of items) {
					if (item.id in (data.value ?? {})) {
						forget(item.id);
					}
				}

				return;
			} else if (payload.id !== undefined) {
				forget(payload.id);

				return;
			}

			throw new DevicesException('You have to provide at least channel or property id');
		};

		const get = async (payload: IChannelsPropertiesGetActionPayload): Promise<IChannelProperty> => {
			const existingPromise = pendingGetPromises[payload.id];
			if (existingPromise) {
				return existingPromise;
			}

			const requestedAt = mutationToken;
			const generation = ++requestGeneration;

			const getPromise = (async (): Promise<IChannelProperty> => {
				if (semaphore.value.fetching.item.includes(payload.id)) {
					throw new DevicesApiException('Already fetching channel property.');
				}

				semaphore.value.fetching.item.push(payload.id);

				try {
					const {
						data: responseData,
						error,
						response,
					} = await backend.client.GET(`/${MODULES_PREFIX}/${DEVICES_MODULE_PREFIX}/channels/{channelId}/properties/{id}`, {
						params: {
							path: { channelId: payload.channelId, id: payload.id },
						},
					});

					if (typeof responseData !== 'undefined') {
						const element = getPluginElement(responseData.data.type);

						const transformed = transformChannelPropertyResponse(responseData.data, element?.schemas?.channelPropertySchema || ChannelPropertySchema);

						if (canApplyRead(transformed, requestedAt, generation)) {
							readGenerationById[transformed.id] = generation;
							data.value[transformed.id] = transformed;
						}

						return transformed;
					}

					let errorReason: string | null = 'Failed to fetch channel property.';

					if (error) {
						errorReason = getErrorReason<DevicesModuleGetChannelPropertyOperation>(error, errorReason);
					}

					throw new DevicesApiException(errorReason, response.status);
				} finally {
					semaphore.value.fetching.item = semaphore.value.fetching.item.filter((item) => item !== payload.id);
				}
			})();

			pendingGetPromises[payload.id] = getPromise;

			try {
				return await getPromise;
			} finally {
				delete pendingGetPromises[payload.id];
			}
		};

		const fetch = async (payload: IChannelsPropertiesFetchActionPayload): Promise<IChannelProperty[]> => {
			const existingPromise = pendingFetchPromises[payload.channelId];
			if (existingPromise) {
				return existingPromise;
			}

			const requestedAt = mutationToken;
			const generation = ++requestGeneration;

			const fetchPromise = (async (): Promise<IChannelProperty[]> => {
				if (semaphore.value.fetching.items.includes(payload.channelId)) {
					throw new DevicesApiException('Already fetching properties.');
				}

				semaphore.value.fetching.items.push(payload.channelId);

				firstLoad.value = firstLoad.value.filter((item) => item !== payload.channelId);
				firstLoad.value = [...new Set(firstLoad.value)];

				try {
					const {
						data: responseData,
						error,
						response,
					} = await backend.client.GET(`/${MODULES_PREFIX}/${DEVICES_MODULE_PREFIX}/channels/{channelId}/properties`, {
						params: {
							path: { channelId: payload.channelId },
						},
					});

					if (typeof responseData !== 'undefined') {
						firstLoad.value.push(payload.channelId);
						firstLoad.value = [...new Set(firstLoad.value)];

						for (const property of responseData.data) {
							const element = getPluginElement(property.type);
							const transformed = transformChannelPropertyResponse(property, element?.schemas?.channelPropertySchema || ChannelPropertySchema);

							if (!canApplyRead(transformed, requestedAt, generation)) {
								continue;
							}

							readGenerationById[transformed.id] = generation;
							data.value[transformed.id] = transformed;
						}

						return Object.values(data.value);
					}

					let errorReason: string | null = 'Failed to fetch channel properties.';

					if (error) {
						errorReason = getErrorReason<DevicesModuleGetChannelPropertiesOperation>(error, errorReason);
					}

					throw new DevicesApiException(errorReason, response.status);
				} finally {
					semaphore.value.fetching.items = semaphore.value.fetching.items.filter((item) => item !== payload.channelId);
				}
			})();

			pendingFetchPromises[payload.channelId] = fetchPromise;

			try {
				return await fetchPromise;
			} finally {
				delete pendingFetchPromises[payload.channelId];
			}
		};

		const add = async (payload: IChannelsPropertiesAddActionPayload): Promise<IChannelProperty> => {
			const parsedPayload = ChannelsPropertiesAddActionPayloadSchema.safeParse(payload);

			if (!parsedPayload.success) {
				logger.error('Schema validation failed with:', parsedPayload.error);

				throw new DevicesValidationException('Failed to add property.');
			}

			const element = getPluginElement(payload.data.type);

			const parsedNewItem = (element?.schemas?.channelPropertySchema || ChannelPropertySchema).safeParse({
				...payload.data,
				id: parsedPayload.data.id,
				channel: parsedPayload.data.channelId,
				draft: parsedPayload.data.draft,
				createdAt: new Date(),
			});

			if (!parsedNewItem.success) {
				logger.error('Schema validation failed with:', parsedNewItem.error);

				throw new DevicesValidationException('Failed to add channel property.');
			}

			semaphore.value.creating.push(parsedNewItem.data.id);

			commit(parsedNewItem.data);
			const requestedAt = mutationToken;

			if (parsedNewItem.data.draft) {
				semaphore.value.creating = semaphore.value.creating.filter((item) => item !== parsedNewItem.data.id);

				return parsedNewItem.data;
			} else {
				try {
					const {
						data: responseData,
						error,
						response,
					} = await backend.client.POST(`/${MODULES_PREFIX}/${DEVICES_MODULE_PREFIX}/channels/{channelId}/properties`, {
						params: {
							path: { channelId: payload.channelId },
						},
						body: {
							data: transformChannelPropertyCreateRequest<IChannelPropertyCreateReq>(
								{ ...parsedNewItem.data, value: parsedNewItem.data.value?.value ?? null },
								element?.schemas?.channelPropertyCreateReqSchema || ChannelPropertyCreateReqSchema
							),
						},
					});

					if (typeof responseData !== 'undefined' && responseData.data.id === payload.id) {
						const element = getPluginElement(responseData.data.type);

						const transformed = transformChannelPropertyResponse(responseData.data, element?.schemas?.channelPropertySchema || ChannelPropertySchema);

						if (!unchangedSince(transformed, requestedAt)) {
							return data.value[transformed.id] ?? transformed;
						}

						commit(transformed);

						return transformed;
					}

					// Record could not be created on api, we have to remove it from a database
					if (unchangedSince(parsedNewItem.data, requestedAt)) {
						forget(parsedNewItem.data.id);
					}

					let errorReason: string | null = 'Failed to create channel property.';

					if (error) {
						errorReason = getErrorReason<DevicesModuleCreateChannelPropertyOperation>(error, errorReason);
					}

					throw new DevicesApiException(errorReason, response.status);
				} finally {
					semaphore.value.creating = semaphore.value.creating.filter((item) => item !== parsedNewItem.data.id);
				}
			}
		};

		const edit = async (payload: IChannelsPropertiesEditActionPayload): Promise<IChannelProperty> => {
			if (semaphore.value.updating.includes(payload.id)) {
				throw new DevicesException('Property is already being updated.');
			}

			if (!(payload.id in data.value)) {
				throw new DevicesException('Failed to get channel property data to update.');
			}

			const parsedPayload = ChannelsPropertiesEditActionPayloadSchema.safeParse(payload);

			if (!parsedPayload.success) {
				logger.error('Schema validation failed with:', parsedPayload.error);

				throw new DevicesValidationException('Failed to edit channel property.');
			}

			const element = getPluginElement(payload.data.type);

			const parsedEditedItem = (element?.schemas?.channelPropertySchema || ChannelPropertySchema).safeParse({
				...data.value[payload.id],
				...omitBy({ ...payload.data, ...parsedPayload.data.data }, isUndefined),
			});

			if (!parsedEditedItem.success) {
				logger.error('Schema validation failed with:', parsedEditedItem.error);

				throw new DevicesValidationException('Failed to edit channel property.');
			}

			semaphore.value.updating.push(payload.id);

			commit(parsedEditedItem.data);
			const requestedAt = mutationToken;

			if (parsedEditedItem.data.draft) {
				semaphore.value.updating = semaphore.value.updating.filter((item) => item !== parsedEditedItem.data.id);

				return parsedEditedItem.data;
			} else {
				try {
					const {
						data: responseData,
						error,
						response,
					} = await backend.client.PATCH(`/${MODULES_PREFIX}/${DEVICES_MODULE_PREFIX}/channels/{channelId}/properties/{id}`, {
						params: {
							path: { channelId: payload.channelId, id: payload.id },
						},
						body: {
							data: transformChannelPropertyUpdateRequest<IChannelPropertyUpdateReq>(
								{ ...payload.data, ...parsedPayload.data.data },
								element?.schemas?.channelPropertyUpdateReqSchema || ChannelPropertyUpdateReqSchema
							),
						},
					});

					if (typeof responseData !== 'undefined') {
						const element = getPluginElement(responseData.data.type);

						const transformed = transformChannelPropertyResponse(responseData.data, element?.schemas?.channelPropertySchema || ChannelPropertySchema);

						if (!unchangedSince(transformed, requestedAt)) {
							return data.value[transformed.id] ?? transformed;
						}

						commit(transformed);

						return transformed;
					}

					// Updating the record on api failed, we need to refresh the record
					if (unchangedSince(parsedEditedItem.data, requestedAt)) {
						// Drain an older coalesced GET before asking for recovery state.
						await pendingGetPromises[payload.id]?.catch(() => undefined);
						if (unchangedSince(parsedEditedItem.data, requestedAt)) {
							await get({ id: payload.id, channelId: payload.channelId });
						}
					}

					let errorReason: string | null = 'Failed to update channel property.';

					if (error) {
						errorReason = getErrorReason<DevicesModuleUpdateChannelPropertyOperation>(error, errorReason);
					}

					throw new DevicesApiException(errorReason, response.status);
				} finally {
					semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.id);
				}
			}
		};

		const save = async (payload: IChannelsPropertiesSaveActionPayload): Promise<IChannelProperty> => {
			if (semaphore.value.updating.includes(payload.id)) {
				throw new DevicesException('Property is already being saved.');
			}

			const propertyToSave = data.value[payload.id];
			if (!propertyToSave) {
				throw new DevicesException('Failed to get channel property data to save.');
			}

			const element = getPluginElement(propertyToSave.type);

			const parsedSaveItem = (element?.schemas?.channelPropertySchema || ChannelPropertySchema).safeParse(propertyToSave);

			if (!parsedSaveItem.success) {
				logger.error('Schema validation failed with:', parsedSaveItem.error);

				throw new DevicesValidationException('Failed to save channel property.');
			}

			semaphore.value.updating.push(payload.id);
			const requestedAt = mutationToken;

			try {
				const {
					data: responseData,
					error,
					response,
				} = await backend.client.POST(`/${MODULES_PREFIX}/${DEVICES_MODULE_PREFIX}/channels/{channelId}/properties`, {
					params: {
						path: { channelId: parsedSaveItem.data.channel },
					},
					body: {
						data: transformChannelPropertyCreateRequest<IChannelPropertyCreateReq>(
							{ ...parsedSaveItem.data, value: parsedSaveItem.data.value?.value ?? null },
							element?.schemas?.channelPropertyCreateReqSchema || ChannelPropertyCreateReqSchema
						),
					},
				});

				if (typeof responseData !== 'undefined' && responseData.data.id === payload.id) {
					const element = getPluginElement(responseData.data.type);

					const transformed = transformChannelPropertyResponse(responseData.data, element?.schemas?.channelPropertySchema || ChannelPropertySchema);

					if (!unchangedSince(transformed, requestedAt)) {
						return data.value[transformed.id] ?? transformed;
					}

					commit(transformed);

					return transformed;
				}

				let errorReason: string | null = 'Failed to create channel property.';

				if (error) {
					errorReason = getErrorReason<DevicesModuleCreateChannelPropertyOperation>(error, errorReason);
				}

				throw new DevicesApiException(errorReason, response.status);
			} finally {
				semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.id);
			}
		};

		const remove = async (payload: IChannelsPropertiesRemoveActionPayload): Promise<boolean> => {
			if (semaphore.value.deleting.includes(payload.id)) {
				throw new DevicesException('Property is already being removed.');
			}

			if (!Object.keys(data.value).includes(payload.id)) {
				return true;
			}

			semaphore.value.deleting.push(payload.id);

			const recordToRemove = data.value[payload.id];

			forget(payload.id);

			if (recordToRemove?.draft) {
				semaphore.value.deleting = semaphore.value.deleting.filter((item) => item !== payload.id);
			} else {
				try {
					const { error, response } = await backend.client.DELETE(
						`/${MODULES_PREFIX}/${DEVICES_MODULE_PREFIX}/channels/{channelId}/properties/{id}`,
						{
							params: {
								path: { channelId: payload.channelId, id: payload.id },
							},
						}
					);

					if (response.status === 204) {
						return true;
					}

					// Deleting record on api failed, we need to refresh the record
					await get({ id: payload.id, channelId: payload.channelId });

					let errorReason: string | null = 'Remove property failed.';

					if (error) {
						errorReason = getErrorReason<DevicesModuleDeleteChannelPropertyOperation>(error, errorReason);
					}

					throw new DevicesApiException(errorReason, response.status);
				} finally {
					semaphore.value.deleting = semaphore.value.deleting.filter((item) => item !== payload.id);
				}
			}

			return true;
		};

		return {
			semaphore,
			firstLoad,
			data,
			firstLoadFinished,
			getting,
			fetching,
			findAll,
			findForChannel,
			findById,
			onEvent,
			captureReadSnapshot,
			set,
			unset,
			get,
			fetch,
			add,
			edit,
			save,
			remove,
		};
	}
);

export const registerChannelsPropertiesStore = (
	pinia: Pinia
): Store<string, IChannelsPropertiesStoreState, object, IChannelsPropertiesStoreActions> => {
	return useChannelsProperties(pinia);
};

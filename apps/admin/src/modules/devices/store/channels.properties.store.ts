import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { isUndefined, omitBy } from 'lodash';

import { getErrorReason, useBackend } from '../../../common';
import type { operations } from '../../../openapi';
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
	IChannelPropertyUpdateReq,
	IChannelsPropertiesAddActionPayload,
	IChannelsPropertiesEditActionPayload,
	IChannelsPropertiesFetchActionPayload,
	IChannelsPropertiesGetActionPayload,
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

export const useChannelsProperties = defineStore<'devices_module-channel_properties', ChannelsPropertiesStoreSetup>(
	'devices_module-channel_properties',
	(): ChannelsPropertiesStoreSetup => {
		const backend = useBackend();

		const { getByType: getPluginByType } = useChannelsPropertiesPlugins();

		const semaphore = ref<IChannelsPropertiesStateSemaphore>(defaultSemaphore);

		const firstLoad = ref<IChannel['id'][]>([]);

		const data = ref<{ [key: IChannelProperty['id']]: IChannelProperty }>({});

		const firstLoadFinished = (channelId: IChannel['id']): boolean => firstLoad.value.includes(channelId);

		const getting = (id: IChannelProperty['id']): boolean => semaphore.value.fetching.item.includes(id);

		const fetching = (channelId: IChannel['id']): boolean => semaphore.value.fetching.items.includes(channelId);

		const findAll = (): IChannelProperty[] => Object.values(data.value);

		const findForChannel = (channelId: IChannel['id']): IChannelProperty[] =>
			Object.values(data.value ?? {}).filter((property: IChannelProperty): boolean => property.channel === channelId);

		const findById = (id: IChannelProperty['id']): IChannelProperty | null => (id in data.value ? data.value[id] : null);

		const pendingGetPromises: Record<string, Promise<IChannelProperty>> = {};

		const pendingFetchPromises: Record<string, Promise<IChannelProperty[]>> = {};

		const set = (payload: IChannelsPropertiesSetActionPayload): IChannelProperty => {
			const plugin = getPluginByType(payload.data.type);

			if (payload.id && data.value && payload.id in data.value) {
				const parsed = (plugin?.schemas?.channelPropertySchema || ChannelPropertySchema).safeParse({ ...data.value[payload.id], ...payload.data });

				if (!parsed.success) {
					console.error('Schema validation failed with:', parsed.error);

					throw new DevicesValidationException('Failed to insert channel property.');
				}

				return (data.value[parsed.data.id] = parsed.data);
			}

			const parsed = (plugin?.schemas?.channelPropertySchema || ChannelPropertySchema).safeParse({ ...payload.data, id: payload.id });

			if (!parsed.success) {
				console.error('Schema validation failed with:', parsed.error);

				throw new DevicesValidationException('Failed to insert channel property.');
			}

			data.value = data.value ?? {};

			return (data.value[parsed.data.id] = parsed.data);
		};

		const unset = (payload: IChannelsPropertiesUnsetActionPayload): void => {
			if (!data.value) {
				return;
			}

			if (payload.channelId !== undefined) {
				const items = findForChannel(payload.channelId);

				for (const item of items) {
					if (item.id in (data.value ?? {})) {
						delete (data.value ?? {})[item.id];
					}
				}

				return;
			} else if (payload.id !== undefined) {
				delete data.value[payload.id];

				return;
			}

			throw new DevicesException('You have to provide at least channel or property id');
		};

		const get = async (payload: IChannelsPropertiesGetActionPayload): Promise<IChannelProperty> => {
			if (payload.id in pendingGetPromises) {
				return pendingGetPromises[payload.id];
			}

			const getPromise = (async (): Promise<IChannelProperty> => {
				if (semaphore.value.fetching.item.includes(payload.id)) {
					throw new DevicesApiException('Already fetching channel property.');
				}

				semaphore.value.fetching.item.push(payload.id);

				const {
					data: responseData,
					error,
					response,
				} = await backend.client.GET(`/${DEVICES_MODULE_PREFIX}/channels/{channelId}/properties/{id}`, {
					params: {
						path: { channelId: payload.channelId, id: payload.id },
					},
				});

				semaphore.value.fetching.item = semaphore.value.fetching.item.filter((item) => item !== payload.id);

				if (typeof responseData !== 'undefined') {
					const plugin = getPluginByType(responseData.data.type);

					const transformed = transformChannelPropertyResponse(responseData.data, plugin?.schemas?.channelPropertySchema || ChannelPropertySchema);

					data.value[transformed.id] = transformed;

					return transformed;
				}

				let errorReason: string | null = 'Failed to fetch channel property.';

				if (error) {
					errorReason = getErrorReason<operations['get-devices-module-channel-property']>(error, errorReason);
				}

				throw new DevicesApiException(errorReason, response.status);
			})();

			pendingGetPromises[payload.id] = getPromise;

			try {
				return await getPromise;
			} finally {
				delete pendingGetPromises[payload.id];
			}
		};

		const fetch = async (payload: IChannelsPropertiesFetchActionPayload): Promise<IChannelProperty[]> => {
			if (payload.channelId && payload.channelId in pendingFetchPromises) {
				return pendingFetchPromises[payload.channelId];
			}

			const fetchPromise = (async (): Promise<IChannelProperty[]> => {
				if (semaphore.value.fetching.items.includes(payload.channelId)) {
					throw new DevicesApiException('Already fetching properties.');
				}

				semaphore.value.fetching.items.push(payload.channelId);

				firstLoad.value = firstLoad.value.filter((item) => item !== payload.channelId);
				firstLoad.value = [...new Set(firstLoad.value)];

				const {
					data: responseData,
					error,
					response,
				} = await backend.client.GET(`/${DEVICES_MODULE_PREFIX}/channels/{channelId}/properties`, {
					params: {
						path: { channelId: payload.channelId },
					},
				});

				semaphore.value.fetching.items = semaphore.value.fetching.items.filter((item) => item !== payload.channelId);

				if (typeof responseData !== 'undefined') {
					firstLoad.value.push(payload.channelId);
					firstLoad.value = [...new Set(firstLoad.value)];

					const properties = Object.fromEntries(
						responseData.data.map((property) => {
							const plugin = getPluginByType(property.type);

							const transformed = transformChannelPropertyResponse(property, plugin?.schemas?.channelPropertySchema || ChannelPropertySchema);

							return [transformed.id, transformed];
						})
					);

					data.value = { ...data.value, ...properties };

					return Object.values(data.value);
				}

				let errorReason: string | null = 'Failed to fetch channel properties.';

				if (error) {
					errorReason = getErrorReason<operations['get-devices-module-channel-properties']>(error, errorReason);
				}

				throw new DevicesApiException(errorReason, response.status);
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
				console.error('Schema validation failed with:', parsedPayload.error);

				throw new DevicesValidationException('Failed to add property.');
			}

			const plugin = getPluginByType(payload.data.type);

			const parsedNewItem = (plugin?.schemas?.channelPropertySchema || ChannelPropertySchema).safeParse({
				...payload.data,
				id: parsedPayload.data.id,
				channel: parsedPayload.data.channelId,
				draft: parsedPayload.data.draft,
				createdAt: new Date(),
			});

			if (!parsedNewItem.success) {
				console.log({
					...payload.data,
					id: parsedPayload.data.id,
					channel: parsedPayload.data.channelId,
					draft: parsedPayload.data.draft,
					createdAt: new Date(),
				});
				console.error('Schema validation failed with:', parsedNewItem.error);

				throw new DevicesValidationException('Failed to add channel property.');
			}

			semaphore.value.creating.push(parsedNewItem.data.id);

			data.value[parsedNewItem.data.id] = parsedNewItem.data;

			if (parsedNewItem.data.draft) {
				semaphore.value.creating = semaphore.value.creating.filter((item) => item !== parsedNewItem.data.id);

				return parsedNewItem.data;
			} else {
				const {
					data: responseData,
					error,
					response,
				} = await backend.client.POST(`/${DEVICES_MODULE_PREFIX}/channels/{channelId}/properties`, {
					params: {
						path: { channelId: payload.channelId },
					},
					body: {
						data: transformChannelPropertyCreateRequest<IChannelPropertyCreateReq>(
							parsedNewItem.data,
							plugin?.schemas?.channelPropertyCreateReqSchema || ChannelPropertyCreateReqSchema
						),
					},
				});

				semaphore.value.creating = semaphore.value.creating.filter((item) => item !== parsedNewItem.data.id);

				if (typeof responseData !== 'undefined' && responseData.data.id === payload.id) {
					const plugin = getPluginByType(responseData.data.type);

					const transformed = transformChannelPropertyResponse(responseData.data, plugin?.schemas?.channelPropertySchema || ChannelPropertySchema);

					data.value[transformed.id] = transformed;

					return transformed;
				}

				// Record could not be created on api, we have to remove it from database
				delete data.value[parsedNewItem.data.id];

				let errorReason: string | null = 'Failed to create channel property.';

				if (error) {
					errorReason = getErrorReason<operations['create-devices-module-channel-property']>(error, errorReason);
				}

				throw new DevicesApiException(errorReason, response.status);
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
				console.error('Schema validation failed with:', parsedPayload.error);

				throw new DevicesValidationException('Failed to edit channel property.');
			}

			const plugin = getPluginByType(payload.data.type);

			const parsedEditedItem = (plugin?.schemas?.channelPropertySchema || ChannelPropertySchema).safeParse({
				...data.value[payload.id],
				...omitBy(payload.data, isUndefined),
			});

			if (!parsedEditedItem.success) {
				console.error('Schema validation failed with:', parsedEditedItem.error);

				throw new DevicesValidationException('Failed to edit channel property.');
			}

			semaphore.value.updating.push(payload.id);

			data.value[parsedEditedItem.data.id] = parsedEditedItem.data;

			if (parsedEditedItem.data.draft) {
				semaphore.value.updating = semaphore.value.updating.filter((item) => item !== parsedEditedItem.data.id);

				return parsedEditedItem.data;
			} else {
				const {
					data: responseData,
					error,
					response,
				} = await backend.client.PATCH(`/${DEVICES_MODULE_PREFIX}/channels/{channelId}/properties/{id}`, {
					params: {
						path: { channelId: payload.channelId, id: payload.id },
					},
					body: {
						data: transformChannelPropertyUpdateRequest<IChannelPropertyUpdateReq>(
							parsedEditedItem.data,
							plugin?.schemas?.channelPropertyUpdateReqSchema || ChannelPropertyUpdateReqSchema
						),
					},
				});

				semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.id);

				if (typeof responseData !== 'undefined') {
					const plugin = getPluginByType(responseData.data.type);

					const transformed = transformChannelPropertyResponse(responseData.data, plugin?.schemas?.channelPropertySchema || ChannelPropertySchema);

					data.value[transformed.id] = transformed;

					return transformed;
				}

				// Updating record on api failed, we need to refresh record
				await get({ id: payload.id, channelId: payload.channelId });

				let errorReason: string | null = 'Failed to update channel property.';

				if (error) {
					errorReason = getErrorReason<operations['update-devices-module-channel-property']>(error, errorReason);
				}

				throw new DevicesApiException(errorReason, response.status);
			}
		};

		const save = async (payload: IChannelsPropertiesSaveActionPayload): Promise<IChannelProperty> => {
			if (semaphore.value.updating.includes(payload.id)) {
				throw new DevicesException('Property is already being saved.');
			}

			if (!(payload.id in data.value)) {
				throw new DevicesException('Failed to get channel property data to save.');
			}

			const plugin = getPluginByType(data.value[payload.id].type);

			const parsedSaveItem = (plugin?.schemas?.channelPropertySchema || ChannelPropertySchema).safeParse(data.value[payload.id]);

			if (!parsedSaveItem.success) {
				console.error('Schema validation failed with:', parsedSaveItem.error);

				throw new DevicesValidationException('Failed to save channel property.');
			}

			semaphore.value.updating.push(payload.id);

			const {
				data: responseData,
				error,
				response,
			} = await backend.client.POST(`/${DEVICES_MODULE_PREFIX}/channels/{channelId}/properties`, {
				params: {
					path: { channelId: parsedSaveItem.data.channel },
				},
				body: {
					data: transformChannelPropertyCreateRequest<IChannelPropertyCreateReq>(
						parsedSaveItem.data,
						plugin?.schemas?.channelPropertyCreateReqSchema || ChannelPropertyCreateReqSchema
					),
				},
			});

			semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.id);

			if (typeof responseData !== 'undefined' && responseData.data.id === payload.id) {
				const plugin = getPluginByType(responseData.data.type);

				const transformed = transformChannelPropertyResponse(responseData.data, plugin?.schemas?.channelPropertySchema || ChannelPropertySchema);

				data.value[transformed.id] = transformed;

				return transformed;
			}

			let errorReason: string | null = 'Failed to create channel property.';

			if (error) {
				errorReason = getErrorReason<operations['create-devices-module-channel-property']>(error, errorReason);
			}

			throw new DevicesApiException(errorReason, response.status);
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

			delete data.value[payload.id];

			if (recordToRemove.draft) {
				semaphore.value.deleting = semaphore.value.deleting.filter((item) => item !== payload.id);
			} else {
				const { error, response } = await backend.client.DELETE(`/${DEVICES_MODULE_PREFIX}/channels/{channelId}/properties/{id}`, {
					params: {
						path: { channelId: payload.channelId, id: payload.id },
					},
				});

				semaphore.value.deleting = semaphore.value.deleting.filter((item) => item !== payload.id);

				if (response.status === 204) {
					return true;
				}

				// Deleting record on api failed, we need to refresh record
				await get({ id: payload.id, channelId: payload.channelId });

				let errorReason: string | null = 'Remove property failed.';

				if (error) {
					errorReason = getErrorReason<operations['delete-devices-module-channel-property']>(error, errorReason);
				}

				throw new DevicesApiException(errorReason, response.status);
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

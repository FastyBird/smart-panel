import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { isUndefined, omitBy } from 'lodash';

import { getErrorReason, useBackend } from '../../../common';
import type { operations } from '../../../openapi';
import { DEVICES_MODULE_PREFIX } from '../devices.constants';
import { DevicesApiException, DevicesException, DevicesValidationException } from '../devices.exceptions';

import {
	ChannelPropertySchema,
	ChannelsPropertiesAddActionPayloadSchema,
	ChannelsPropertiesEditActionPayloadSchema,
} from './channels.properties.store.schemas';
import type {
	ChannelsPropertiesStoreSetup,
	IChannelProperty,
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
			if (payload.id && data.value && payload.id in data.value) {
				const parsedChannelProperty = ChannelPropertySchema.safeParse({ ...data.value[payload.id], ...payload.data });

				if (!parsedChannelProperty.success) {
					console.error('Schema validation failed with:', parsedChannelProperty.error);

					throw new DevicesValidationException('Failed to insert channel property.');
				}

				return (data.value[parsedChannelProperty.data.id] = parsedChannelProperty.data);
			}

			const parsedChannelProperty = ChannelPropertySchema.safeParse({ ...payload.data, id: payload.id, channel: payload.channelId });

			if (!parsedChannelProperty.success) {
				console.error('Schema validation failed with:', parsedChannelProperty.error);

				throw new DevicesValidationException('Failed to insert channel property.');
			}

			data.value = data.value ?? {};

			return (data.value[parsedChannelProperty.data.id] = parsedChannelProperty.data);
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

			const fetchPromise = (async (): Promise<IChannelProperty> => {
				if (semaphore.value.fetching.item.includes(payload.id)) {
					throw new DevicesApiException('Already fetching property.');
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
					const property = transformChannelPropertyResponse(responseData.data);

					data.value[property.id] = property;

					return property;
				}

				let errorReason: string | null = 'Failed to fetch property.';

				if (error) {
					errorReason = getErrorReason<operations['get-devices-module-channel-property']>(error, errorReason);
				}

				throw new DevicesApiException(errorReason, response.status);
			})();

			pendingGetPromises[payload.id] = fetchPromise;

			try {
				return await fetchPromise;
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
							const transformedProperty = transformChannelPropertyResponse(property);

							return [transformedProperty.id, transformedProperty];
						})
					);

					data.value = { ...data.value, ...properties };

					return Object.values(data.value);
				}

				let errorReason: string | null = 'Failed to fetch properties.';

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

			const parsedNewProperty = ChannelPropertySchema.safeParse({
				...parsedPayload.data.data,
				id: parsedPayload.data.id,
				channel: parsedPayload.data.channelId,
				draft: parsedPayload.data.draft,
				createdAt: new Date(),
				value: null,
			});

			if (!parsedNewProperty.success) {
				console.error('Schema validation failed with:', parsedNewProperty.error);

				throw new DevicesValidationException('Failed to add property.');
			}

			semaphore.value.creating.push(parsedNewProperty.data.id);

			data.value[parsedNewProperty.data.id] = parsedNewProperty.data;

			if (parsedNewProperty.data.draft) {
				semaphore.value.creating = semaphore.value.creating.filter((item) => item !== parsedNewProperty.data.id);

				return parsedNewProperty.data;
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
						data: transformChannelPropertyCreateRequest({ ...parsedNewProperty.data, ...{ id: payload.id, channel: payload.channelId } }),
					},
				});

				semaphore.value.creating = semaphore.value.creating.filter((item) => item !== parsedNewProperty.data.id);

				if (typeof responseData !== 'undefined' && responseData.data.id === payload.id) {
					const property = transformChannelPropertyResponse(responseData.data);

					data.value[property.id] = property;

					return property;
				}

				// Record could not be created on api, we have to remove it from database
				delete data.value[parsedNewProperty.data.id];

				let errorReason: string | null = 'Failed to create property.';

				if (error) {
					errorReason = getErrorReason<operations['create-devices-module-channel-property']>(error, errorReason);
				}

				throw new DevicesApiException(errorReason, response.status);
			}
		};

		const edit = async (payload: IChannelsPropertiesEditActionPayload): Promise<IChannelProperty> => {
			const parsedPayload = ChannelsPropertiesEditActionPayloadSchema.safeParse(payload);

			if (!parsedPayload.success) {
				console.error('Schema validation failed with:', parsedPayload.error);

				throw new DevicesValidationException('Failed to edit property.');
			}

			if (semaphore.value.updating.includes(payload.id)) {
				throw new DevicesException('Property is already being updated.');
			}

			if (!(payload.id in data.value)) {
				throw new DevicesException('Failed to get property data to update.');
			}

			const parsedEditedProperty = ChannelPropertySchema.safeParse({
				...data.value[payload.id],
				...omitBy(parsedPayload.data.data, isUndefined),
			});

			if (!parsedEditedProperty.success) {
				console.error('Schema validation failed with:', parsedEditedProperty.error);

				throw new DevicesValidationException('Failed to edit property.');
			}

			semaphore.value.updating.push(payload.id);

			data.value[parsedEditedProperty.data.id] = parsedEditedProperty.data;

			if (parsedEditedProperty.data.draft) {
				semaphore.value.updating = semaphore.value.updating.filter((item) => item !== parsedEditedProperty.data.id);

				return parsedEditedProperty.data;
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
						data: transformChannelPropertyUpdateRequest(parsedEditedProperty.data),
					},
				});

				semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.id);

				if (typeof responseData !== 'undefined') {
					const property = transformChannelPropertyResponse(responseData.data);

					data.value[property.id] = property;

					return property;
				}

				// Updating record on api failed, we need to refresh record
				await get({ id: payload.id, channelId: payload.channelId });

				let errorReason: string | null = 'Failed to update property.';

				if (error) {
					errorReason = getErrorReason<operations['update-devices-module-channel-property']>(error, errorReason);
				}

				throw new DevicesApiException(errorReason, response.status);
			}
		};

		const save = async (payload: IChannelsPropertiesSaveActionPayload): Promise<IChannelProperty> => {
			if (semaphore.value.updating.includes(payload.id)) {
				throw new DevicesException('Properties is already being saved.');
			}

			if (!(payload.id in data.value)) {
				throw new DevicesException('Failed to get property data to save.');
			}

			const parsedSaveProperty = ChannelPropertySchema.safeParse(data.value[payload.id]);

			if (!parsedSaveProperty.success) {
				console.error('Schema validation failed with:', parsedSaveProperty.error);

				throw new DevicesValidationException('Failed to save property.');
			}

			semaphore.value.updating.push(payload.id);

			const {
				data: responseData,
				error,
				response,
			} = await backend.client.POST(`/${DEVICES_MODULE_PREFIX}/channels/{channelId}/properties`, {
				params: {
					path: { channelId: parsedSaveProperty.data.channel },
				},
				body: {
					data: transformChannelPropertyCreateRequest({ ...parsedSaveProperty.data, ...{ id: payload.id, channel: payload.channelId } }),
				},
			});

			semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.id);

			if (typeof responseData !== 'undefined' && responseData.data.id === payload.id) {
				const property = transformChannelPropertyResponse(responseData.data);

				data.value[property.id] = property;

				return property;
			}

			let errorReason: string | null = 'Failed to create property.';

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

import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { isUndefined, omitBy } from 'lodash';

import { getErrorReason, injectStoresManager, useBackend, useLogger } from '../../../common';
import type { operations } from '../../../openapi';
import { useChannelsPlugins } from '../composables/useChannelsPlugins';
import { useChannelsPropertiesPlugins } from '../composables/useChannelsPropertiesPlugins';
import { DEVICES_MODULE_PREFIX } from '../devices.constants';
import { DevicesApiException, DevicesException, DevicesValidationException } from '../devices.exceptions';

import type { IChannelControlRes } from './channels.controls.store.types';
import { transformChannelControlResponse } from './channels.controls.transformers';
import { ChannelPropertySchema } from './channels.properties.store.schemas';
import type { IChannelPropertyRes } from './channels.properties.store.types';
import { transformChannelPropertyResponse } from './channels.properties.transformers';
import {
	ChannelCreateReqSchema,
	ChannelSchema,
	ChannelUpdateReqSchema,
	ChannelsAddActionPayloadSchema,
	ChannelsEditActionPayloadSchema,
} from './channels.store.schemas';
import type {
	ChannelsStoreSetup,
	IChannel,
	IChannelCreateReq,
	IChannelRes,
	IChannelUpdateReq,
	IChannelsAddActionPayload,
	IChannelsEditActionPayload,
	IChannelsFetchActionPayload,
	IChannelsGetActionPayload,
	IChannelsOnEventActionPayload,
	IChannelsRemoveActionPayload,
	IChannelsSaveActionPayload,
	IChannelsSetActionPayload,
	IChannelsStateSemaphore,
	IChannelsStoreActions,
	IChannelsStoreState,
	IChannelsUnsetActionPayload,
} from './channels.store.types';
import { transformChannelCreateRequest, transformChannelResponse, transformChannelUpdateRequest } from './channels.transformers';
import type { IDevice } from './devices.store.types';
import { channelsControlsStoreKey, channelsPropertiesStoreKey } from './keys';

const defaultSemaphore: IChannelsStateSemaphore = {
	fetching: {
		items: [],
		item: [],
	},
	creating: [],
	updating: [],
	deleting: [],
};

export const useChannels = defineStore<'devices_module-channels', ChannelsStoreSetup>('devices_module-channels', (): ChannelsStoreSetup => {
	const backend = useBackend();
	const logger = useLogger();

	const { getElement: getPluginElement } = useChannelsPlugins();
	const { getElement: getChannelsPropertiesPluginElement } = useChannelsPropertiesPlugins();

	const storesManager = injectStoresManager();

	const semaphore = ref<IChannelsStateSemaphore>(defaultSemaphore);

	const firstLoad = ref<(IDevice['id'] | 'all')[]>([]);

	const data = ref<{ [key: IChannel['id']]: IChannel }>({});

	const firstLoadFinished = (deviceId?: IDevice['id'] | null): boolean =>
		deviceId !== null && typeof deviceId !== 'undefined' ? firstLoad.value.includes(deviceId) : firstLoad.value.includes('all');

	const getting = (id: IChannel['id']): boolean => semaphore.value.fetching.item.includes(id);

	const fetching = (deviceId?: IDevice['id'] | null): boolean =>
		deviceId !== null && typeof deviceId !== 'undefined'
			? semaphore.value.fetching.items.includes(deviceId)
			: semaphore.value.fetching.items.includes('all');

	const findAll = (): IChannel[] => Object.values(data.value);

	const findForDevice = (deviceId: IDevice['id']): IChannel[] =>
		Object.values(data.value ?? {}).filter((channel: IChannel): boolean => channel.device === deviceId);

	const findById = (id: IChannel['id']): IChannel | null => (id in data.value ? data.value[id] : null);

	const pendingGetPromises: Record<string, Promise<IChannel>> = {};

	const pendingFetchPromises: Record<string, Promise<IChannel[]>> = {};

	const onEvent = (payload: IChannelsOnEventActionPayload): IChannel => {
		const element = getPluginElement(payload.type);

		return set({
			id: payload.id,
			data: transformChannelResponse(payload.data as unknown as IChannelRes, element?.schemas?.channelSchema || ChannelSchema),
		});
	};

	const set = (payload: IChannelsSetActionPayload): IChannel => {
		const element = getPluginElement(payload.data.type);

		if (payload.id && data.value && payload.id in data.value) {
			const parsed = (element?.schemas?.channelSchema || ChannelSchema).safeParse({ ...data.value[payload.id], ...payload.data });

			if (!parsed.success) {
				logger.error('Schema validation failed with:', parsed.error);

				throw new DevicesValidationException('Failed to insert channel.');
			}

			return (data.value[parsed.data.id] = parsed.data);
		}

		const parsed = (element?.schemas?.channelSchema || ChannelSchema).safeParse({ ...payload.data, id: payload.id });

		if (!parsed.success) {
			logger.error('Schema validation failed with:', parsed.error);

			throw new DevicesValidationException('Failed to insert channel.');
		}

		data.value = data.value ?? {};

		return (data.value[parsed.data.id] = parsed.data);
	};

	const unset = (payload: IChannelsUnsetActionPayload): void => {
		if (!data.value) {
			return;
		}

		if (payload.deviceId !== undefined) {
			const items = findForDevice(payload.deviceId);

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

		throw new DevicesException('You have to provide at least device or channel id');
	};

	const get = async (payload: IChannelsGetActionPayload): Promise<IChannel> => {
		if (payload.id in pendingGetPromises) {
			return pendingGetPromises[payload.id];
		}

		const getPromise = (async (): Promise<IChannel> => {
			if (semaphore.value.fetching.item.includes(payload.id)) {
				throw new DevicesApiException('Already fetching channel.');
			}

			semaphore.value.fetching.item.push(payload.id);

			try {
				let apiResponse;

				if (payload.deviceId) {
					apiResponse = await backend.client.GET(`/${DEVICES_MODULE_PREFIX}/devices/{deviceId}/channels/{id}`, {
						params: {
							path: { deviceId: payload.deviceId, id: payload.id },
						},
					});
				} else {
					apiResponse = await backend.client.GET(`/${DEVICES_MODULE_PREFIX}/channels/{id}`, {
						params: {
							path: { id: payload.id },
						},
					});
				}

				const { data: responseData, error, response } = apiResponse;

				if (typeof responseData !== 'undefined') {
					const element = getPluginElement(responseData.data.type);

					const transformed = transformChannelResponse(responseData.data, element?.schemas?.channelSchema || ChannelSchema);

					data.value[transformed.id] = transformed;

					insertChannelControlsRelations(transformed, responseData.data.controls);
					insertChannelPropertiesRelations(transformed, responseData.data.properties);

					return transformed;
				}

				let errorReason: string | null = 'Failed to fetch channel.';

				if (error) {
					if (payload.deviceId) {
						errorReason = getErrorReason<operations['get-devices-module-device-channel']>(error, errorReason);
					} else {
						errorReason = getErrorReason<operations['get-devices-module-channel']>(error, errorReason);
					}
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

	const fetch = async (payload?: IChannelsFetchActionPayload): Promise<IChannel[]> => {
		if ((payload && payload.deviceId && payload.deviceId in pendingFetchPromises) || 'all' in pendingFetchPromises) {
			return pendingFetchPromises[payload?.deviceId ?? 'all'];
		}

		const fetchPromise = (async (): Promise<IChannel[]> => {
			if (semaphore.value.fetching.items.includes(payload?.deviceId ?? 'all')) {
				throw new DevicesApiException('Already fetching channels.');
			}

			semaphore.value.fetching.items.push(payload?.deviceId ?? 'all');

			firstLoad.value = firstLoad.value.filter((item) => item !== (payload?.deviceId ?? 'all'));
			firstLoad.value = [...new Set(firstLoad.value)];

			try {
				let apiResponse;

				if (payload?.deviceId) {
					apiResponse = await backend.client.GET(`/${DEVICES_MODULE_PREFIX}/devices/{deviceId}/channels`, {
						params: {
							path: { deviceId: payload.deviceId },
						},
					});
				} else {
					apiResponse = await backend.client.GET(`/${DEVICES_MODULE_PREFIX}/channels`);
				}

				const { data: responseData, error, response } = apiResponse;

				if (typeof responseData !== 'undefined') {
					if (payload?.deviceId) {
						firstLoad.value.push(payload.deviceId);
						firstLoad.value = [...new Set(firstLoad.value)];
					} else {
						firstLoad.value.push('all');
						firstLoad.value = [...new Set(firstLoad.value)];
					}

					const channels = Object.fromEntries(
						responseData.data.map((channel) => {
							const element = getPluginElement(channel.type);

							const transformed = transformChannelResponse(channel, element?.schemas?.channelSchema || ChannelSchema);

							insertChannelControlsRelations(transformed, channel.controls);
							insertChannelPropertiesRelations(transformed, channel.properties);

							return [transformed.id, transformed];
						})
					);

					data.value = { ...data.value, ...channels };

					if (payload?.deviceId) {
						return findForDevice(payload.deviceId);
					}

					return Object.values(data.value);
				}

				let errorReason: string | null = 'Failed to fetch channels.';

				if (error) {
					if (payload?.deviceId) {
						errorReason = getErrorReason<operations['get-devices-module-device-channels']>(error, errorReason);
					} else {
						errorReason = getErrorReason<operations['get-devices-module-channels']>(error, errorReason);
					}
				}

				throw new DevicesApiException(errorReason, response.status);
			} finally {
				semaphore.value.fetching.items = semaphore.value.fetching.items.filter((item) => item !== (payload?.deviceId ?? 'all'));
			}
		})();

		pendingFetchPromises[payload?.deviceId ?? 'all'] = fetchPromise;

		try {
			return await fetchPromise;
		} finally {
			delete pendingFetchPromises[payload?.deviceId ?? 'all'];
		}
	};

	const add = async (payload: IChannelsAddActionPayload): Promise<IChannel> => {
		const parsedPayload = ChannelsAddActionPayloadSchema.safeParse(payload);

		if (!parsedPayload.success) {
			logger.error('Schema validation failed with:', parsedPayload.error);

			throw new DevicesValidationException('Failed to add channel.');
		}

		const element = getPluginElement(payload.data.type);

		const parsedNewItem = (element?.schemas?.channelSchema || ChannelSchema).safeParse({
			...payload.data,
			id: parsedPayload.data.id,
			device: parsedPayload.data.deviceId,
			draft: parsedPayload.data.draft,
			createdAt: new Date(),
		});

		if (!parsedNewItem.success) {
			logger.error('Schema validation failed with:', parsedNewItem.error);

			throw new DevicesValidationException('Failed to add channel.');
		}

		semaphore.value.creating.push(parsedNewItem.data.id);

		data.value[parsedNewItem.data.id] = parsedNewItem.data;

		if (parsedNewItem.data.draft) {
			semaphore.value.creating = semaphore.value.creating.filter((item) => item !== parsedNewItem.data.id);

			return parsedNewItem.data;
		} else {
			try {
				const {
					data: responseData,
					error,
					response,
				} = await backend.client.POST(`/${DEVICES_MODULE_PREFIX}/devices/{deviceId}/channels`, {
					params: {
						path: { deviceId: payload.deviceId },
					},
					body: {
						data: transformChannelCreateRequest<IChannelCreateReq>(
							parsedNewItem.data,
							element?.schemas?.channelCreateReqSchema || ChannelCreateReqSchema
						),
					},
				});

				if (typeof responseData !== 'undefined' && responseData.data.id === payload.id) {
					const element = getPluginElement(responseData.data.type);

					const transformed = transformChannelResponse(responseData.data, element?.schemas?.channelSchema || ChannelSchema);

					data.value[transformed.id] = transformed;

					insertChannelControlsRelations(transformed, responseData.data.controls);
					insertChannelPropertiesRelations(transformed, responseData.data.properties);

					return transformed;
				}

				// Record could not be created on api, we have to remove it from a database
				delete data.value[parsedNewItem.data.id];

				let errorReason: string | null = 'Failed to create channel.';

				if (error) {
					errorReason = getErrorReason<operations['create-devices-module-device-channel']>(error, errorReason);
				}

				throw new DevicesApiException(errorReason, response.status);
			} finally {
				semaphore.value.creating = semaphore.value.creating.filter((item) => item !== parsedNewItem.data.id);
			}
		}
	};

	const edit = async (payload: IChannelsEditActionPayload): Promise<IChannel> => {
		if (semaphore.value.updating.includes(payload.id)) {
			throw new DevicesException('Channel is already being updated.');
		}

		if (!(payload.id in data.value)) {
			throw new DevicesException('Failed to get channel data to update.');
		}

		const parsedPayload = ChannelsEditActionPayloadSchema.safeParse(payload);

		if (!parsedPayload.success) {
			logger.error('Schema validation failed with:', parsedPayload.error);

			throw new DevicesValidationException('Failed to edit channel.');
		}

		const element = getPluginElement(payload.data.type);

		const parsedEditedItem = (element?.schemas?.channelSchema || ChannelSchema).safeParse({
			...data.value[payload.id],
			...omitBy(payload.data, isUndefined),
		});

		if (!parsedEditedItem.success) {
			logger.error('Schema validation failed with:', parsedEditedItem.error);

			throw new DevicesValidationException('Failed to edit channel.');
		}

		semaphore.value.updating.push(payload.id);

		data.value[parsedEditedItem.data.id] = parsedEditedItem.data;

		if (parsedEditedItem.data.draft) {
			semaphore.value.updating = semaphore.value.updating.filter((item) => item !== parsedEditedItem.data.id);

			return parsedEditedItem.data;
		} else {
			try {
				let apiResponse;

				if (payload.deviceId) {
					apiResponse = await backend.client.PATCH(`/${DEVICES_MODULE_PREFIX}/devices/{deviceId}/channels/{id}`, {
						params: {
							path: { deviceId: payload.deviceId, id: payload.id },
						},
						body: {
							data: transformChannelUpdateRequest<IChannelUpdateReq>(
								parsedEditedItem.data,
								element?.schemas?.channelUpdateReqSchema || ChannelUpdateReqSchema
							),
						},
					});
				} else {
					apiResponse = await backend.client.PATCH(`/${DEVICES_MODULE_PREFIX}/channels/{id}`, {
						params: {
							path: { id: payload.id },
						},
						body: {
							data: transformChannelUpdateRequest<IChannelUpdateReq>(
								parsedEditedItem.data,
								element?.schemas?.channelUpdateReqSchema || ChannelUpdateReqSchema
							),
						},
					});
				}

				const { data: responseData, error, response } = apiResponse;

				if (typeof responseData !== 'undefined') {
					const element = getPluginElement(responseData.data.type);

					const transformed = transformChannelResponse(responseData.data, element?.schemas?.channelSchema || ChannelSchema);

					data.value[transformed.id] = transformed;

					return transformed;
				}

				// Updating the record on api failed, we need to refresh the record
				await get({ id: payload.id });

				let errorReason: string | null = 'Failed to update channel.';

				if (error) {
					if (payload.deviceId) {
						errorReason = getErrorReason<operations['update-devices-module-device-channel']>(error, errorReason);
					} else {
						errorReason = getErrorReason<operations['update-devices-module-channel']>(error, errorReason);
					}
				}

				throw new DevicesApiException(errorReason, response.status);
			} finally {
				semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.id);
			}
		}
	};

	const save = async (payload: IChannelsSaveActionPayload): Promise<IChannel> => {
		if (semaphore.value.updating.includes(payload.id)) {
			throw new DevicesException('Channels is already being saved.');
		}

		if (!(payload.id in data.value)) {
			throw new DevicesException('Failed to get channel data to save.');
		}

		const element = getPluginElement(data.value[payload.id].type);

		const parsedSaveItem = (element?.schemas?.channelSchema || ChannelSchema).safeParse(data.value[payload.id]);

		if (!parsedSaveItem.success) {
			logger.error('Schema validation failed with:', parsedSaveItem.error);

			throw new DevicesValidationException('Failed to save channel.');
		}

		semaphore.value.updating.push(payload.id);

		try {
			const {
				data: responseData,
				error,
				response,
			} = await backend.client.POST(`/${DEVICES_MODULE_PREFIX}/devices/{deviceId}/channels`, {
				params: {
					path: { deviceId: parsedSaveItem.data.device },
				},
				body: {
					data: transformChannelCreateRequest<IChannelCreateReq>(
						parsedSaveItem.data,
						element?.schemas?.channelCreateReqSchema || ChannelCreateReqSchema
					),
				},
			});

			if (typeof responseData !== 'undefined' && responseData.data.id === payload.id) {
				const element = getPluginElement(responseData.data.type);

				const transformed = transformChannelResponse(responseData.data, element?.schemas?.channelSchema || ChannelSchema);

				data.value[transformed.id] = transformed;

				insertChannelControlsRelations(transformed, responseData.data.controls);
				insertChannelPropertiesRelations(transformed, responseData.data.properties);

				return transformed;
			}

			let errorReason: string | null = 'Failed to create channel.';

			if (error) {
				errorReason = getErrorReason<operations['create-devices-module-device-channel']>(error, errorReason);
			}

			throw new DevicesApiException(errorReason, response.status);
		} finally {
			semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.id);
		}
	};

	const remove = async (payload: IChannelsRemoveActionPayload): Promise<boolean> => {
		if (semaphore.value.deleting.includes(payload.id)) {
			throw new DevicesException('Channel is already being removed.');
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
			try {
				let apiResponse;

				if (payload.deviceId) {
					apiResponse = await backend.client.DELETE(`/${DEVICES_MODULE_PREFIX}/devices/{deviceId}/channels/{id}`, {
						params: {
							path: { deviceId: payload.deviceId, id: payload.id },
						},
					});
				} else {
					apiResponse = await backend.client.DELETE(`/${DEVICES_MODULE_PREFIX}/channels/{id}`, {
						params: {
							path: { id: payload.id },
						},
					});
				}

				const { error, response } = apiResponse;

				if (response.status === 204) {
					const channelsControlsStore = storesManager.getStore(channelsControlsStoreKey);

					channelsControlsStore.unset({ channelId: payload.id });

					const channelsPropertiesStore = storesManager.getStore(channelsPropertiesStoreKey);

					channelsPropertiesStore.unset({ channelId: payload.id });

					return true;
				}

				// Deleting record on api failed, we need to refresh the record
				await get({ id: payload.id });

				let errorReason: string | null = 'Remove channel failed.';

				if (error) {
					if (payload.deviceId) {
						errorReason = getErrorReason<operations['delete-devices-module-device-channel']>(error, errorReason);
					} else {
						errorReason = getErrorReason<operations['delete-devices-module-channel']>(error, errorReason);
					}
				}

				throw new DevicesApiException(errorReason, response.status);
			} finally {
				semaphore.value.deleting = semaphore.value.deleting.filter((item) => item !== payload.id);
			}
		}

		return true;
	};

	const insertChannelControlsRelations = (channel: IChannel, controls: IChannelControlRes[]): void => {
		const channelsControlsStore = storesManager.getStore(channelsControlsStoreKey);

		controls.forEach((control) => {
			channelsControlsStore.set({
				id: control.id,
				data: transformChannelControlResponse(control),
			});
		});

		channelsControlsStore.firstLoad.push(channel.id);
	};

	const insertChannelPropertiesRelations = (channel: IChannel, properties: IChannelPropertyRes[]): void => {
		const channelsPropertiesStore = storesManager.getStore(channelsPropertiesStoreKey);

		properties.forEach((property) => {
			const element = getChannelsPropertiesPluginElement(property.type);

			channelsPropertiesStore.set({
				id: property.id,
				data: transformChannelPropertyResponse(property, element?.schemas?.channelPropertySchema || ChannelPropertySchema),
			});
		});

		channelsPropertiesStore.firstLoad.push(channel.id);
	};

	return {
		semaphore,
		firstLoad,
		data,
		firstLoadFinished,
		getting,
		fetching,
		findAll,
		findForDevice,
		findById,
		onEvent,
		set,
		unset,
		get,
		fetch,
		add,
		edit,
		save,
		remove,
	};
});

export const registerChannelsStore = (pinia: Pinia): Store<string, IChannelsStoreState, object, IChannelsStoreActions> => {
	return useChannels(pinia);
};

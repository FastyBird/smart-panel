import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { isUndefined, omitBy } from 'lodash';

import { getErrorReason, injectStoresManager, useBackend } from '../../../common';
import type { operations } from '../../../openapi';
import { DEVICES_MODULE_PREFIX } from '../devices.constants';
import { DevicesApiException, DevicesException, DevicesValidationException } from '../devices.exceptions';

import {
	ChannelSchema,
	ChannelsAddActionPayloadSchema,
	ChannelsEditActionPayloadSchema,
	type ChannelsStoreSetup,
	type IChannel,
	type IChannelsAddActionPayload,
	type IChannelsEditActionPayload,
	type IChannelsFetchActionPayload,
	type IChannelsGetActionPayload,
	type IChannelsRemoveActionPayload,
	type IChannelsSaveActionPayload,
	type IChannelsSetActionPayload,
	type IChannelsStateSemaphore,
	type IChannelsStoreActions,
	type IChannelsStoreState,
	type IChannelsUnsetActionPayload,
} from './channels.store.types';
import { transformChannelCreateRequest, transformChannelResponse, transformChannelUpdateRequest } from './channels.transformers';
import type { IDevice } from './devices.store.types';
import {
	type IChannelControlRes,
	type IChannelPropertyRes,
	channelsControlsStoreKey,
	channelsPropertiesStoreKey,
	transformChannelControlResponse,
	transformChannelPropertyResponse,
} from './index';

const defaultSemaphore: IChannelsStateSemaphore = {
	fetching: {
		items: [],
		item: [],
	},
	creating: [],
	updating: [],
	deleting: [],
};

export const useChannels = defineStore<'devices-module_channels', ChannelsStoreSetup>('devices-module_channels', (): ChannelsStoreSetup => {
	const backend = useBackend();

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

	const set = (payload: IChannelsSetActionPayload): IChannel => {
		if (payload.id && data.value && payload.id in data.value) {
			const parsedChannel = ChannelSchema.safeParse({ ...data.value[payload.id], ...payload.data });

			if (!parsedChannel.success) {
				throw new DevicesValidationException('Failed to insert channel.');
			}

			return (data.value[parsedChannel.data.id] = parsedChannel.data);
		}

		const parsedChannel = ChannelSchema.safeParse({ ...payload.data, id: payload.id, device: payload.deviceId });

		if (!parsedChannel.success) {
			throw new DevicesValidationException('Failed to insert channel.');
		}

		data.value = data.value ?? {};

		return (data.value[parsedChannel.data.id] = parsedChannel.data);
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

		const fetchPromise = (async (): Promise<IChannel> => {
			if (semaphore.value.fetching.item.includes(payload.id)) {
				throw new DevicesApiException('Already fetching channel.');
			}

			semaphore.value.fetching.item.push(payload.id);

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

			semaphore.value.fetching.item = semaphore.value.fetching.item.filter((item) => item !== payload.id);

			if (typeof responseData !== 'undefined') {
				const channel = transformChannelResponse(responseData.data);

				data.value[channel.id] = channel;

				insertChannelControlsRelations(channel, responseData.data.controls);
				insertChannelPropertiesRelations(channel, responseData.data.properties);

				return channel;
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
		})();

		pendingGetPromises[payload.id] = fetchPromise;

		try {
			return await fetchPromise;
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

			semaphore.value.fetching.items = semaphore.value.fetching.items.filter((item) => item !== (payload?.deviceId ?? 'all'));

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
						const transformedChannel = transformChannelResponse(channel);

						insertChannelControlsRelations(transformedChannel, channel.controls);
						insertChannelPropertiesRelations(transformedChannel, channel.properties);

						return [transformedChannel.id, transformedChannel];
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
			throw new DevicesValidationException('Failed to add channel.');
		}

		const parsedNewChannel = ChannelSchema.safeParse({
			...parsedPayload.data.data,
			id: parsedPayload.data.id,
			device: parsedPayload.data.deviceId,
			draft: parsedPayload.data.draft,
			createdAt: new Date(),
		});

		if (!parsedNewChannel.success) {
			throw new DevicesValidationException('Failed to add channel.');
		}

		semaphore.value.creating.push(parsedNewChannel.data.id);

		data.value[parsedNewChannel.data.id] = parsedNewChannel.data;

		if (parsedNewChannel.data.draft) {
			semaphore.value.creating = semaphore.value.creating.filter((item) => item !== parsedNewChannel.data.id);

			return parsedNewChannel.data;
		} else {
			const {
				data: responseData,
				error,
				response,
			} = await backend.client.POST(`/${DEVICES_MODULE_PREFIX}/devices/{deviceId}/channels`, {
				params: {
					path: { deviceId: payload.deviceId },
				},
				body: {
					data: transformChannelCreateRequest({ ...parsedNewChannel.data, ...{ id: payload.id, device: payload.deviceId } }),
				},
			});

			semaphore.value.creating = semaphore.value.creating.filter((item) => item !== parsedNewChannel.data.id);

			if (typeof responseData !== 'undefined' && responseData.data.id === payload.id) {
				const channel = transformChannelResponse(responseData.data);

				data.value[channel.id] = channel;

				insertChannelControlsRelations(channel, responseData.data.controls);
				insertChannelPropertiesRelations(channel, responseData.data.properties);

				return channel;
			}

			// Record could not be created on api, we have to remove it from database
			delete data.value[parsedNewChannel.data.id];

			let errorReason: string | null = 'Failed to create channel.';

			if (error) {
				errorReason = getErrorReason<operations['create-devices-module-device-channel']>(error, errorReason);
			}

			throw new DevicesApiException(errorReason, response.status);
		}
	};

	const edit = async (payload: IChannelsEditActionPayload): Promise<IChannel> => {
		const parsedPayload = ChannelsEditActionPayloadSchema.safeParse(payload);

		if (!parsedPayload.success) {
			throw new DevicesValidationException('Failed to edit channel.');
		}

		if (semaphore.value.updating.includes(payload.id)) {
			throw new DevicesException('Channel is already being updated.');
		}

		if (!(payload.id in data.value)) {
			throw new DevicesException('Failed to get channel data to update.');
		}

		const parsedEditedChannel = ChannelSchema.safeParse({
			...data.value[payload.id],
			...omitBy(parsedPayload.data.data, isUndefined),
		});

		if (!parsedEditedChannel.success) {
			throw new DevicesValidationException('Failed to edit channel.');
		}

		semaphore.value.updating.push(payload.id);

		data.value[parsedEditedChannel.data.id] = parsedEditedChannel.data;

		if (parsedEditedChannel.data.draft) {
			semaphore.value.updating = semaphore.value.updating.filter((item) => item !== parsedEditedChannel.data.id);

			return parsedEditedChannel.data;
		} else {
			let apiResponse;

			if (payload.deviceId) {
				apiResponse = await backend.client.PATCH(`/${DEVICES_MODULE_PREFIX}/devices/{deviceId}/channels/{id}`, {
					params: {
						path: { deviceId: payload.deviceId, id: payload.id },
					},
					body: {
						data: transformChannelUpdateRequest(parsedEditedChannel.data),
					},
				});
			} else {
				apiResponse = await backend.client.PATCH(`/${DEVICES_MODULE_PREFIX}/channels/{id}`, {
					params: {
						path: { id: payload.id },
					},
					body: {
						data: transformChannelUpdateRequest(parsedEditedChannel.data),
					},
				});
			}

			const { data: responseData, error, response } = apiResponse;

			semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.id);

			if (typeof responseData !== 'undefined') {
				const channel = transformChannelResponse(responseData.data);

				data.value[channel.id] = channel;

				return channel;
			}

			// Updating record on api failed, we need to refresh record
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
		}
	};

	const save = async (payload: IChannelsSaveActionPayload): Promise<IChannel> => {
		if (semaphore.value.updating.includes(payload.id)) {
			throw new DevicesException('Channels is already being saved.');
		}

		if (!(payload.id in data.value)) {
			throw new DevicesException('Failed to get channel data to save.');
		}

		const parsedSaveChannel = ChannelSchema.safeParse(data.value[payload.id]);

		if (!parsedSaveChannel.success) {
			throw new DevicesValidationException('Failed to save channel.');
		}

		semaphore.value.updating.push(payload.id);

		const {
			data: responseData,
			error,
			response,
		} = await backend.client.POST(`/${DEVICES_MODULE_PREFIX}/devices/{deviceId}/channels`, {
			params: {
				path: { deviceId: parsedSaveChannel.data.device },
			},
			body: {
				data: transformChannelCreateRequest({ ...parsedSaveChannel.data, ...{ id: payload.id, device: payload.deviceId } }),
			},
		});

		semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.id);

		if (typeof responseData !== 'undefined' && responseData.data.id === payload.id) {
			const channel = transformChannelResponse(responseData.data);

			data.value[channel.id] = channel;

			insertChannelControlsRelations(channel, responseData.data.controls);
			insertChannelPropertiesRelations(channel, responseData.data.properties);

			return channel;
		}

		let errorReason: string | null = 'Failed to create channel.';

		if (error) {
			errorReason = getErrorReason<operations['create-devices-module-device-channel']>(error, errorReason);
		}

		throw new DevicesApiException(errorReason, response.status);
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

			semaphore.value.deleting = semaphore.value.deleting.filter((item) => item !== payload.id);

			if (response.status === 204) {
				const channelsControlsStore = storesManager.getStore(channelsControlsStoreKey);

				channelsControlsStore.unset({ channelId: payload.id });

				const channelsPropertiesStore = storesManager.getStore(channelsPropertiesStoreKey);

				channelsPropertiesStore.unset({ channelId: payload.id });

				return true;
			}

			// Deleting record on api failed, we need to refresh record
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
		}

		return true;
	};

	const insertChannelControlsRelations = (channel: IChannel, controls: IChannelControlRes[]): void => {
		const channelsControlsStore = storesManager.getStore(channelsControlsStoreKey);

		controls.forEach((control) => {
			channelsControlsStore.set({
				id: control.id,
				channelId: channel.id,
				data: transformChannelControlResponse(control),
			});
		});

		channelsControlsStore.firstLoad.push(channel.id);
	};

	const insertChannelPropertiesRelations = (channel: IChannel, properties: IChannelPropertyRes[]): void => {
		const channelsPropertiesStore = storesManager.getStore(channelsPropertiesStoreKey);

		properties.forEach((property) => {
			channelsPropertiesStore.set({
				id: property.id,
				channelId: channel.id,
				data: transformChannelPropertyResponse(property),
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

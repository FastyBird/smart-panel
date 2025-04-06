import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { getErrorReason, useBackend } from '../../../common';
import type { operations } from '../../../openapi';
import { DEVICES_MODULE_PREFIX } from '../devices.constants';
import { DevicesApiException, DevicesException, DevicesValidationException } from '../devices.exceptions';

import { ChannelControlSchema, ChannelsControlsAddActionPayloadSchema } from './channels.controls.store.schemas';
import type {
	ChannelsControlsStoreSetup,
	IChannelControl,
	IChannelsControlsAddActionPayload,
	IChannelsControlsFetchActionPayload,
	IChannelsControlsGetActionPayload,
	IChannelsControlsRemoveActionPayload,
	IChannelsControlsSaveActionPayload,
	IChannelsControlsSetActionPayload,
	IChannelsControlsStateSemaphore,
	IChannelsControlsStoreActions,
	IChannelsControlsStoreState,
	IChannelsControlsUnsetActionPayload,
} from './channels.controls.store.types';
import { transformChannelControlCreateRequest, transformChannelControlResponse } from './channels.controls.transformers';
import type { IChannel } from './channels.store.types';

const defaultSemaphore: IChannelsControlsStateSemaphore = {
	fetching: {
		items: [],
		item: [],
	},
	creating: [],
	updating: [],
	deleting: [],
};

export const useChannelsControls = defineStore<'devices_module-channels_controls', ChannelsControlsStoreSetup>(
	'devices_module-channels_controls',
	(): ChannelsControlsStoreSetup => {
		const backend = useBackend();

		const semaphore = ref<IChannelsControlsStateSemaphore>(defaultSemaphore);

		const firstLoad = ref<IChannel['id'][]>([]);

		const data = ref<{ [key: IChannelControl['id']]: IChannelControl }>({});

		const firstLoadFinished = (channelId: IChannel['id']): boolean => firstLoad.value.includes(channelId);

		const getting = (id: IChannelControl['id']): boolean => semaphore.value.fetching.item.includes(id);

		const fetching = (channelId: IChannel['id']): boolean => semaphore.value.fetching.items.includes(channelId);

		const findAll = (): IChannelControl[] => Object.values(data.value);

		const findForChannel = (channelId: IChannel['id']): IChannelControl[] =>
			Object.values(data.value ?? {}).filter((control: IChannelControl): boolean => control.channel === channelId);

		const findById = (id: IChannelControl['id']): IChannelControl | null => (id in data.value ? data.value[id] : null);

		const pendingGetPromises: Record<string, Promise<IChannelControl>> = {};

		const pendingFetchPromises: Record<string, Promise<IChannelControl[]>> = {};

		const set = (payload: IChannelsControlsSetActionPayload): IChannelControl => {
			if (payload.id && data.value && payload.id in data.value) {
				const parsedChannelControl = ChannelControlSchema.safeParse({ ...data.value[payload.id], ...payload.data });

				if (!parsedChannelControl.success) {
					throw new DevicesValidationException('Failed to insert channel control.');
				}

				return (data.value[parsedChannelControl.data.id] = parsedChannelControl.data);
			}

			const parsedChannelControl = ChannelControlSchema.safeParse({ ...payload.data, id: payload.id, channel: payload.channelId });

			if (!parsedChannelControl.success) {
				throw new DevicesValidationException('Failed to insert channel control.');
			}

			data.value = data.value ?? {};

			return (data.value[parsedChannelControl.data.id] = parsedChannelControl.data);
		};

		const unset = (payload: IChannelsControlsUnsetActionPayload): void => {
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

			throw new DevicesException('You have to provide at least channel or control id');
		};

		const get = async (payload: IChannelsControlsGetActionPayload): Promise<IChannelControl> => {
			if (payload.id in pendingGetPromises) {
				return pendingGetPromises[payload.id];
			}

			const fetchPromise = (async (): Promise<IChannelControl> => {
				if (semaphore.value.fetching.item.includes(payload.id)) {
					throw new DevicesApiException('Already fetching channel control.');
				}

				semaphore.value.fetching.item.push(payload.id);

				const {
					data: responseData,
					error,
					response,
				} = await backend.client.GET(`/${DEVICES_MODULE_PREFIX}/channels/{channelId}/controls/{id}`, {
					params: {
						path: { channelId: payload.channelId, id: payload.id },
					},
				});

				semaphore.value.fetching.item = semaphore.value.fetching.item.filter((item) => item !== payload.id);

				if (typeof responseData !== 'undefined') {
					const control = transformChannelControlResponse(responseData.data);

					data.value[control.id] = control;

					return control;
				}

				let errorReason: string | null = 'Failed to fetch channel control.';

				if (error) {
					errorReason = getErrorReason<operations['get-devices-module-channel-control']>(error, errorReason);
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

		const fetch = async (payload: IChannelsControlsFetchActionPayload): Promise<IChannelControl[]> => {
			if (payload.channelId && payload.channelId in pendingFetchPromises) {
				return pendingFetchPromises[payload.channelId];
			}

			const fetchPromise = (async (): Promise<IChannelControl[]> => {
				if (semaphore.value.fetching.items.includes(payload.channelId)) {
					throw new DevicesApiException('Already fetching channel controls.');
				}

				semaphore.value.fetching.items.push(payload.channelId);

				firstLoad.value = firstLoad.value.filter((item) => item !== payload.channelId);
				firstLoad.value = [...new Set(firstLoad.value)];

				const {
					data: responseData,
					error,
					response,
				} = await backend.client.GET(`/${DEVICES_MODULE_PREFIX}/channels/{channelId}/controls`, {
					params: {
						path: { channelId: payload.channelId },
					},
				});

				semaphore.value.fetching.items = semaphore.value.fetching.items.filter((item) => item !== payload.channelId);

				if (typeof responseData !== 'undefined') {
					firstLoad.value.push(payload.channelId);
					firstLoad.value = [...new Set(firstLoad.value)];

					const controls = Object.fromEntries(
						responseData.data.map((control) => {
							const transformedChannelControl = transformChannelControlResponse(control);

							return [transformedChannelControl.id, transformedChannelControl];
						})
					);

					data.value = { ...data.value, ...controls };

					return Object.values(data.value);
				}

				let errorReason: string | null = 'Failed to fetch channel controls.';

				if (error) {
					errorReason = getErrorReason<operations['get-devices-module-channel-controls']>(error, errorReason);
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

		const add = async (payload: IChannelsControlsAddActionPayload): Promise<IChannelControl> => {
			const parsedPayload = ChannelsControlsAddActionPayloadSchema.safeParse(payload);

			if (!parsedPayload.success) {
				throw new DevicesValidationException('Failed to add channel control.');
			}

			const parsedNewChannelControl = ChannelControlSchema.safeParse({
				...parsedPayload.data.data,
				id: parsedPayload.data.id,
				channel: parsedPayload.data.channelId,
				draft: parsedPayload.data.draft,
				createdAt: new Date(),
			});

			if (!parsedNewChannelControl.success) {
				throw new DevicesValidationException('Failed to add channel control.');
			}

			semaphore.value.creating.push(parsedNewChannelControl.data.id);

			data.value[parsedNewChannelControl.data.id] = parsedNewChannelControl.data;

			if (parsedNewChannelControl.data.draft) {
				semaphore.value.creating = semaphore.value.creating.filter((item) => item !== parsedNewChannelControl.data.id);

				return parsedNewChannelControl.data;
			} else {
				const {
					data: responseData,
					error,
					response,
				} = await backend.client.POST(`/${DEVICES_MODULE_PREFIX}/channels/{channelId}/controls`, {
					params: {
						path: { channelId: payload.channelId },
					},
					body: {
						data: transformChannelControlCreateRequest({ ...parsedNewChannelControl.data, ...{ id: payload.id, channel: payload.channelId } }),
					},
				});

				semaphore.value.creating = semaphore.value.creating.filter((item) => item !== parsedNewChannelControl.data.id);

				if (typeof responseData !== 'undefined' && responseData.data.id === payload.id) {
					const control = transformChannelControlResponse(responseData.data);

					data.value[control.id] = control;

					return control;
				}

				// Record could not be created on api, we have to remove it from database
				delete data.value[parsedNewChannelControl.data.id];

				let errorReason: string | null = 'Failed to create channel control.';

				if (error) {
					errorReason = getErrorReason<operations['create-devices-module-channel-control']>(error, errorReason);
				}

				throw new DevicesApiException(errorReason, response.status);
			}
		};

		const save = async (payload: IChannelsControlsSaveActionPayload): Promise<IChannelControl> => {
			if (semaphore.value.updating.includes(payload.id)) {
				throw new DevicesException('ChannelsControls is already being saved.');
			}

			if (!(payload.id in data.value)) {
				throw new DevicesException('Failed to get channel control data to save.');
			}

			const parsedSaveChannelControl = ChannelControlSchema.safeParse(data.value[payload.id]);

			if (!parsedSaveChannelControl.success) {
				throw new DevicesValidationException('Failed to save channel control.');
			}

			semaphore.value.updating.push(payload.id);

			const {
				data: responseData,
				error,
				response,
			} = await backend.client.POST(`/${DEVICES_MODULE_PREFIX}/channels/{channelId}/controls`, {
				params: {
					path: { channelId: parsedSaveChannelControl.data.channel },
				},
				body: {
					data: transformChannelControlCreateRequest({ ...parsedSaveChannelControl.data, ...{ id: payload.id, channel: payload.channelId } }),
				},
			});

			semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.id);

			if (typeof responseData !== 'undefined' && responseData.data.id === payload.id) {
				const control = transformChannelControlResponse(responseData.data);

				data.value[control.id] = control;

				return control;
			}

			let errorReason: string | null = 'Failed to create channel control.';

			if (error) {
				errorReason = getErrorReason<operations['create-devices-module-channel-control']>(error, errorReason);
			}

			throw new DevicesApiException(errorReason, response.status);
		};

		const remove = async (payload: IChannelsControlsRemoveActionPayload): Promise<boolean> => {
			if (semaphore.value.deleting.includes(payload.id)) {
				throw new DevicesException('ChannelControl is already being removed.');
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
				const { error, response } = await backend.client.DELETE(`/${DEVICES_MODULE_PREFIX}/channels/{channelId}/controls/{id}`, {
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

				let errorReason: string | null = 'Remove channel control failed.';

				if (error) {
					errorReason = getErrorReason<operations['delete-devices-module-channel-control']>(error, errorReason);
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
			save,
			remove,
		};
	}
);

export const registerChannelsControlsStore = (pinia: Pinia): Store<string, IChannelsControlsStoreState, object, IChannelsControlsStoreActions> => {
	return useChannelsControls(pinia);
};

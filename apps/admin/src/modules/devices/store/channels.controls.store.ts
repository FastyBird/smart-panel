import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { MODULES_PREFIX } from '../../../app.constants';
import { getErrorReason, useBackend, useLogger } from '../../../common';
import type {
	DevicesModuleCreateChannelControlOperation,
	DevicesModuleDeleteChannelControlOperation,
	DevicesModuleGetChannelControlOperation,
	DevicesModuleGetChannelControlsOperation,
} from '../../../openapi.constants';
import { DEVICES_MODULE_PREFIX } from '../devices.constants';
import { DevicesApiException, DevicesException, DevicesValidationException } from '../devices.exceptions';

import { ChannelControlSchema, ChannelsControlsAddActionPayloadSchema } from './channels.controls.store.schemas';
import type {
	ChannelsControlsStoreSetup,
	IChannelControl,
	IChannelControlRes,
	IChannelsControlsAddActionPayload,
	IChannelsControlsFetchActionPayload,
	IChannelsControlsGetActionPayload,
	IChannelsControlsOnEventActionPayload,
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
		const logger = useLogger();

		const semaphore = ref<IChannelsControlsStateSemaphore>(defaultSemaphore);

		const firstLoad = ref<IChannel['id'][]>([]);

		const data = ref<{ [key: IChannelControl['id']]: IChannelControl }>({});

		const firstLoadFinished = (channelId: IChannel['id']): boolean => firstLoad.value.includes(channelId);

		const getting = (id: IChannelControl['id']): boolean => semaphore.value.fetching.item.includes(id);

		const fetching = (channelId: IChannel['id']): boolean => semaphore.value.fetching.items.includes(channelId);

		const findAll = (): IChannelControl[] => Object.values(data.value);

		const findForChannel = (channelId: IChannel['id']): IChannelControl[] =>
			Object.values(data.value ?? {}).filter((control: IChannelControl): boolean => control.channel === channelId);

		const findById = (id: IChannelControl['id']): IChannelControl | null => data.value[id] ?? null;

		const pendingGetPromises: Record<string, Promise<IChannelControl>> = {};

		const pendingFetchPromises: Record<string, Promise<IChannelControl[]>> = {};

		let mutationToken = 0;
		const mutationTokenById: Record<IChannelControl['id'], number> = {};
		const scopeMutationToken: Record<string, number> = {};
		let requestGeneration = 0;
		const readGenerationById: Record<IChannelControl['id'], number> = {};

		const commit = (item: IChannelControl): IChannelControl => {
			mutationTokenById[item.id] = ++mutationToken;
			return (data.value[item.id] = item);
		};
		const forget = (id: IChannelControl['id']): void => {
			mutationTokenById[id] = ++mutationToken;
			delete data.value[id];
		};
		const unchangedSince = (item: IChannelControl, requestedAt: number): boolean =>
			(mutationTokenById[item.id] ?? 0) <= requestedAt && (scopeMutationToken[item.channel] ?? 0) <= requestedAt;

		const canApplyRead = (item: IChannelControl, requestedAt: number, generation: number): boolean =>
			unchangedSince(item, requestedAt) && (readGenerationById[item.id] ?? 0) <= generation;

		const onEvent = (payload: IChannelsControlsOnEventActionPayload): IChannelControl => {
			return set({
				id: payload.id,
				data: transformChannelControlResponse(payload.data as IChannelControlRes),
			});
		};

		const applySet = (payload: IChannelsControlsSetActionPayload, apply: (item: IChannelControl) => IChannelControl = commit): IChannelControl => {
			if (payload.id && data.value && payload.id in data.value) {
				const parsed = ChannelControlSchema.safeParse({ ...data.value[payload.id], ...payload.data });

				if (!parsed.success) {
					logger.error('Schema validation failed with:', parsed.error);

					throw new DevicesValidationException('Failed to insert channel control.');
				}

				return apply(parsed.data);
			}

			const parsed = ChannelControlSchema.safeParse({ ...payload.data, id: payload.id });

			if (!parsed.success) {
				logger.error('Schema validation failed with:', parsed.error);

				throw new DevicesValidationException('Failed to insert channel control.');
			}

			data.value = data.value ?? {};

			return apply(parsed.data);
		};

		const set = (payload: IChannelsControlsSetActionPayload): IChannelControl => applySet(payload);

		// Parents capture this before their request, so embedded snapshots share the child's fences.
		const captureReadSnapshot: IChannelsControlsStoreActions['captureReadSnapshot'] = () => {
			const requestedAt = mutationToken;
			const generation = ++requestGeneration;
			return (payload: IChannelsControlsSetActionPayload): IChannelControl =>
				applySet(payload, (item: IChannelControl): IChannelControl => {
					if (canApplyRead(item, requestedAt, generation)) {
						readGenerationById[item.id] = generation;
						data.value[item.id] = item;
					}
					return data.value[item.id] ?? item;
				});
		};

		const unset = (payload: IChannelsControlsUnsetActionPayload): void => {
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

			throw new DevicesException('You have to provide at least channel or control id');
		};

		const get = async (payload: IChannelsControlsGetActionPayload): Promise<IChannelControl> => {
			const existingPromise = pendingGetPromises[payload.id];
			if (existingPromise) {
				return existingPromise;
			}

			const applySnapshot = captureReadSnapshot();

			const getPromise = (async (): Promise<IChannelControl> => {
				if (semaphore.value.fetching.item.includes(payload.id)) {
					throw new DevicesApiException('Already fetching channel control.');
				}

				semaphore.value.fetching.item.push(payload.id);

				try {
					const {
						data: responseData,
						error,
						response,
					} = await backend.client.GET(`/${MODULES_PREFIX}/${DEVICES_MODULE_PREFIX}/channels/{channelId}/controls/{id}`, {
						params: {
							path: { channelId: payload.channelId, id: payload.id },
						},
					});

					if (typeof responseData !== 'undefined') {
						const control = transformChannelControlResponse(responseData.data);

						applySnapshot({ id: control.id, data: control });

						return control;
					}

					let errorReason: string | null = 'Failed to fetch channel control.';

					if (error) {
						errorReason = getErrorReason<DevicesModuleGetChannelControlOperation>(error, errorReason);
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

		const fetch = async (payload: IChannelsControlsFetchActionPayload): Promise<IChannelControl[]> => {
			const existingPromise = pendingFetchPromises[payload.channelId];
			if (existingPromise) {
				return existingPromise;
			}

			const applySnapshot = captureReadSnapshot();

			const fetchPromise = (async (): Promise<IChannelControl[]> => {
				if (semaphore.value.fetching.items.includes(payload.channelId)) {
					throw new DevicesApiException('Already fetching channel controls.');
				}

				semaphore.value.fetching.items.push(payload.channelId);

				firstLoad.value = firstLoad.value.filter((item) => item !== payload.channelId);
				firstLoad.value = [...new Set(firstLoad.value)];

				try {
					const {
						data: responseData,
						error,
						response,
					} = await backend.client.GET(`/${MODULES_PREFIX}/${DEVICES_MODULE_PREFIX}/channels/{channelId}/controls`, {
						params: {
							path: { channelId: payload.channelId },
						},
					});

					if (typeof responseData !== 'undefined') {
						firstLoad.value.push(payload.channelId);
						firstLoad.value = [...new Set(firstLoad.value)];

						for (const control of responseData.data) {
							const transformed = transformChannelControlResponse(control);
							applySnapshot({ id: transformed.id, data: transformed });
						}

						return Object.values(data.value);
					}

					let errorReason: string | null = 'Failed to fetch channel controls.';

					if (error) {
						errorReason = getErrorReason<DevicesModuleGetChannelControlsOperation>(error, errorReason);
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

		const add = async (payload: IChannelsControlsAddActionPayload): Promise<IChannelControl> => {
			const parsedPayload = ChannelsControlsAddActionPayloadSchema.safeParse(payload);

			if (!parsedPayload.success) {
				logger.error('Schema validation failed with:', parsedPayload.error);

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
				logger.error('Schema validation failed with:', parsedNewChannelControl.error);

				throw new DevicesValidationException('Failed to add channel control.');
			}

			semaphore.value.creating.push(parsedNewChannelControl.data.id);

			commit(parsedNewChannelControl.data);
			const requestedAt = mutationToken;

			if (parsedNewChannelControl.data.draft) {
				semaphore.value.creating = semaphore.value.creating.filter((item) => item !== parsedNewChannelControl.data.id);

				return parsedNewChannelControl.data;
			} else {
				try {
					const {
						data: responseData,
						error,
						response,
					} = await backend.client.POST(`/${MODULES_PREFIX}/${DEVICES_MODULE_PREFIX}/channels/{channelId}/controls`, {
						params: {
							path: { channelId: payload.channelId },
						},
						body: {
							data: transformChannelControlCreateRequest({ ...parsedNewChannelControl.data, ...{ id: payload.id, channel: payload.channelId } }),
						},
					});

					if (typeof responseData !== 'undefined' && responseData.data.id === payload.id) {
						const control = transformChannelControlResponse(responseData.data);

						if (!unchangedSince(control, requestedAt)) {
							return data.value[control.id] ?? control;
						}

						commit(control);

						return control;
					}

					// Record could not be created on api, we have to remove it from a database
					if (unchangedSince(parsedNewChannelControl.data, requestedAt)) {
						forget(parsedNewChannelControl.data.id);
					}

					let errorReason: string | null = 'Failed to create channel control.';

					if (error) {
						errorReason = getErrorReason<DevicesModuleCreateChannelControlOperation>(error, errorReason);
					}

					throw new DevicesApiException(errorReason, response.status);
				} finally {
					semaphore.value.creating = semaphore.value.creating.filter((item) => item !== parsedNewChannelControl.data.id);
				}
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
				logger.error('Schema validation failed with:', parsedSaveChannelControl.error);

				throw new DevicesValidationException('Failed to save channel control.');
			}

			semaphore.value.updating.push(payload.id);
			const requestedAt = mutationToken;

			try {
				const {
					data: responseData,
					error,
					response,
				} = await backend.client.POST(`/${MODULES_PREFIX}/${DEVICES_MODULE_PREFIX}/channels/{channelId}/controls`, {
					params: {
						path: { channelId: parsedSaveChannelControl.data.channel },
					},
					body: {
						data: transformChannelControlCreateRequest({ ...parsedSaveChannelControl.data, ...{ id: payload.id, channel: payload.channelId } }),
					},
				});

				if (typeof responseData !== 'undefined' && responseData.data.id === payload.id) {
					const control = transformChannelControlResponse(responseData.data);

					if (!unchangedSince(control, requestedAt)) {
						return data.value[control.id] ?? control;
					}

					commit(control);

					return control;
				}

				let errorReason: string | null = 'Failed to create channel control.';

				if (error) {
					errorReason = getErrorReason<DevicesModuleCreateChannelControlOperation>(error, errorReason);
				}

				throw new DevicesApiException(errorReason, response.status);
			} finally {
				semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.id);
			}
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

			forget(payload.id);

			if (recordToRemove?.draft) {
				semaphore.value.deleting = semaphore.value.deleting.filter((item) => item !== payload.id);
			} else {
				try {
					const { error, response } = await backend.client.DELETE(`/${MODULES_PREFIX}/${DEVICES_MODULE_PREFIX}/channels/{channelId}/controls/{id}`, {
						params: {
							path: { channelId: payload.channelId, id: payload.id },
						},
					});

					if (response.status === 204) {
						return true;
					}

					// Deleting record on api failed, we need to refresh the record
					await get({ id: payload.id, channelId: payload.channelId });

					let errorReason: string | null = 'Remove channel control failed.';

					if (error) {
						errorReason = getErrorReason<DevicesModuleDeleteChannelControlOperation>(error, errorReason);
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
			save,
			remove,
		};
	}
);

export const registerChannelsControlsStore = (pinia: Pinia): Store<string, IChannelsControlsStoreState, object, IChannelsControlsStoreActions> => {
	return useChannelsControls(pinia);
};

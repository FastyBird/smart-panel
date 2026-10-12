import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { MODULES_PREFIX } from '../../../app.constants';
import { getErrorReason, useBackend, useLogger } from '../../../common';
import type {
	DevicesModuleCreateDeviceControlOperation,
	DevicesModuleDeleteDeviceControlOperation,
	DevicesModuleGetDeviceControlOperation,
	DevicesModuleGetDeviceControlsOperation,
} from '../../../openapi.constants';
import { DEVICES_MODULE_PREFIX } from '../devices.constants';
import { DevicesApiException, DevicesException, DevicesValidationException } from '../devices.exceptions';

import { DeviceControlSchema, DevicesControlsAddActionPayloadSchema } from './devices.controls.store.schemas';
import type {
	DevicesControlsStoreSetup,
	IDeviceControl,
	IDeviceControlRes,
	IDevicesControlsAddActionPayload,
	IDevicesControlsFetchActionPayload,
	IDevicesControlsGetActionPayload,
	IDevicesControlsOnEventActionPayload,
	IDevicesControlsRemoveActionPayload,
	IDevicesControlsSaveActionPayload,
	IDevicesControlsSetActionPayload,
	IDevicesControlsStateSemaphore,
	IDevicesControlsStoreActions,
	IDevicesControlsStoreState,
	IDevicesControlsUnsetActionPayload,
} from './devices.controls.store.types';
import { transformDeviceControlCreateRequest, transformDeviceControlResponse } from './devices.controls.transformers';
import type { IDevice } from './devices.store.types';

const defaultSemaphore: IDevicesControlsStateSemaphore = {
	fetching: {
		items: [],
		item: [],
	},
	creating: [],
	updating: [],
	deleting: [],
};

export const useDevicesControls = defineStore<'devices_module-devices_controls', DevicesControlsStoreSetup>(
	'devices_module-devices_controls',
	(): DevicesControlsStoreSetup => {
		const backend = useBackend();
		const logger = useLogger();

		const semaphore = ref<IDevicesControlsStateSemaphore>(defaultSemaphore);

		const firstLoad = ref<IDevice['id'][]>([]);

		const data = ref<{ [key: IDeviceControl['id']]: IDeviceControl }>({});

		const firstLoadFinished = (deviceId: IDevice['id']): boolean => firstLoad.value.includes(deviceId);

		const getting = (id: IDeviceControl['id']): boolean => semaphore.value.fetching.item.includes(id);

		const fetching = (deviceId: IDevice['id']): boolean => semaphore.value.fetching.items.includes(deviceId);

		const findAll = (): IDeviceControl[] => Object.values(data.value);

		const findForDevice = (deviceId: IDevice['id']): IDeviceControl[] =>
			Object.values(data.value ?? {}).filter((control: IDeviceControl): boolean => control.device === deviceId);

		const findById = (id: IDeviceControl['id']): IDeviceControl | null => data.value[id] ?? null;

		const pendingGetPromises: Record<string, Promise<IDeviceControl>> = {};

		const pendingFetchPromises: Record<string, Promise<IDeviceControl[]>> = {};

		let mutationToken = 0;
		const mutationTokenById: Record<IDeviceControl['id'], number> = {};
		const scopeMutationToken: Record<string, number> = {};
		let requestGeneration = 0;
		const readGenerationById: Record<IDeviceControl['id'], number> = {};

		const commit = (item: IDeviceControl): IDeviceControl => {
			mutationTokenById[item.id] = ++mutationToken;
			return (data.value[item.id] = item);
		};
		const forget = (id: IDeviceControl['id']): void => {
			mutationTokenById[id] = ++mutationToken;
			delete data.value[id];
		};
		const unchangedSince = (item: IDeviceControl, requestedAt: number): boolean =>
			(mutationTokenById[item.id] ?? 0) <= requestedAt && (scopeMutationToken[item.device] ?? 0) <= requestedAt;

		const canApplyRead = (item: IDeviceControl, requestedAt: number, generation: number): boolean =>
			unchangedSince(item, requestedAt) && (readGenerationById[item.id] ?? 0) <= generation;

		const onEvent = (payload: IDevicesControlsOnEventActionPayload): IDeviceControl => {
			return set({
				id: payload.id,
				data: transformDeviceControlResponse(payload.data as IDeviceControlRes),
			});
		};

		const applySet = (payload: IDevicesControlsSetActionPayload, apply: (item: IDeviceControl) => IDeviceControl = commit): IDeviceControl => {
			if (payload.id && data.value && payload.id in data.value) {
				const parsed = DeviceControlSchema.safeParse({ ...data.value[payload.id], ...payload.data });

				if (!parsed.success) {
					logger.error('Schema validation failed with:', parsed.error);

					throw new DevicesValidationException('Failed to insert device control.');
				}

				return apply(parsed.data);
			}

			const parsed = DeviceControlSchema.safeParse({ ...payload.data, id: payload.id });

			if (!parsed.success) {
				logger.error('Schema validation failed with:', parsed.error);

				throw new DevicesValidationException('Failed to insert device control.');
			}

			data.value = data.value ?? {};

			return apply(parsed.data);
		};

		const set = (payload: IDevicesControlsSetActionPayload): IDeviceControl => applySet(payload);

		// Parents capture this before their request, so embedded snapshots share the child's fences.
		const captureReadSnapshot: IDevicesControlsStoreActions['captureReadSnapshot'] = () => {
			const requestedAt = mutationToken;
			const generation = ++requestGeneration;
			return (payload: IDevicesControlsSetActionPayload): IDeviceControl =>
				applySet(payload, (item: IDeviceControl): IDeviceControl => {
					if (canApplyRead(item, requestedAt, generation)) {
						readGenerationById[item.id] = generation;
						data.value[item.id] = item;
					}
					return data.value[item.id] ?? item;
				});
		};

		const unset = (payload: IDevicesControlsUnsetActionPayload): void => {
			if (!data.value) {
				return;
			}

			if (payload.deviceId !== undefined) {
				scopeMutationToken[payload.deviceId] = ++mutationToken;
				const items = findForDevice(payload.deviceId);

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

			throw new DevicesException('You have to provide at least device or control id');
		};

		const get = async (payload: IDevicesControlsGetActionPayload): Promise<IDeviceControl> => {
			const existingPromise = pendingGetPromises[payload.id];
			if (existingPromise) {
				return existingPromise;
			}

			const applySnapshot = captureReadSnapshot();

			const getPromise = (async (): Promise<IDeviceControl> => {
				if (semaphore.value.fetching.item.includes(payload.id)) {
					throw new DevicesApiException('Already fetching device control.');
				}

				semaphore.value.fetching.item.push(payload.id);

				try {
					const {
						data: responseData,
						error,
						response,
					} = await backend.client.GET(`/${MODULES_PREFIX}/${DEVICES_MODULE_PREFIX}/devices/{deviceId}/controls/{id}`, {
						params: {
							path: { deviceId: payload.deviceId, id: payload.id },
						},
					});

					if (typeof responseData !== 'undefined') {
						const control = transformDeviceControlResponse(responseData.data);

						applySnapshot({ id: control.id, data: control });

						return control;
					}

					let errorReason: string | null = 'Failed to fetch device control.';

					if (error) {
						errorReason = getErrorReason<DevicesModuleGetDeviceControlOperation>(error, errorReason);
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

		const fetch = async (payload: IDevicesControlsFetchActionPayload): Promise<IDeviceControl[]> => {
			const existingPromise = pendingFetchPromises[payload.deviceId];
			if (existingPromise) {
				return existingPromise;
			}

			const applySnapshot = captureReadSnapshot();

			const fetchPromise = (async (): Promise<IDeviceControl[]> => {
				if (semaphore.value.fetching.items.includes(payload.deviceId)) {
					throw new DevicesApiException('Already fetching device controls.');
				}

				semaphore.value.fetching.items.push(payload.deviceId);

				firstLoad.value = firstLoad.value.filter((item) => item !== payload.deviceId);
				firstLoad.value = [...new Set(firstLoad.value)];

				try {
					const {
						data: responseData,
						error,
						response,
					} = await backend.client.GET(`/${MODULES_PREFIX}/${DEVICES_MODULE_PREFIX}/devices/{deviceId}/controls`, {
						params: {
							path: { deviceId: payload.deviceId },
						},
					});

					if (typeof responseData !== 'undefined') {
						firstLoad.value.push(payload.deviceId);
						firstLoad.value = [...new Set(firstLoad.value)];

						for (const control of responseData.data) {
							const transformed = transformDeviceControlResponse(control);
							applySnapshot({ id: transformed.id, data: transformed });
						}

						return Object.values(data.value);
					}

					let errorReason: string | null = 'Failed to fetch device controls.';

					if (error) {
						errorReason = getErrorReason<DevicesModuleGetDeviceControlsOperation>(error, errorReason);
					}

					throw new DevicesApiException(errorReason, response.status);
				} finally {
					semaphore.value.fetching.items = semaphore.value.fetching.items.filter((item) => item !== payload.deviceId);
				}
			})();

			pendingFetchPromises[payload.deviceId] = fetchPromise;

			try {
				return await fetchPromise;
			} finally {
				delete pendingFetchPromises[payload.deviceId];
			}
		};

		const add = async (payload: IDevicesControlsAddActionPayload): Promise<IDeviceControl> => {
			const parsedPayload = DevicesControlsAddActionPayloadSchema.safeParse(payload);

			if (!parsedPayload.success) {
				logger.error('Schema validation failed with:', parsedPayload.error);

				throw new DevicesValidationException('Failed to add device control.');
			}

			const parsedNewDeviceControl = DeviceControlSchema.safeParse({
				...parsedPayload.data.data,
				id: parsedPayload.data.id,
				device: parsedPayload.data.deviceId,
				draft: parsedPayload.data.draft,
				createdAt: new Date(),
			});

			if (!parsedNewDeviceControl.success) {
				logger.error('Schema validation failed with:', parsedNewDeviceControl.error);

				throw new DevicesValidationException('Failed to add device control.');
			}

			semaphore.value.creating.push(parsedNewDeviceControl.data.id);

			commit(parsedNewDeviceControl.data);
			const requestedAt = mutationToken;

			if (parsedNewDeviceControl.data.draft) {
				semaphore.value.creating = semaphore.value.creating.filter((item) => item !== parsedNewDeviceControl.data.id);

				return parsedNewDeviceControl.data;
			} else {
				try {
					const {
						data: responseData,
						error,
						response,
					} = await backend.client.POST(`/${MODULES_PREFIX}/${DEVICES_MODULE_PREFIX}/devices/{deviceId}/controls`, {
						params: {
							path: { deviceId: payload.deviceId },
						},
						body: {
							data: transformDeviceControlCreateRequest({ ...parsedNewDeviceControl.data, ...{ id: payload.id, device: payload.deviceId } }),
						},
					});

					if (typeof responseData !== 'undefined' && responseData.data.id === payload.id) {
						const control = transformDeviceControlResponse(responseData.data);

						if (!unchangedSince(control, requestedAt)) {
							return data.value[control.id] ?? control;
						}

						commit(control);

						return control;
					}

					// Record could not be created on api, we have to remove it from a database
					if (unchangedSince(parsedNewDeviceControl.data, requestedAt)) {
						forget(parsedNewDeviceControl.data.id);
					}

					let errorReason: string | null = 'Failed to create device control.';

					if (error) {
						errorReason = getErrorReason<DevicesModuleCreateDeviceControlOperation>(error, errorReason);
					}

					throw new DevicesApiException(errorReason, response.status);
				} finally {
					semaphore.value.creating = semaphore.value.creating.filter((item) => item !== parsedNewDeviceControl.data.id);
				}
			}
		};

		const save = async (payload: IDevicesControlsSaveActionPayload): Promise<IDeviceControl> => {
			if (semaphore.value.updating.includes(payload.id)) {
				throw new DevicesException('DevicesControls is already being saved.');
			}

			if (!(payload.id in data.value)) {
				throw new DevicesException('Failed to get device control data to save.');
			}

			const parsedSaveDeviceControl = DeviceControlSchema.safeParse(data.value[payload.id]);

			if (!parsedSaveDeviceControl.success) {
				logger.error('Schema validation failed with:', parsedSaveDeviceControl.error);

				throw new DevicesValidationException('Failed to save device control.');
			}

			semaphore.value.updating.push(payload.id);
			const requestedAt = mutationToken;

			try {
				const {
					data: responseData,
					error,
					response,
				} = await backend.client.POST(`/${MODULES_PREFIX}/${DEVICES_MODULE_PREFIX}/devices/{deviceId}/controls`, {
					params: {
						path: { deviceId: parsedSaveDeviceControl.data.device },
					},
					body: {
						data: transformDeviceControlCreateRequest({ ...parsedSaveDeviceControl.data, ...{ id: payload.id, device: payload.deviceId } }),
					},
				});

				if (typeof responseData !== 'undefined' && responseData.data.id === payload.id) {
					const control = transformDeviceControlResponse(responseData.data);

					if (!unchangedSince(control, requestedAt)) {
						return data.value[control.id] ?? control;
					}

					commit(control);

					return control;
				}

				let errorReason: string | null = 'Failed to create device control.';

				if (error) {
					errorReason = getErrorReason<DevicesModuleCreateDeviceControlOperation>(error, errorReason);
				}

				throw new DevicesApiException(errorReason, response.status);
			} finally {
				semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.id);
			}
		};

		const remove = async (payload: IDevicesControlsRemoveActionPayload): Promise<boolean> => {
			if (semaphore.value.deleting.includes(payload.id)) {
				throw new DevicesException('DeviceControl is already being removed.');
			}

			if (!Object.keys(data.value).includes(payload.id)) {
				forget(payload.id);
				return true;
			}

			semaphore.value.deleting.push(payload.id);

			const recordToRemove = data.value[payload.id];

			forget(payload.id);
			const requestedAt = mutationToken;

			if (recordToRemove?.draft) {
				semaphore.value.deleting = semaphore.value.deleting.filter((item) => item !== payload.id);
			} else {
				try {
					const { error, response } = await backend.client.DELETE(`/${MODULES_PREFIX}/${DEVICES_MODULE_PREFIX}/devices/{deviceId}/controls/{id}`, {
						params: {
							path: { deviceId: payload.deviceId, id: payload.id },
						},
					});

					if (response.status === 204) {
						return true;
					}

					// Deleting record on api failed, we need to refresh the record
					if (unchangedSince(recordToRemove, requestedAt)) {
						await pendingGetPromises[payload.id]?.catch(() => undefined);
						if (unchangedSince(recordToRemove, requestedAt)) {
							await get({ id: payload.id, deviceId: payload.deviceId });
						}
					}

					let errorReason: string | null = 'Remove device control failed.';

					if (error) {
						errorReason = getErrorReason<DevicesModuleDeleteDeviceControlOperation>(error, errorReason);
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
			findForDevice,
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

export const registerDevicesControlsStore = (pinia: Pinia): Store<string, IDevicesControlsStoreState, object, IDevicesControlsStoreActions> => {
	return useDevicesControls(pinia);
};

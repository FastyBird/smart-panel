import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { getErrorReason, useBackend } from '../../../common';
import type { operations } from '../../../openapi';
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

		const semaphore = ref<IDevicesControlsStateSemaphore>(defaultSemaphore);

		const firstLoad = ref<IDevice['id'][]>([]);

		const data = ref<{ [key: IDeviceControl['id']]: IDeviceControl }>({});

		const firstLoadFinished = (deviceId: IDevice['id']): boolean => firstLoad.value.includes(deviceId);

		const getting = (id: IDeviceControl['id']): boolean => semaphore.value.fetching.item.includes(id);

		const fetching = (deviceId: IDevice['id']): boolean => semaphore.value.fetching.items.includes(deviceId);

		const findAll = (): IDeviceControl[] => Object.values(data.value);

		const findForDevice = (deviceId: IDevice['id']): IDeviceControl[] =>
			Object.values(data.value ?? {}).filter((control: IDeviceControl): boolean => control.device === deviceId);

		const findById = (id: IDeviceControl['id']): IDeviceControl | null => (id in data.value ? data.value[id] : null);

		const pendingGetPromises: Record<string, Promise<IDeviceControl>> = {};

		const pendingFetchPromises: Record<string, Promise<IDeviceControl[]>> = {};

		const onEvent = (payload: IDevicesControlsOnEventActionPayload): IDeviceControl => {
			return set({
				id: payload.id,
				data: transformDeviceControlResponse(payload.data as unknown as IDeviceControlRes),
			});
		};

		const set = (payload: IDevicesControlsSetActionPayload): IDeviceControl => {
			if (payload.id && data.value && payload.id in data.value) {
				const parsed = DeviceControlSchema.safeParse({ ...data.value[payload.id], ...payload.data });

				if (!parsed.success) {
					console.error('Schema validation failed with:', parsed.error);

					throw new DevicesValidationException('Failed to insert device control.');
				}

				return (data.value[parsed.data.id] = parsed.data);
			}

			const parsed = DeviceControlSchema.safeParse({ ...payload.data, id: payload.id });

			if (!parsed.success) {
				console.error('Schema validation failed with:', parsed.error);

				throw new DevicesValidationException('Failed to insert device control.');
			}

			data.value = data.value ?? {};

			return (data.value[parsed.data.id] = parsed.data);
		};

		const unset = (payload: IDevicesControlsUnsetActionPayload): void => {
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

			throw new DevicesException('You have to provide at least device or control id');
		};

		const get = async (payload: IDevicesControlsGetActionPayload): Promise<IDeviceControl> => {
			if (payload.id in pendingGetPromises) {
				return pendingGetPromises[payload.id];
			}

			const getPromise = (async (): Promise<IDeviceControl> => {
				if (semaphore.value.fetching.item.includes(payload.id)) {
					throw new DevicesApiException('Already fetching device control.');
				}

				semaphore.value.fetching.item.push(payload.id);

				const {
					data: responseData,
					error,
					response,
				} = await backend.client.GET(`/${DEVICES_MODULE_PREFIX}/devices/{deviceId}/controls/{id}`, {
					params: {
						path: { deviceId: payload.deviceId, id: payload.id },
					},
				});

				semaphore.value.fetching.item = semaphore.value.fetching.item.filter((item) => item !== payload.id);

				if (typeof responseData !== 'undefined') {
					const control = transformDeviceControlResponse(responseData.data);

					data.value[control.id] = control;

					return control;
				}

				let errorReason: string | null = 'Failed to fetch device control.';

				if (error) {
					errorReason = getErrorReason<operations['get-devices-module-device-control']>(error, errorReason);
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

		const fetch = async (payload: IDevicesControlsFetchActionPayload): Promise<IDeviceControl[]> => {
			if (payload.deviceId && payload.deviceId in pendingFetchPromises) {
				return pendingFetchPromises[payload.deviceId];
			}

			const fetchPromise = (async (): Promise<IDeviceControl[]> => {
				if (semaphore.value.fetching.items.includes(payload.deviceId)) {
					throw new DevicesApiException('Already fetching device controls.');
				}

				semaphore.value.fetching.items.push(payload.deviceId);

				firstLoad.value = firstLoad.value.filter((item) => item !== payload.deviceId);
				firstLoad.value = [...new Set(firstLoad.value)];

				const {
					data: responseData,
					error,
					response,
				} = await backend.client.GET(`/${DEVICES_MODULE_PREFIX}/devices/{deviceId}/controls`, {
					params: {
						path: { deviceId: payload.deviceId },
					},
				});

				semaphore.value.fetching.items = semaphore.value.fetching.items.filter((item) => item !== payload.deviceId);

				if (typeof responseData !== 'undefined') {
					firstLoad.value.push(payload.deviceId);
					firstLoad.value = [...new Set(firstLoad.value)];

					const controls = Object.fromEntries(
						responseData.data.map((control) => {
							const transformedDeviceControl = transformDeviceControlResponse(control);

							return [transformedDeviceControl.id, transformedDeviceControl];
						})
					);

					data.value = { ...data.value, ...controls };

					return Object.values(data.value);
				}

				let errorReason: string | null = 'Failed to fetch device controls.';

				if (error) {
					errorReason = getErrorReason<operations['get-devices-module-device-controls']>(error, errorReason);
				}

				throw new DevicesApiException(errorReason, response.status);
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
				console.error('Schema validation failed with:', parsedPayload.error);

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
				console.error('Schema validation failed with:', parsedNewDeviceControl.error);

				throw new DevicesValidationException('Failed to add device control.');
			}

			semaphore.value.creating.push(parsedNewDeviceControl.data.id);

			data.value[parsedNewDeviceControl.data.id] = parsedNewDeviceControl.data;

			if (parsedNewDeviceControl.data.draft) {
				semaphore.value.creating = semaphore.value.creating.filter((item) => item !== parsedNewDeviceControl.data.id);

				return parsedNewDeviceControl.data;
			} else {
				const {
					data: responseData,
					error,
					response,
				} = await backend.client.POST(`/${DEVICES_MODULE_PREFIX}/devices/{deviceId}/controls`, {
					params: {
						path: { deviceId: payload.deviceId },
					},
					body: {
						data: transformDeviceControlCreateRequest({ ...parsedNewDeviceControl.data, ...{ id: payload.id, device: payload.deviceId } }),
					},
				});

				semaphore.value.creating = semaphore.value.creating.filter((item) => item !== parsedNewDeviceControl.data.id);

				if (typeof responseData !== 'undefined' && responseData.data.id === payload.id) {
					const control = transformDeviceControlResponse(responseData.data);

					data.value[control.id] = control;

					return control;
				}

				// Record could not be created on api, we have to remove it from a database
				delete data.value[parsedNewDeviceControl.data.id];

				let errorReason: string | null = 'Failed to create device control.';

				if (error) {
					errorReason = getErrorReason<operations['create-devices-module-device-control']>(error, errorReason);
				}

				throw new DevicesApiException(errorReason, response.status);
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
				console.error('Schema validation failed with:', parsedSaveDeviceControl.error);

				throw new DevicesValidationException('Failed to save device control.');
			}

			semaphore.value.updating.push(payload.id);

			const {
				data: responseData,
				error,
				response,
			} = await backend.client.POST(`/${DEVICES_MODULE_PREFIX}/devices/{deviceId}/controls`, {
				params: {
					path: { deviceId: parsedSaveDeviceControl.data.device },
				},
				body: {
					data: transformDeviceControlCreateRequest({ ...parsedSaveDeviceControl.data, ...{ id: payload.id, device: payload.deviceId } }),
				},
			});

			semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.id);

			if (typeof responseData !== 'undefined' && responseData.data.id === payload.id) {
				const control = transformDeviceControlResponse(responseData.data);

				data.value[control.id] = control;

				return control;
			}

			let errorReason: string | null = 'Failed to create device control.';

			if (error) {
				errorReason = getErrorReason<operations['create-devices-module-device-control']>(error, errorReason);
			}

			throw new DevicesApiException(errorReason, response.status);
		};

		const remove = async (payload: IDevicesControlsRemoveActionPayload): Promise<boolean> => {
			if (semaphore.value.deleting.includes(payload.id)) {
				throw new DevicesException('DeviceControl is already being removed.');
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
				const { error, response } = await backend.client.DELETE(`/${DEVICES_MODULE_PREFIX}/devices/{deviceId}/controls/{id}`, {
					params: {
						path: { deviceId: payload.deviceId, id: payload.id },
					},
				});

				semaphore.value.deleting = semaphore.value.deleting.filter((item) => item !== payload.id);

				if (response.status === 204) {
					return true;
				}

				// Deleting record on api failed, we need to refresh the record
				await get({ id: payload.id, deviceId: payload.deviceId });

				let errorReason: string | null = 'Remove device control failed.';

				if (error) {
					errorReason = getErrorReason<operations['delete-devices-module-device-control']>(error, errorReason);
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
			findForDevice,
			findById,
			onEvent,
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

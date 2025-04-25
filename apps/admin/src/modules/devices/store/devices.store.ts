import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { isUndefined, omitBy } from 'lodash';

import { getErrorReason, injectStoresManager, useBackend } from '../../../common';
import type { operations } from '../../../openapi';
import { usePlugins } from '../composables/composables';
import { DEVICES_MODULE_PREFIX } from '../devices.constants';
import { DevicesApiException, DevicesException, DevicesValidationException } from '../devices.exceptions';

import { transformChannelControlResponse } from './channels.controls.transformers';
import { transformChannelPropertyResponse } from './channels.properties.transformers';
import type { IChannelRes } from './channels.store.types';
import { transformChannelResponse } from './channels.transformers';
import type { IDeviceControlRes } from './devices.controls.store.types';
import { transformDeviceControlResponse } from './devices.controls.transformers';
import {
	DeviceCreateReqSchema,
	DeviceSchema,
	DeviceUpdateReqSchema,
	DevicesAddActionPayloadSchema,
	DevicesEditActionPayloadSchema,
} from './devices.store.schemas';
import type {
	DevicesStoreSetup,
	IDevice,
	IDevicesAddActionPayload,
	IDevicesEditActionPayload,
	IDevicesGetActionPayload,
	IDevicesRemoveActionPayload,
	IDevicesSaveActionPayload,
	IDevicesSetActionPayload,
	IDevicesStateSemaphore,
	IDevicesStoreActions,
	IDevicesStoreState,
	IDevicesUnsetActionPayload,
} from './devices.store.types';
import { transformDeviceCreateRequest, transformDeviceResponse, transformDeviceUpdateRequest } from './devices.transformers';
import { channelsControlsStoreKey, channelsPropertiesStoreKey, channelsStoreKey, devicesControlsStoreKey } from './keys';

const defaultSemaphore: IDevicesStateSemaphore = {
	fetching: {
		items: false,
		item: [],
	},
	creating: [],
	updating: [],
	deleting: [],
};

export const useDevices = defineStore<'devices_module-devices', DevicesStoreSetup>('devices_module-devices', (): DevicesStoreSetup => {
	const backend = useBackend();

	const { getByType: getPluginByType } = usePlugins();

	const storesManager = injectStoresManager();

	const semaphore = ref<IDevicesStateSemaphore>(defaultSemaphore);

	const firstLoad = ref<boolean>(false);

	const data = ref<{ [key: IDevice['id']]: IDevice }>({});

	const firstLoadFinished = (): boolean => firstLoad.value;

	const getting = (id: IDevice['id']): boolean => semaphore.value.fetching.item.includes(id);

	const fetching = (): boolean => semaphore.value.fetching.items;

	const findAll = (): IDevice[] => Object.values(data.value);

	const findById = (id: IDevice['id']): IDevice | null => (id in data.value ? data.value[id] : null);

	const pendingGetPromises: Record<string, Promise<IDevice>> = {};

	const pendingFetchPromises: Record<string, Promise<IDevice[]>> = {};

	const set = (payload: IDevicesSetActionPayload): IDevice => {
		const plugin = getPluginByType(payload.data.type);

		const pluginSchema = plugin?.schemas?.deviceSchema;

		if (payload.id && data.value && payload.id in data.value) {
			const merged = { ...data.value[payload.id], ...payload.data };

			const parsedDevice = pluginSchema ? pluginSchema.safeParse(merged) : DeviceSchema.safeParse(merged);

			if (!parsedDevice.success) {
				console.error('Schema validation failed with:', parsedDevice.error);

				throw new DevicesValidationException('Failed to insert device.');
			}

			return (data.value[parsedDevice.data.id] = parsedDevice.data);
		}

		const merged = { ...payload.data, id: payload.id };

		const parsedDevice = pluginSchema ? pluginSchema.safeParse(merged) : DeviceSchema.safeParse(merged);

		if (!parsedDevice.success) {
			console.error('Schema validation failed with:', parsedDevice.error);

			throw new DevicesValidationException('Failed to insert device.');
		}

		data.value = data.value ?? {};

		return (data.value[parsedDevice.data.id] = parsedDevice.data);
	};

	const unset = (payload: IDevicesUnsetActionPayload): void => {
		if (!data.value) {
			return;
		}

		delete data.value[payload.id];

		return;
	};

	const get = async (payload: IDevicesGetActionPayload): Promise<IDevice> => {
		if (payload.id in pendingGetPromises) {
			return pendingGetPromises[payload.id];
		}

		const fetchPromise = (async (): Promise<IDevice> => {
			if (semaphore.value.fetching.item.includes(payload.id)) {
				throw new DevicesApiException('Already fetching device.');
			}

			semaphore.value.fetching.item.push(payload.id);

			const {
				data: responseData,
				error,
				response,
			} = await backend.client.GET(`/${DEVICES_MODULE_PREFIX}/devices/{id}`, {
				params: {
					path: { id: payload.id },
				},
			});

			semaphore.value.fetching.item = semaphore.value.fetching.item.filter((item) => item !== payload.id);

			if (typeof responseData !== 'undefined') {
				const plugin = getPluginByType(responseData.data.type);

				const device = transformDeviceResponse(responseData.data, plugin?.schemas?.deviceSchema || DeviceSchema);

				data.value[device.id] = device;

				insertDeviceControlsRelations(device, responseData.data.controls);
				insertChannelsRelations(device, responseData.data.channels);

				return device;
			}

			let errorReason: string | null = 'Failed to fetch device.';

			if (error) {
				errorReason = getErrorReason<operations['get-devices-module-device']>(error, errorReason);
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

	const fetch = async (): Promise<IDevice[]> => {
		if ('all' in pendingFetchPromises) {
			return pendingFetchPromises['all'];
		}

		const fetchPromise = (async (): Promise<IDevice[]> => {
			if (semaphore.value.fetching.items) {
				throw new DevicesApiException('Already fetching devices.');
			}

			semaphore.value.fetching.items = true;

			const { data: responseData, error, response } = await backend.client.GET(`/${DEVICES_MODULE_PREFIX}/devices`);

			semaphore.value.fetching.items = false;

			if (typeof responseData !== 'undefined') {
				data.value = Object.fromEntries(
					responseData.data.map((device) => {
						const plugin = getPluginByType(device.type);

						const transformedDevice = transformDeviceResponse(device, plugin?.schemas?.deviceSchema || DeviceSchema);

						insertDeviceControlsRelations(transformedDevice, device.controls);
						insertChannelsRelations(transformedDevice, device.channels);

						return [transformedDevice.id, transformedDevice];
					})
				);

				firstLoad.value = true;

				return Object.values(data.value);
			}

			let errorReason: string | null = 'Failed to fetch devices.';

			if (error) {
				errorReason = getErrorReason<operations['get-devices-module-devices']>(error, errorReason);
			}

			throw new DevicesApiException(errorReason, response.status);
		})();

		pendingFetchPromises['all'] = fetchPromise;

		try {
			return await fetchPromise;
		} finally {
			delete pendingFetchPromises['all'];
		}
	};

	const add = async (payload: IDevicesAddActionPayload): Promise<IDevice> => {
		const parsedPayload = DevicesAddActionPayloadSchema.safeParse(payload);

		if (!parsedPayload.success) {
			console.error('Schema validation failed with:', parsedPayload.error);

			throw new DevicesValidationException('Failed to add device.');
		}

		const plugin = getPluginByType(payload.data.type);

		const pluginSchema = plugin?.schemas?.deviceSchema;

		const merged = {
			...parsedPayload.data.data,
			id: parsedPayload.data.id,
			draft: parsedPayload.data.draft,
			createdAt: new Date(),
		};

		const parsedNewDevice = pluginSchema ? pluginSchema.safeParse(merged) : DeviceSchema.safeParse(merged);

		if (!parsedNewDevice.success) {
			console.error('Schema validation failed with:', parsedNewDevice.error);

			throw new DevicesValidationException('Failed to add device.');
		}

		semaphore.value.creating.push(parsedNewDevice.data.id);

		data.value[parsedNewDevice.data.id] = parsedNewDevice.data;

		if (parsedNewDevice.data.draft) {
			semaphore.value.creating = semaphore.value.creating.filter((item) => item !== parsedNewDevice.data.id);

			return parsedNewDevice.data;
		} else {
			const {
				data: responseData,
				error,
				response,
			} = await backend.client.POST(`/${DEVICES_MODULE_PREFIX}/devices`, {
				body: {
					data: {
						...transformDeviceCreateRequest(
							{ ...parsedNewDevice.data, ...{ id: payload.id } },
							plugin?.schemas?.deviceCreateReqSchema || DeviceCreateReqSchema
						),
					},
				},
			});

			semaphore.value.creating = semaphore.value.creating.filter((item) => item !== parsedNewDevice.data.id);

			if (typeof responseData !== 'undefined' && responseData.data.id === payload.id) {
				const plugin = getPluginByType(responseData.data.type);

				const device = transformDeviceResponse(responseData.data, plugin?.schemas?.deviceSchema || DeviceSchema);

				data.value[device.id] = device;

				insertDeviceControlsRelations(device, responseData.data.controls);
				insertChannelsRelations(device, responseData.data.channels);

				return device;
			}

			// Record could not be created on api, we have to remove it from database
			delete data.value[parsedNewDevice.data.id];

			let errorReason: string | null = 'Failed to create device.';

			if (error) {
				errorReason = getErrorReason<operations['create-devices-module-device']>(error, errorReason);
			}

			throw new DevicesApiException(errorReason, response.status);
		}
	};

	const edit = async (payload: IDevicesEditActionPayload): Promise<IDevice> => {
		const parsedPayload = DevicesEditActionPayloadSchema.safeParse(payload);

		if (!parsedPayload.success) {
			console.error('Schema validation failed with:', parsedPayload.error);

			throw new DevicesValidationException('Failed to edit device.');
		}

		if (semaphore.value.updating.includes(payload.id)) {
			throw new DevicesException('Device is already being updated.');
		}

		if (!(payload.id in data.value)) {
			throw new DevicesException('Failed to get device data to update.');
		}

		const plugin = getPluginByType(data.value[payload.id].type);

		const pluginSchema = plugin?.schemas?.deviceSchema;

		const merged = {
			...data.value[payload.id],
			...omitBy(parsedPayload.data.data, isUndefined),
		};

		const parsedEditedDevice = pluginSchema ? pluginSchema.safeParse(merged) : DeviceSchema.safeParse(merged);

		if (!parsedEditedDevice.success) {
			console.error('Schema validation failed with:', parsedEditedDevice.error);

			throw new DevicesValidationException('Failed to edit device.');
		}

		semaphore.value.updating.push(payload.id);

		data.value[parsedEditedDevice.data.id] = parsedEditedDevice.data;

		if (parsedEditedDevice.data.draft) {
			semaphore.value.updating = semaphore.value.updating.filter((item) => item !== parsedEditedDevice.data.id);

			return parsedEditedDevice.data;
		} else {
			const {
				data: responseData,
				error,
				response,
			} = await backend.client.PATCH(`/${DEVICES_MODULE_PREFIX}/devices/{id}`, {
				params: {
					path: {
						id: payload.id,
					},
				},
				body: {
					data: transformDeviceUpdateRequest(
						parsedEditedDevice.data,
						parsedEditedDevice.data.type,
						plugin?.schemas?.deviceUpdateReqSchema || DeviceUpdateReqSchema
					),
				},
			});

			semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.id);

			if (typeof responseData !== 'undefined') {
				const plugin = getPluginByType(responseData.data.type);

				const device = transformDeviceResponse(responseData.data, plugin?.schemas?.deviceSchema || DeviceSchema);

				data.value[device.id] = device;

				return device;
			}

			// Updating record on api failed, we need to refresh record
			await get({ id: payload.id });

			let errorReason: string | null = 'Failed to update device.';

			if (error) {
				errorReason = getErrorReason<operations['update-devices-module-device']>(error, errorReason);
			}

			throw new DevicesApiException(errorReason, response.status);
		}
	};

	const save = async (payload: IDevicesSaveActionPayload): Promise<IDevice> => {
		if (semaphore.value.updating.includes(payload.id)) {
			throw new DevicesException('Device is already being saved.');
		}

		if (!(payload.id in data.value)) {
			throw new DevicesException('Failed to get device data to save.');
		}

		const plugin = getPluginByType(data.value[payload.id].type);

		const pluginSchema = plugin?.schemas?.deviceSchema;

		const parsedSaveDevice = pluginSchema ? pluginSchema.safeParse(data.value[payload.id]) : DeviceSchema.safeParse(data.value[payload.id]);

		if (!parsedSaveDevice.success) {
			console.error('Schema validation failed with:', parsedSaveDevice.error);

			throw new DevicesValidationException('Failed to save device.');
		}

		semaphore.value.updating.push(payload.id);

		const {
			data: responseData,
			error,
			response,
		} = await backend.client.POST(`/${DEVICES_MODULE_PREFIX}/devices`, {
			body: {
				data: transformDeviceCreateRequest(
					{ ...parsedSaveDevice.data, ...{ id: payload.id } },
					plugin?.schemas?.deviceCreateReqSchema || DeviceCreateReqSchema
				),
			},
		});

		semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.id);

		if (typeof responseData !== 'undefined' && responseData.data.id === payload.id) {
			const plugin = getPluginByType(responseData.data.type);

			const device = transformDeviceResponse(responseData.data, plugin?.schemas?.deviceSchema || DeviceSchema);

			data.value[device.id] = device;

			insertDeviceControlsRelations(device, responseData.data.controls);
			insertChannelsRelations(device, responseData.data.channels);

			return device;
		}

		let errorReason: string | null = 'Failed to create device.';

		if (error) {
			errorReason = getErrorReason<operations['create-devices-module-device']>(error, errorReason);
		}

		throw new DevicesApiException(errorReason, response.status);
	};

	const remove = async (payload: IDevicesRemoveActionPayload): Promise<boolean> => {
		if (semaphore.value.deleting.includes(payload.id)) {
			throw new DevicesException('Device is already being removed.');
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
			const { error, response } = await backend.client.DELETE(`/${DEVICES_MODULE_PREFIX}/devices/{id}`, {
				params: {
					path: {
						id: payload.id,
					},
				},
			});

			semaphore.value.deleting = semaphore.value.deleting.filter((item) => item !== payload.id);

			if (response.status === 204) {
				const devicesControlsStore = storesManager.getStore(devicesControlsStoreKey);

				devicesControlsStore.unset({ deviceId: payload.id });

				const channelsStore = storesManager.getStore(channelsStoreKey);
				const channelsControlsStore = storesManager.getStore(channelsControlsStoreKey);
				const channelsPropertiesStore = storesManager.getStore(channelsPropertiesStoreKey);

				const channels = channelsStore.findForDevice(payload.id);

				channels.forEach((channel) => {
					channelsControlsStore.unset({ channelId: channel.id });
					channelsPropertiesStore.unset({ channelId: channel.id });
				});

				channelsStore.unset({ deviceId: payload.id });

				return true;
			}

			// Deleting record on api failed, we need to refresh record
			await get({ id: payload.id });

			let errorReason: string | null = 'Remove account failed.';

			if (error) {
				errorReason = getErrorReason<operations['delete-devices-module-device']>(error, errorReason);
			}

			throw new DevicesApiException(errorReason, response.status);
		}

		return true;
	};

	const insertDeviceControlsRelations = (device: IDevice, controls: IDeviceControlRes[]): void => {
		const devicesControlsStore = storesManager.getStore(devicesControlsStoreKey);

		controls.forEach((control) => {
			devicesControlsStore.set({
				id: control.id,
				deviceId: device.id,
				data: transformDeviceControlResponse(control),
			});
		});

		devicesControlsStore.firstLoad.push(device.id);
	};

	const insertChannelsRelations = (device: IDevice, channels: IChannelRes[]): void => {
		const channelsStore = storesManager.getStore(channelsStoreKey);
		const channelsControlsStore = storesManager.getStore(channelsControlsStoreKey);
		const channelsPropertiesStore = storesManager.getStore(channelsPropertiesStoreKey);

		channels.forEach((channel) => {
			channelsStore.set({
				id: channel.id,
				deviceId: device.id,
				data: transformChannelResponse(channel),
			});

			channel.controls.forEach((control) => {
				channelsControlsStore.set({
					id: control.id,
					channelId: channel.id,
					data: transformChannelControlResponse(control),
				});
			});

			channelsControlsStore.firstLoad.push(channel.id);

			channel.properties.forEach((property) => {
				channelsPropertiesStore.set({
					id: property.id,
					channelId: channel.id,
					data: transformChannelPropertyResponse(property),
				});
			});

			channelsPropertiesStore.firstLoad.push(channel.id);
		});

		channelsStore.firstLoad.push(device.id);
	};

	return { semaphore, firstLoad, data, firstLoadFinished, getting, fetching, findAll, findById, set, unset, get, fetch, add, edit, save, remove };
});

export const registerDevicesStore = (pinia: Pinia): Store<string, IDevicesStoreState, object, IDevicesStoreActions> => {
	return useDevices(pinia);
};

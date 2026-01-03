import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { isUndefined, omitBy } from 'lodash';

import { getErrorReason, injectStoresManager, useBackend, useLogger } from '../../../common';
import { MODULES_PREFIX } from '../../../app.constants';
import type {
	DevicesModuleGetDeviceOperation,
	DevicesModuleGetDevicesOperation,
	DevicesModuleCreateDeviceOperation,
	DevicesModuleUpdateDeviceOperation,
	DevicesModuleDeleteDeviceOperation,
} from '../../../openapi.constants';
import { useChannelsPlugins, useChannelsPropertiesPlugins, useDevicesPlugins } from '../composables/composables';
import { DEVICES_MODULE_PREFIX } from '../devices.constants';
import { DevicesApiException, DevicesException, DevicesValidationException } from '../devices.exceptions';

import { transformChannelControlResponse } from './channels.controls.transformers';
import { ChannelPropertySchema } from './channels.properties.store.schemas';
import { transformChannelPropertyResponse } from './channels.properties.transformers';
import { ChannelSchema } from './channels.store.schemas';
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
	IDeviceCreateReq,
	IDeviceRes,
	IDeviceUpdateReq,
	IDevicesAddActionPayload,
	IDevicesEditActionPayload,
	IDevicesGetActionPayload,
	IDevicesOnEventActionPayload,
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
	const logger = useLogger();

	const { getElement: getPluginElement } = useDevicesPlugins();
	const { getElement: getChannelsPluginElement } = useChannelsPlugins();
	const { getElement: getChannelsPropertiesPluginElement } = useChannelsPropertiesPlugins();

	const storesManager = injectStoresManager();

	const semaphore = ref<IDevicesStateSemaphore>(defaultSemaphore);

	const firstLoad = ref<boolean>(false);

	const data = ref<{ [key: IDevice['id']]: IDevice }>({});

	const firstLoadFinished = (): boolean => firstLoad.value;

	const getting = (id: IDevice['id']): boolean => semaphore.value.fetching.item.includes(id);

	const fetching = (): boolean => semaphore.value.fetching.items;

	const findAll = (): IDevice[] => Object.values(data.value);

	const findById = (id: IDevice['id']): IDevice | null => data.value[id] ?? null;

	const pendingGetPromises: Record<string, Promise<IDevice>> = {};

	const pendingFetchPromises: Record<string, Promise<IDevice[]>> = {};

	const onEvent = (payload: IDevicesOnEventActionPayload): IDevice => {
		const element = getPluginElement(payload.type);

		return set({
			id: payload.id,
			data: transformDeviceResponse(payload.data as unknown as IDeviceRes, element?.schemas?.deviceSchema || DeviceSchema),
		});
	};

	const set = (payload: IDevicesSetActionPayload): IDevice => {
		const element = getPluginElement(payload.data.type);

		if (payload.id && data.value && payload.id in data.value) {
			const parsed = (element?.schemas?.deviceSchema || DeviceSchema).safeParse({ ...data.value[payload.id], ...payload.data });

			if (!parsed.success) {
				logger.error('Schema validation failed with:', parsed.error);

				throw new DevicesValidationException('Failed to insert device.');
			}

			return (data.value[parsed.data.id] = parsed.data);
		}

		const parsed = (element?.schemas?.deviceSchema || DeviceSchema).safeParse({ ...payload.data, id: payload.id });

		if (!parsed.success) {
			logger.error('Schema validation failed with:', parsed.error);

			throw new DevicesValidationException('Failed to insert device.');
		}

		data.value = data.value ?? {};

		return (data.value[parsed.data.id] = parsed.data);
	};

	const unset = (payload: IDevicesUnsetActionPayload): void => {
		if (!data.value) {
			return;
		}

		delete data.value[payload.id];

		return;
	};

	const get = async (payload: IDevicesGetActionPayload): Promise<IDevice> => {
		const existingPromise = pendingGetPromises[payload.id];
		if (existingPromise) {
			return existingPromise;
		}

		const getPromise = (async (): Promise<IDevice> => {
			if (semaphore.value.fetching.item.includes(payload.id)) {
				throw new DevicesApiException('Already fetching device.');
			}

			semaphore.value.fetching.item.push(payload.id);

			try {
				const {
					data: responseData,
					error,
					response,
				} = await backend.client.GET(`/${MODULES_PREFIX}/${DEVICES_MODULE_PREFIX}/devices/{id}`, {
					params: {
						path: { id: payload.id },
					},
				});

				if (typeof responseData !== 'undefined') {
					const element = getPluginElement(responseData.data.type);

					const transformed = transformDeviceResponse(responseData.data, element?.schemas?.deviceSchema || DeviceSchema);

					data.value[transformed.id] = transformed;

					insertDeviceControlsRelations(transformed, responseData.data.controls);
					insertChannelsRelations(transformed, responseData.data.channels);

					return transformed;
				}

				let errorReason: string | null = 'Failed to fetch device.';

				if (error) {
					errorReason = getErrorReason<DevicesModuleGetDeviceOperation>(error, errorReason);
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

	const fetch = async (): Promise<IDevice[]> => {
		if ('all' in pendingFetchPromises) {
			return pendingFetchPromises['all'];
		}

		const fetchPromise = (async (): Promise<IDevice[]> => {
			if (semaphore.value.fetching.items) {
				throw new DevicesApiException('Already fetching devices.');
			}

			semaphore.value.fetching.items = true;

			try {
				const { data: responseData, error, response } = await backend.client.GET(`/${MODULES_PREFIX}/${DEVICES_MODULE_PREFIX}/devices`);

				if (typeof responseData !== 'undefined') {
					data.value = Object.fromEntries(
						responseData.data.map((device) => {
							const element = getPluginElement(device.type);

							const transformed = transformDeviceResponse(device, element?.schemas?.deviceSchema || DeviceSchema);

							insertDeviceControlsRelations(transformed, device.controls);
							insertChannelsRelations(transformed, device.channels);

							return [transformed.id, transformed];
						})
					);

					firstLoad.value = true;

					return Object.values(data.value);
				}

				let errorReason: string | null = 'Failed to fetch devices.';

				if (error) {
					errorReason = getErrorReason<DevicesModuleGetDevicesOperation>(error, errorReason);
				}

				throw new DevicesApiException(errorReason, response.status);
			} finally {
				semaphore.value.fetching.items = false;
			}
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
			logger.error('Schema validation failed with:', parsedPayload.error);

			throw new DevicesValidationException('Failed to add device.');
		}

		const element = getPluginElement(payload.data.type);

		const parsedNewItem = (element?.schemas?.deviceSchema || DeviceSchema).safeParse({
			...payload.data,
			id: parsedPayload.data.id,
			draft: parsedPayload.data.draft,
			createdAt: new Date(),
		});

		if (!parsedNewItem.success) {
			logger.error('Schema validation failed with:', parsedNewItem.error);

			throw new DevicesValidationException('Failed to add device.');
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
				} = await backend.client.POST(`/${MODULES_PREFIX}/${DEVICES_MODULE_PREFIX}/devices`, {
					body: {
						data: transformDeviceCreateRequest<IDeviceCreateReq>(
							parsedNewItem.data,
							element?.schemas?.deviceCreateReqSchema || DeviceCreateReqSchema
						),
					},
				});

				if (typeof responseData !== 'undefined' && responseData.data.id === payload.id) {
					const element = getPluginElement(responseData.data.type);

					const transformed = transformDeviceResponse(responseData.data, element?.schemas?.deviceSchema || DeviceSchema);

					data.value[transformed.id] = transformed;

					insertDeviceControlsRelations(transformed, responseData.data.controls);
					insertChannelsRelations(transformed, responseData.data.channels);

					return transformed;
				}

				// Record could not be created on api, we have to remove it from a database
				delete data.value[parsedNewItem.data.id];

				let errorReason: string | null = 'Failed to create device.';

				if (error) {
					errorReason = getErrorReason<DevicesModuleCreateDeviceOperation>(error, errorReason);
				}

				throw new DevicesApiException(errorReason, response.status);
			} finally {
				semaphore.value.creating = semaphore.value.creating.filter((item) => item !== parsedNewItem.data.id);
			}
		}
	};

	const edit = async (payload: IDevicesEditActionPayload): Promise<IDevice> => {
		if (semaphore.value.updating.includes(payload.id)) {
			throw new DevicesException('Device is already being updated.');
		}

		if (!(payload.id in data.value)) {
			throw new DevicesException('Failed to get device data to update.');
		}

		const parsedPayload = DevicesEditActionPayloadSchema.safeParse(payload);

		if (!parsedPayload.success) {
			logger.error('Schema validation failed with:', parsedPayload.error);

			throw new DevicesValidationException('Failed to edit device.');
		}

		const element = getPluginElement(payload.data.type);

		const parsedEditedItem = (element?.schemas?.deviceSchema || DeviceSchema).safeParse({
			...data.value[payload.id],
			...omitBy(payload.data, isUndefined),
		});

		if (!parsedEditedItem.success) {
			logger.error('Schema validation failed with:', parsedEditedItem.error);

			throw new DevicesValidationException('Failed to edit device.');
		}

		semaphore.value.updating.push(payload.id);

		data.value[parsedEditedItem.data.id] = parsedEditedItem.data;

		if (parsedEditedItem.data.draft) {
			semaphore.value.updating = semaphore.value.updating.filter((item) => item !== parsedEditedItem.data.id);

			return parsedEditedItem.data;
		} else {
			try {
				const {
					data: responseData,
					error,
					response,
				} = await backend.client.PATCH(`/${MODULES_PREFIX}/${DEVICES_MODULE_PREFIX}/devices/{id}`, {
					params: {
						path: {
							id: payload.id,
						},
					},
					body: {
						data: transformDeviceUpdateRequest<IDeviceUpdateReq>(
							parsedEditedItem.data,
							element?.schemas?.deviceUpdateReqSchema || DeviceUpdateReqSchema
						),
					},
				});

				if (typeof responseData !== 'undefined') {
					const element = getPluginElement(responseData.data.type);

					const transformed = transformDeviceResponse(responseData.data, element?.schemas?.deviceSchema || DeviceSchema);

					data.value[transformed.id] = transformed;

					return transformed;
				}

				// Updating the record on api failed, we need to refresh the record
				await get({ id: payload.id });

				let errorReason: string | null = 'Failed to update device.';

				if (error) {
					errorReason = getErrorReason<DevicesModuleUpdateDeviceOperation>(error, errorReason);
				}

				throw new DevicesApiException(errorReason, response.status);
			} finally {
				semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.id);
			}
		}
	};

	const save = async (payload: IDevicesSaveActionPayload): Promise<IDevice> => {
		if (semaphore.value.updating.includes(payload.id)) {
			throw new DevicesException('Device is already being saved.');
		}

		const deviceToSave = data.value[payload.id];
		if (!deviceToSave) {
			throw new DevicesException('Failed to get device data to save.');
		}

		const element = getPluginElement(deviceToSave.type);

		const parsedSaveItem = (element?.schemas?.deviceSchema || DeviceSchema).safeParse(deviceToSave);

		if (!parsedSaveItem.success) {
			logger.error('Schema validation failed with:', parsedSaveItem.error);

			throw new DevicesValidationException('Failed to save device.');
		}

		semaphore.value.updating.push(payload.id);

		try {
			const {
				data: responseData,
				error,
				response,
			} = await backend.client.POST(`/${MODULES_PREFIX}/${DEVICES_MODULE_PREFIX}/devices`, {
				body: {
					data: transformDeviceCreateRequest<IDeviceCreateReq>(parsedSaveItem.data, element?.schemas?.deviceCreateReqSchema || DeviceCreateReqSchema),
				},
			});

			if (typeof responseData !== 'undefined' && responseData.data.id === payload.id) {
				const element = getPluginElement(responseData.data.type);

				const transformed = transformDeviceResponse(responseData.data, element?.schemas?.deviceSchema || DeviceSchema);

				data.value[transformed.id] = transformed;

				insertDeviceControlsRelations(transformed, responseData.data.controls);
				insertChannelsRelations(transformed, responseData.data.channels);

				return transformed;
			}

			let errorReason: string | null = 'Failed to create device.';

			if (error) {
				errorReason = getErrorReason<DevicesModuleCreateDeviceOperation>(error, errorReason);
			}

			throw new DevicesApiException(errorReason, response.status);
		} finally {
			semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.id);
		}
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

		if (recordToRemove?.draft) {
			semaphore.value.deleting = semaphore.value.deleting.filter((item) => item !== payload.id);
		} else {
			try {
				const { error, response } = await backend.client.DELETE(`/${MODULES_PREFIX}/${DEVICES_MODULE_PREFIX}/devices/{id}`, {
					params: {
						path: {
							id: payload.id,
						},
					},
				});

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

				// Deleting record on api failed, we need to refresh the record
				await get({ id: payload.id });

				let errorReason: string | null = 'Remove account failed.';

				if (error) {
					errorReason = getErrorReason<DevicesModuleDeleteDeviceOperation>(error, errorReason);
				}

				throw new DevicesApiException(errorReason, response.status);
			} finally {
				semaphore.value.deleting = semaphore.value.deleting.filter((item) => item !== payload.id);
			}
		}

		return true;
	};

	const insertDeviceControlsRelations = (device: IDevice, controls: IDeviceControlRes[]): void => {
		const devicesControlsStore = storesManager.getStore(devicesControlsStoreKey);

		controls.forEach((control) => {
			devicesControlsStore.set({
				id: control.id,
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
			const element = getChannelsPluginElement(channel.type);

			channelsStore.set({
				id: channel.id,
				data: transformChannelResponse(channel, element?.schemas?.channelSchema || ChannelSchema),
			});

			channel.controls.forEach((control) => {
				channelsControlsStore.set({
					id: control.id,
					data: transformChannelControlResponse(control),
				});
			});

			channelsControlsStore.firstLoad.push(channel.id);

			channel.properties.forEach((property) => {
				const element = getChannelsPropertiesPluginElement(property.type);

				channelsPropertiesStore.set({
					id: property.id,
					data: transformChannelPropertyResponse(property, element?.schemas?.channelPropertySchema || ChannelPropertySchema),
				});
			});

			channelsPropertiesStore.firstLoad.push(channel.id);
		});

		channelsStore.firstLoad.push(device.id);
	};

	return {
		semaphore,
		firstLoad,
		data,
		firstLoadFinished,
		getting,
		fetching,
		findAll,
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

export const registerDevicesStore = (pinia: Pinia): Store<string, IDevicesStoreState, object, IDevicesStoreActions> => {
	return useDevices(pinia);
};

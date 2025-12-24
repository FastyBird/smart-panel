import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { useBackend, useLogger } from '../../../common';
import { PLUGINS_PREFIX } from '../../../app.constants';
import { DEVICES_ZIGBEE2MQTT_PLUGIN_PREFIX } from '../devices-zigbee2mqtt.constants';
import { DevicesZigbee2mqttApiException, DevicesZigbee2mqttValidationException } from '../devices-zigbee2mqtt.exceptions';

import { Zigbee2mqttDiscoveredDeviceSchema } from './zigbee2mqtt-discovered-devices.store.schemas';
import type {
	IZigbee2mqttDiscoveredDevice,
	IZigbee2mqttDiscoveredDevicesGetActionPayload,
	IZigbee2mqttDiscoveredDevicesSetActionPayload,
	IZigbee2mqttDiscoveredDevicesStateSemaphore,
	IZigbee2mqttDiscoveredDevicesStoreActions,
	IZigbee2mqttDiscoveredDevicesStoreState,
	IZigbee2mqttDiscoveredDevicesUnsetActionPayload,
	Zigbee2mqttDiscoveredDevicesStoreSetup,
} from './zigbee2mqtt-discovered-devices.store.types';
import { transformZigbee2mqttDiscoveredDeviceResponse } from './zigbee2mqtt-discovered-devices.transformers';

const defaultSemaphore: IZigbee2mqttDiscoveredDevicesStateSemaphore = {
	fetching: {
		items: false,
		item: [],
	},
};

export const useZigbee2mqttDiscoveredDevices = defineStore<
	'devices_zigbee2mqtt_plugin-discovered_devices',
	Zigbee2mqttDiscoveredDevicesStoreSetup
>('devices_zigbee2mqtt_plugin-discovered_devices', (): Zigbee2mqttDiscoveredDevicesStoreSetup => {
	const backend = useBackend();
	const logger = useLogger();

	const semaphore = ref<IZigbee2mqttDiscoveredDevicesStateSemaphore>(defaultSemaphore);

	const firstLoad = ref<boolean>(false);

	const data = ref<{ [key: IZigbee2mqttDiscoveredDevice['id']]: IZigbee2mqttDiscoveredDevice }>({});

	const firstLoadFinished = (): boolean => firstLoad.value;

	const getting = (id: IZigbee2mqttDiscoveredDevice['id']): boolean => semaphore.value.fetching.item.includes(id);

	const fetching = (): boolean => semaphore.value.fetching.items;

	const findAll = (): IZigbee2mqttDiscoveredDevice[] => Object.values(data.value);

	const findById = (id: IZigbee2mqttDiscoveredDevice['id']): IZigbee2mqttDiscoveredDevice | null =>
		id in data.value ? data.value[id] : null;

	const pendingGetPromises: Record<string, Promise<IZigbee2mqttDiscoveredDevice>> = {};

	const pendingFetchPromises: Record<string, Promise<IZigbee2mqttDiscoveredDevice[]>> = {};

	const set = (payload: IZigbee2mqttDiscoveredDevicesSetActionPayload): IZigbee2mqttDiscoveredDevice => {
		if (payload.id && data.value && payload.id in data.value) {
			const parsedDevice = Zigbee2mqttDiscoveredDeviceSchema.safeParse({
				...data.value[payload.id],
				...payload.data,
			});

			if (!parsedDevice.success) {
				logger.error('Schema validation failed with:', parsedDevice.error);

				throw new DevicesZigbee2mqttValidationException('Failed to update Zigbee2MQTT discovered device.');
			}

			return (data.value[parsedDevice.data.id] = parsedDevice.data);
		}

		const parsedDevice = Zigbee2mqttDiscoveredDeviceSchema.safeParse({ ...payload.data, id: payload.id });

		if (!parsedDevice.success) {
			logger.error('Schema validation failed with:', parsedDevice.error);

			throw new DevicesZigbee2mqttValidationException('Failed to insert Zigbee2MQTT discovered device.');
		}

		data.value = data.value ?? {};

		return (data.value[parsedDevice.data.id] = parsedDevice.data);
	};

	const unset = (payload: IZigbee2mqttDiscoveredDevicesUnsetActionPayload): void => {
		if (!data.value) {
			return;
		}

		delete data.value[payload.id];
	};

	const get = async (payload: IZigbee2mqttDiscoveredDevicesGetActionPayload): Promise<IZigbee2mqttDiscoveredDevice> => {
		if (payload.id in pendingGetPromises) {
			return pendingGetPromises[payload.id];
		}

		const fetchPromise = (async (): Promise<IZigbee2mqttDiscoveredDevice> => {
			if (semaphore.value.fetching.item.includes(payload.id)) {
				throw new DevicesZigbee2mqttApiException('Already fetching Zigbee2MQTT discovered device.', 409);
			}

			semaphore.value.fetching.item.push(payload.id);

			try {
				const apiResponse = await backend.client.GET(
					`/${PLUGINS_PREFIX}/${DEVICES_ZIGBEE2MQTT_PLUGIN_PREFIX}/discovered-devices/{ieeeAddress}` as never,
					{
						params: {
							path: { ieeeAddress: payload.id },
						},
					} as never
				);

				const { data: responseData, error, response } = apiResponse as {
					data?: { data: unknown };
					error?: unknown;
					response: { status: number };
				};

				if (typeof responseData !== 'undefined') {
					const transformed = transformZigbee2mqttDiscoveredDeviceResponse(responseData.data as never);

					data.value[transformed.id] = transformed;

					return transformed;
				}

				const errorReason = error ? String(error) : 'Failed to fetch Zigbee2MQTT discovered device.';

				throw new DevicesZigbee2mqttApiException(errorReason, response.status);
			} finally {
				semaphore.value.fetching.item = semaphore.value.fetching.item.filter((item) => item !== payload.id);
			}
		})();

		pendingGetPromises[payload.id] = fetchPromise;

		try {
			return await fetchPromise;
		} finally {
			delete pendingGetPromises[payload.id];
		}
	};

	const fetch = async (): Promise<IZigbee2mqttDiscoveredDevice[]> => {
		if ('all' in pendingFetchPromises) {
			return pendingFetchPromises['all'];
		}

		const fetchPromise = (async (): Promise<IZigbee2mqttDiscoveredDevice[]> => {
			if (semaphore.value.fetching.items) {
				throw new DevicesZigbee2mqttApiException('Already fetching Zigbee2MQTT discovered devices.', 409);
			}

			semaphore.value.fetching.items = true;

			try {
				const apiResponse = await backend.client.GET(
					`/${PLUGINS_PREFIX}/${DEVICES_ZIGBEE2MQTT_PLUGIN_PREFIX}/discovered-devices` as never
				);

				const { data: responseData, error, response } = apiResponse as {
					data?: { data: unknown[] };
					error?: unknown;
					response: { status: number };
				};

				if (typeof responseData !== 'undefined') {
					data.value = Object.fromEntries(
						responseData.data.map((device) => {
							const transformed = transformZigbee2mqttDiscoveredDeviceResponse(device as never);

							return [transformed.id, transformed];
						})
					);

					firstLoad.value = true;

					return Object.values(data.value);
				}

				const errorReason = error ? String(error) : 'Failed to fetch Zigbee2MQTT discovered devices.';

				throw new DevicesZigbee2mqttApiException(errorReason, response.status);
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

	return {
		semaphore,
		firstLoad,
		data,
		firstLoadFinished,
		getting,
		fetching,
		findAll,
		findById,
		set,
		unset,
		get,
		fetch,
	};
});

export const registerZigbee2mqttDiscoveredDevicesStore = (
	pinia: Pinia
): Store<string, IZigbee2mqttDiscoveredDevicesStoreState, object, IZigbee2mqttDiscoveredDevicesStoreActions> => {
	return useZigbee2mqttDiscoveredDevices(pinia);
};

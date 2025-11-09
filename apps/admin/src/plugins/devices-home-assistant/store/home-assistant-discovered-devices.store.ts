import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { getErrorReason, injectStoresManager, useBackend, useLogger } from '../../../common';
import type { operations } from '../../../openapi';
import { DEVICES_HOME_ASSISTANT_PLUGIN_PREFIX } from '../devices-home-assistant.constants';
import { DevicesHomeAssistantApiException, DevicesHomeAssistantValidationException } from '../devices-home-assistant.exceptions';

import { HomeAssistantDiscoveredDeviceSchema } from './home-assistant-discovered-devices.store.schemas';
import type {
	HomeAssistantDiscoveredDevicesStoreSetup,
	IHomeAssistantDiscoveredDevice,
	IHomeAssistantDiscoveredDevicesGetActionPayload,
	IHomeAssistantDiscoveredDevicesSetActionPayload,
	IHomeAssistantDiscoveredDevicesStateSemaphore,
	IHomeAssistantDiscoveredDevicesStoreActions,
	IHomeAssistantDiscoveredDevicesStoreState,
	IHomeAssistantDiscoveredDevicesUnsetActionPayload,
} from './home-assistant-discovered-devices.store.types';
import { transformHomeAssistantDiscoveredDeviceResponse } from './home-assistant-discovered-devices.transformers';
import type { IHomeAssistantStateRes } from './home-assistant-states.store.types';
import { transformHomeAssistantStateResponse } from './home-assistant-states.transformers';
import { statesStoreKey } from './keys';

const defaultSemaphore: IHomeAssistantDiscoveredDevicesStateSemaphore = {
	fetching: {
		items: false,
		item: [],
	},
};

export const useHomeAssistantDiscoveredDevices = defineStore<
	'devices_home_assistant_plugin-discovered_devices',
	HomeAssistantDiscoveredDevicesStoreSetup
>('devices_home_assistant_plugin-discovered_devices', (): HomeAssistantDiscoveredDevicesStoreSetup => {
	const backend = useBackend();
	const logger = useLogger();

	const storesManager = injectStoresManager();

	const semaphore = ref<IHomeAssistantDiscoveredDevicesStateSemaphore>(defaultSemaphore);

	const firstLoad = ref<boolean>(false);

	const data = ref<{ [key: IHomeAssistantDiscoveredDevice['id']]: IHomeAssistantDiscoveredDevice }>({});

	const firstLoadFinished = (): boolean => firstLoad.value;

	const getting = (id: IHomeAssistantDiscoveredDevice['id']): boolean => semaphore.value.fetching.item.includes(id);

	const fetching = (): boolean => semaphore.value.fetching.items;

	const findAll = (): IHomeAssistantDiscoveredDevice[] => Object.values(data.value);

	const findById = (id: IHomeAssistantDiscoveredDevice['id']): IHomeAssistantDiscoveredDevice | null => (id in data.value ? data.value[id] : null);

	const pendingGetPromises: Record<string, Promise<IHomeAssistantDiscoveredDevice>> = {};

	const pendingFetchPromises: Record<string, Promise<IHomeAssistantDiscoveredDevice[]>> = {};

	const set = (payload: IHomeAssistantDiscoveredDevicesSetActionPayload): IHomeAssistantDiscoveredDevice => {
		if (payload.id && data.value && payload.id in data.value) {
			const parsedHomeAssistantDiscoveredDevice = HomeAssistantDiscoveredDeviceSchema.safeParse({ ...data.value[payload.id], ...payload.data });

			if (!parsedHomeAssistantDiscoveredDevice.success) {
				logger.error('Schema validation failed with:', parsedHomeAssistantDiscoveredDevice.error);

				throw new DevicesHomeAssistantValidationException('Failed to insert HomeAssistantDiscoveredDevice.');
			}

			return (data.value[parsedHomeAssistantDiscoveredDevice.data.id] = parsedHomeAssistantDiscoveredDevice.data);
		}

		const parsedHomeAssistantDiscoveredDevice = HomeAssistantDiscoveredDeviceSchema.safeParse({ ...payload.data, id: payload.id });

		if (!parsedHomeAssistantDiscoveredDevice.success) {
			logger.error('Schema validation failed with:', parsedHomeAssistantDiscoveredDevice.error);

			throw new DevicesHomeAssistantValidationException('Failed to insert Home Assistant device.');
		}

		data.value = data.value ?? {};

		return (data.value[parsedHomeAssistantDiscoveredDevice.data.id] = parsedHomeAssistantDiscoveredDevice.data);
	};

	const unset = (payload: IHomeAssistantDiscoveredDevicesUnsetActionPayload): void => {
		if (!data.value) {
			return;
		}

		delete data.value[payload.id];
	};

	const get = async (payload: IHomeAssistantDiscoveredDevicesGetActionPayload): Promise<IHomeAssistantDiscoveredDevice> => {
		if (payload.id in pendingGetPromises) {
			return pendingGetPromises[payload.id];
		}

		const fetchPromise = (async (): Promise<IHomeAssistantDiscoveredDevice> => {
			if (semaphore.value.fetching.item.includes(payload.id)) {
				throw new DevicesHomeAssistantApiException('Already fetching HomeAssistantDiscoveredDevice.');
			}

			semaphore.value.fetching.item.push(payload.id);

			try {
				const apiResponse = await backend.client.GET(`/plugins/${DEVICES_HOME_ASSISTANT_PLUGIN_PREFIX}/discovered-devices/{id}`, {
					params: {
						path: { id: payload.id },
					},
				});

				const { data: responseData, error, response } = apiResponse;

				if (typeof responseData !== 'undefined') {
					const transformed = transformHomeAssistantDiscoveredDeviceResponse(responseData.data);

					data.value[transformed.id] = transformed;

					insertStatesRelations(transformed, responseData.data.states);

					return transformed;
				}

				let errorReason: string | null = 'Failed to fetch HomeAssistantDiscoveredDevice.';

				if (error) {
					errorReason = getErrorReason<operations['get-devices-home-assistant-plugin-device']>(error, errorReason);
				}

				throw new DevicesHomeAssistantApiException(errorReason, response.status);
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

	const fetch = async (): Promise<IHomeAssistantDiscoveredDevice[]> => {
		if ('all' in pendingFetchPromises) {
			return pendingFetchPromises['all'];
		}

		const fetchPromise = (async (): Promise<IHomeAssistantDiscoveredDevice[]> => {
			if (semaphore.value.fetching.items) {
				throw new DevicesHomeAssistantApiException('Already fetching Home Assistant devices.');
			}

			semaphore.value.fetching.items = true;

			try {
				const {
					data: responseData,
					error,
					response,
				} = await backend.client.GET(`/plugins/${DEVICES_HOME_ASSISTANT_PLUGIN_PREFIX}/discovered-devices`);

				if (typeof responseData !== 'undefined') {
					data.value = Object.fromEntries(
						responseData.data.map((device) => {
							const transformed = transformHomeAssistantDiscoveredDeviceResponse(device);

							insertStatesRelations(transformed, device.states);

							return [transformed.id, transformed];
						})
					);

					firstLoad.value = true;

					return Object.values(data.value);
				}

				let errorReason: string | null = 'Failed to fetch Home Assistant devices.';

				if (error) {
					errorReason = getErrorReason<operations['get-devices-home-assistant-plugin-devices']>(error, errorReason);
				}

				throw new DevicesHomeAssistantApiException(errorReason, response.status);
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

	const insertStatesRelations = (device: IHomeAssistantDiscoveredDevice, states: IHomeAssistantStateRes[]): void => {
		const statesStore = storesManager.getStore(statesStoreKey);

		states.forEach((state) => {
			statesStore.set({
				entityId: state.entity_id,
				data: transformHomeAssistantStateResponse(state),
			});
		});
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

export const registerHomeAssistantDiscoveredDevicesStore = (
	pinia: Pinia
): Store<string, IHomeAssistantDiscoveredDevicesStoreState, object, IHomeAssistantDiscoveredDevicesStoreActions> => {
	return useHomeAssistantDiscoveredDevices(pinia);
};

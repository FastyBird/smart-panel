import { ref } from 'vue';

import { type Pinia, defineStore } from 'pinia';

import { PLUGINS_PREFIX } from '../../../app.constants';
import { getErrorReason, useBackend } from '../../../common';
import type {
	DevicesHomeyPluginAdoptBatchOperation,
	DevicesHomeyPluginAdoptDeviceOperation,
	DevicesHomeyPluginGetDeviceOperation,
	DevicesHomeyPluginGetDevicesOperation,
	DevicesHomeyPluginPreviewMappingOperation,
} from '../../../openapi.constants';
import { DEVICES_HOMEY_PLUGIN_PREFIX, MAX_HOMEY_ADOPTION_BATCH_SIZE } from '../devices-homey.constants';
import { DevicesHomeyApiException } from '../devices-homey.exceptions';

import { transformHomeyAdoptionResult, transformHomeyInventoryDevice, transformHomeyMappingPreview } from './homey.transformers';
import type { IHomeyAdoptSelection, IHomeyAdoptionResult, IHomeyInventoryDevice, IHomeyInventoryFilters, IHomeyMappingPreview } from './homey.types';

export const useHomeyInventory = defineStore('devices_homey_plugin-inventory', () => {
	const backend = useBackend();
	const data = ref<Record<string, IHomeyInventoryDevice>>({});
	const previews = ref<Record<string, IHomeyMappingPreview>>({});
	const adoptionResults = ref<IHomeyAdoptionResult[]>([]);
	const fetching = ref(false);
	const previewing = ref<string[]>([]);
	const adopting = ref(false);
	const firstLoad = ref(false);

	const findAll = (): IHomeyInventoryDevice[] => Object.values(data.value);
	const findById = (id: string): IHomeyInventoryDevice | null => data.value[id] ?? null;

	const fetch = async (filters: IHomeyInventoryFilters = {}): Promise<IHomeyInventoryDevice[]> => {
		fetching.value = true;

		try {
			const {
				data: responseData,
				error,
				response,
			} = await backend.client.GET(`/${PLUGINS_PREFIX}/${DEVICES_HOMEY_PLUGIN_PREFIX}/devices`, {
				params: {
					query: {
						support: filters.support,
						adoption: filters.adoption,
						availability: filters.availability,
						zone_id: filters.zoneId,
						class: filters.class,
						search: filters.search,
					},
				},
			});

			if (responseData) {
				const devices = responseData.data.map(transformHomeyInventoryDevice);
				data.value = Object.fromEntries(devices.map((device) => [device.id, device]));
				firstLoad.value = true;

				return devices;
			}

			throw new DevicesHomeyApiException(
				getErrorReason<DevicesHomeyPluginGetDevicesOperation>(error, 'Failed to load the Homey device inventory.'),
				response.status
			);
		} finally {
			fetching.value = false;
		}
	};

	const get = async (id: string): Promise<IHomeyInventoryDevice> => {
		const {
			data: responseData,
			error,
			response,
		} = await backend.client.GET(`/${PLUGINS_PREFIX}/${DEVICES_HOMEY_PLUGIN_PREFIX}/devices/{deviceId}`, { params: { path: { deviceId: id } } });

		if (responseData) {
			const device = transformHomeyInventoryDevice(responseData.data);
			data.value[device.id] = device;

			return device;
		}

		throw new DevicesHomeyApiException(
			getErrorReason<DevicesHomeyPluginGetDeviceOperation>(error, 'Failed to load the Homey device.'),
			response.status
		);
	};

	const preview = async (deviceId: string, deviceCategory?: IHomeyInventoryDevice['suggestedCategory']): Promise<IHomeyMappingPreview> => {
		previewing.value.push(deviceId);

		try {
			const {
				data: responseData,
				error,
				response,
			} = await backend.client.POST(`/${PLUGINS_PREFIX}/${DEVICES_HOMEY_PLUGIN_PREFIX}/mapping-preview`, {
				body: { device_id: deviceId, ...(deviceCategory ? { device_category: deviceCategory } : {}) },
			});

			if (responseData) {
				return (previews.value[deviceId] = transformHomeyMappingPreview(responseData.data));
			}

			throw new DevicesHomeyApiException(
				getErrorReason<DevicesHomeyPluginPreviewMappingOperation>(error, 'Failed to preview the Homey device mapping.'),
				response.status
			);
		} finally {
			previewing.value = previewing.value.filter((id) => id !== deviceId);
		}
	};

	const adopt = async (selection: IHomeyAdoptSelection): Promise<IHomeyAdoptionResult> => {
		adopting.value = true;

		try {
			const {
				data: responseData,
				error,
				response,
			} = await backend.client.POST(`/${PLUGINS_PREFIX}/${DEVICES_HOMEY_PLUGIN_PREFIX}/adopt`, {
				body: {
					device_id: selection.deviceId,
					...(selection.deviceCategory ? { device_category: selection.deviceCategory } : {}),
					...(selection.name ? { name: selection.name } : {}),
				},
			});

			if (responseData) {
				const result = transformHomeyAdoptionResult(responseData.data);
				adoptionResults.value = [result];

				return result;
			}

			throw new DevicesHomeyApiException(
				getErrorReason<DevicesHomeyPluginAdoptDeviceOperation>(error, 'Failed to adopt the Homey device.'),
				response.status
			);
		} finally {
			adopting.value = false;
		}
	};

	const adoptBatch = async (selections: IHomeyAdoptSelection[]): Promise<IHomeyAdoptionResult[]> => {
		adopting.value = true;
		adoptionResults.value = [];
		const results: IHomeyAdoptionResult[] = [];

		try {
			for (let offset = 0; offset < selections.length; offset += MAX_HOMEY_ADOPTION_BATCH_SIZE) {
				const chunk = selections.slice(offset, offset + MAX_HOMEY_ADOPTION_BATCH_SIZE);
				const {
					data: responseData,
					error,
					response,
				} = await backend.client.POST(`/${PLUGINS_PREFIX}/${DEVICES_HOMEY_PLUGIN_PREFIX}/adopt/batch`, {
					body: {
						devices: chunk.map((selection) => ({
							device_id: selection.deviceId,
							...(selection.deviceCategory ? { device_category: selection.deviceCategory } : {}),
							...(selection.name ? { name: selection.name } : {}),
						})),
					},
				});

				if (!responseData) {
					throw new DevicesHomeyApiException(
						getErrorReason<DevicesHomeyPluginAdoptBatchOperation>(error, 'Failed to adopt the selected Homey devices.'),
						response.status
					);
				}

				results.push(...responseData.data.results.map(transformHomeyAdoptionResult));
				adoptionResults.value = [...results];
			}

			return results;
		} finally {
			adopting.value = false;
		}
	};

	return {
		data,
		previews,
		adoptionResults,
		fetching,
		previewing,
		adopting,
		firstLoad,
		findAll,
		findById,
		fetch,
		get,
		preview,
		adopt,
		adoptBatch,
	};
});

export const registerHomeyInventoryStore = (pinia: Pinia): ReturnType<typeof useHomeyInventory> => useHomeyInventory(pinia);

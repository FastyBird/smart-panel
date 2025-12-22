import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { getErrorReason, useBackend } from '../../../common';
import { MODULES_PREFIX } from '../../../app.constants';
import type { DevicesModuleGetDeviceValidationOperation, DevicesModuleGetDevicesValidationOperation } from '../../../openapi.constants';
import { DEVICES_MODULE_PREFIX } from '../devices.constants';
import { DevicesApiException } from '../devices.exceptions';

import type {
	DevicesValidationStoreSetup,
	IDeviceValidationResult,
	IDevicesValidation,
	IDevicesValidationGetActionPayload,
	IDevicesValidationStateSemaphore,
	IDevicesValidationStoreActions,
	IDevicesValidationStoreState,
	IValidationSummary,
} from './devices.validation.store.types';
import { transformDeviceValidationResultResponse, transformDevicesValidationResponse } from './devices.validation.transformers';

const defaultSemaphore: IDevicesValidationStateSemaphore = {
	fetching: {
		items: false,
		item: [],
	},
};

/**
 * Recalculate summary statistics from devices array
 */
const calculateSummary = (devices: IDeviceValidationResult[]): IValidationSummary => {
	let errorCount = 0;
	let warningCount = 0;

	for (const device of devices) {
		for (const issue of device.issues) {
			if (issue.severity === 'error') {
				errorCount++;
			} else {
				warningCount++;
			}
		}
	}

	return {
		totalDevices: devices.length,
		validDevices: devices.filter((d) => d.isValid).length,
		invalidDevices: devices.filter((d) => !d.isValid).length,
		totalIssues: errorCount + warningCount,
		errorCount,
		warningCount,
	};
};

export const useDevicesValidationStore = defineStore<'devices_module-devices_validation', DevicesValidationStoreSetup>(
	'devices_module-devices_validation',
	(): DevicesValidationStoreSetup => {
		const backend = useBackend();

		const semaphore = ref<IDevicesValidationStateSemaphore>(defaultSemaphore);
		const firstLoad = ref<boolean>(false);
		const data = ref<IDevicesValidation | null>(null);

		let pendingFetchPromise: Promise<IDevicesValidation> | null = null;
		const pendingGetPromises: Record<string, Promise<IDeviceValidationResult>> = {};

		const firstLoadFinished = (): boolean => firstLoad.value;

		const fetching = (): boolean => semaphore.value.fetching.items;

		const getting = (id: string): boolean => semaphore.value.fetching.item.includes(id);

		const findAll = (): IDeviceValidationResult[] => {
			return data.value?.devices ?? [];
		};

		const findById = (deviceId: string): IDeviceValidationResult | null => {
			if (data.value === null) {
				return null;
			}
			return data.value.devices.find((device) => device.deviceId === deviceId) ?? null;
		};

		const fetch = async (): Promise<IDevicesValidation> => {
			if (pendingFetchPromise) {
				return pendingFetchPromise;
			}

			const fetchPromise = (async (): Promise<IDevicesValidation> => {
				if (semaphore.value.fetching.items) {
					throw new DevicesApiException('Already fetching validation.');
				}

				semaphore.value.fetching.items = true;

				try {
					const {
						data: responseData,
						error,
						response,
					} = await backend.client.GET(`/${MODULES_PREFIX}/${DEVICES_MODULE_PREFIX}/devices/validation`);

					if (typeof responseData !== 'undefined') {
						const transformed = transformDevicesValidationResponse(responseData.data);

						data.value = transformed;
						firstLoad.value = true;

						return transformed;
					}

					let errorReason: string | null = 'Failed to fetch devices validation.';

					if (error) {
						errorReason = getErrorReason<DevicesModuleGetDevicesValidationOperation>(error, errorReason);
					}

					throw new DevicesApiException(errorReason, response.status);
				} finally {
					semaphore.value.fetching.items = false;
				}
			})();

			pendingFetchPromise = fetchPromise;

			try {
				return await fetchPromise;
			} finally {
				pendingFetchPromise = null;
			}
		};

		const get = async (payload: IDevicesValidationGetActionPayload): Promise<IDeviceValidationResult> => {
			if (payload.id in pendingGetPromises) {
				return pendingGetPromises[payload.id];
			}

			const getPromise = (async (): Promise<IDeviceValidationResult> => {
				if (semaphore.value.fetching.item.includes(payload.id)) {
					throw new DevicesApiException('Already fetching device validation.');
				}

				semaphore.value.fetching.item.push(payload.id);

				try {
					const {
						data: responseData,
						error,
						response,
					} = await backend.client.GET(`/${MODULES_PREFIX}/${DEVICES_MODULE_PREFIX}/devices/{id}/validation`, {
						params: {
							path: { id: payload.id },
						},
					});

					if (typeof responseData !== 'undefined') {
						const transformed = transformDeviceValidationResultResponse(responseData.data);

						// Update data.devices array and recalculate summary
						if (data.value !== null) {
							const existingIndex = data.value.devices.findIndex((d) => d.deviceId === transformed.deviceId);
							let newDevices: IDeviceValidationResult[];

							if (existingIndex >= 0) {
								// Update existing entry
								newDevices = [...data.value.devices];
								newDevices[existingIndex] = transformed;
							} else {
								// Add new entry
								newDevices = [...data.value.devices, transformed];
							}

							// Recalculate summary to keep it consistent with devices
							data.value = {
								summary: calculateSummary(newDevices),
								devices: newDevices,
							};
						} else {
							// Initialize data with just this device result
							const newDevices = [transformed];
							data.value = {
								summary: calculateSummary(newDevices),
								devices: newDevices,
							};
						}

						return transformed;
					}

					let errorReason: string | null = 'Failed to fetch device validation.';

					if (error) {
						errorReason = getErrorReason<DevicesModuleGetDeviceValidationOperation>(error, errorReason);
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

		const clear = (): void => {
			data.value = null;
			firstLoad.value = false;
		};

		return {
			semaphore,
			firstLoad,
			data,
			firstLoadFinished,
			fetching,
			getting,
			findAll,
			findById,
			fetch,
			get,
			clear,
		};
	}
);

export const registerDevicesValidationStore = (pinia: Pinia): Store<string, IDevicesValidationStoreState, object, IDevicesValidationStoreActions> => {
	return useDevicesValidationStore(pinia);
};

// Re-export types for convenience
export type {
	IValidationIssue,
	IDeviceValidationResult,
	IValidationSummary,
	IDevicesValidation,
	IDevicesValidationStateSemaphore,
	IDevicesValidationStoreState,
	IDevicesValidationStoreActions,
	DevicesValidationStoreSetup,
} from './devices.validation.store.types';

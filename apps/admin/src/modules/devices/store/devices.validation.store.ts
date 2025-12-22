import { type Ref, ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { getErrorReason, useBackend } from '../../../common';
import { MODULES_PREFIX } from '../../../app.constants';
import type {
	DevicesModuleDeviceValidationResultSchema,
	DevicesModuleDevicesValidationSchema,
	DevicesModuleGetDeviceValidationOperation,
	DevicesModuleGetDevicesValidationOperation,
	DevicesModuleValidationIssueSchema,
	DevicesModuleValidationSummarySchema,
} from '../../../openapi.constants';
import { DEVICES_MODULE_PREFIX } from '../devices.constants';
import { DevicesApiException } from '../devices.exceptions';

// Types
export interface IValidationIssue {
	type: string;
	severity: 'error' | 'warning';
	channelCategory?: string | null;
	channelId?: string | null;
	propertyCategory?: string | null;
	propertyId?: string | null;
	message: string;
	expected?: string | null;
	actual?: string | null;
}

export interface IDeviceValidationResult {
	deviceId: string;
	deviceIdentifier: string | null;
	deviceName: string;
	deviceCategory: string;
	pluginType: string;
	isValid: boolean;
	issues: IValidationIssue[];
}

export interface IValidationSummary {
	totalDevices: number;
	validDevices: number;
	invalidDevices: number;
	totalIssues: number;
	errorCount: number;
	warningCount: number;
}

export interface IDevicesValidation {
	summary: IValidationSummary;
	devices: IDeviceValidationResult[];
}

export interface IDevicesValidationStateSemaphore {
	fetching: {
		items: boolean;
		item: string[];
	};
}

export interface IDevicesValidationStoreState {
	semaphore: Ref<IDevicesValidationStateSemaphore>;
	firstLoad: Ref<boolean>;
	data: Ref<IDevicesValidation | null>;
	deviceResults: Ref<{ [key: string]: IDeviceValidationResult }>;
}

export interface IDevicesValidationStoreActions {
	firstLoadFinished(): boolean;
	fetching(): boolean;
	getting(id: string): boolean;
	getValidation(): IDevicesValidation | null;
	getDeviceValidation(deviceId: string): IDeviceValidationResult | null;
	fetch(): Promise<IDevicesValidation>;
	get(payload: { id: string }): Promise<IDeviceValidationResult>;
	clear(): void;
}

export type DevicesValidationStoreSetup = IDevicesValidationStoreState & IDevicesValidationStoreActions;

export const useDevicesValidationStore = defineStore<'devices_module-devices_validation', DevicesValidationStoreSetup>(
	'devices_module-devices_validation',
	(): DevicesValidationStoreSetup => {
		const backend = useBackend();

		const semaphore = ref<IDevicesValidationStateSemaphore>({
			fetching: {
				items: false,
				item: [],
			},
		});
		const firstLoad = ref<boolean>(false);
		const data = ref<IDevicesValidation | null>(null);
		const deviceResults = ref<{ [key: string]: IDeviceValidationResult }>({});

		let pendingFetchPromise: Promise<IDevicesValidation> | null = null;
		const pendingGetPromises: Record<string, Promise<IDeviceValidationResult>> = {};

		const firstLoadFinished = (): boolean => firstLoad.value;

		const fetching = (): boolean => semaphore.value.fetching.items;

		const getting = (id: string): boolean => semaphore.value.fetching.item.includes(id);

		const getValidation = (): IDevicesValidation | null => data.value;

		const getDeviceValidation = (deviceId: string): IDeviceValidationResult | null => {
			return deviceResults.value[deviceId] || null;
		};

		const transformValidationIssue = (issue: DevicesModuleValidationIssueSchema): IValidationIssue => ({
			type: issue.type,
			severity: issue.severity as 'error' | 'warning',
			channelCategory: issue.channel_category ?? null,
			channelId: issue.channel_id ?? null,
			propertyCategory: issue.property_category ?? null,
			propertyId: issue.property_id ?? null,
			message: issue.message,
			expected: issue.expected ?? null,
			actual: issue.actual ?? null,
		});

		const transformDeviceResult = (result: DevicesModuleDeviceValidationResultSchema): IDeviceValidationResult => ({
			deviceId: result.device_id,
			deviceIdentifier: result.device_identifier ?? null,
			deviceName: result.device_name,
			deviceCategory: result.device_category,
			pluginType: result.plugin_type,
			isValid: result.is_valid,
			issues: result.issues.map(transformValidationIssue),
		});

		const transformSummary = (summary: DevicesModuleValidationSummarySchema): IValidationSummary => ({
			totalDevices: summary.total_devices,
			validDevices: summary.valid_devices,
			invalidDevices: summary.invalid_devices,
			totalIssues: summary.total_issues,
			errorCount: summary.error_count,
			warningCount: summary.warning_count,
		});

		const transformValidation = (validation: DevicesModuleDevicesValidationSchema): IDevicesValidation => ({
			summary: transformSummary(validation.summary),
			devices: validation.devices.map(transformDeviceResult),
		});

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
						const transformed = transformValidation(responseData.data);

						data.value = transformed;

						// Cache individual device results
						for (const deviceResult of transformed.devices) {
							deviceResults.value[deviceResult.deviceId] = deviceResult;
						}

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

		const get = async (payload: { id: string }): Promise<IDeviceValidationResult> => {
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
						const transformed = transformDeviceResult(responseData.data);

						deviceResults.value[transformed.deviceId] = transformed;

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
			deviceResults.value = {};
			firstLoad.value = false;
		};

		return {
			semaphore,
			firstLoad,
			data,
			deviceResults,
			firstLoadFinished,
			fetching,
			getting,
			getValidation,
			getDeviceValidation,
			fetch,
			get,
			clear,
		};
	}
);

export const registerDevicesValidationStore = (pinia: Pinia): Store<string, IDevicesValidationStoreState, object, IDevicesValidationStoreActions> => {
	return useDevicesValidationStore(pinia);
};

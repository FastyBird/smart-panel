import { computed, type ComputedRef, type Ref } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import { devicesValidationStoreKey } from '../store/keys';
import type { IDeviceValidationResult, IDevicesValidation, IValidationSummary } from '../store/devices.validation.store';

export interface IUseDevicesValidation {
	validation: ComputedRef<IDevicesValidation | null>;
	summary: ComputedRef<IValidationSummary | null>;
	invalidDevices: ComputedRef<IDeviceValidationResult[]>;
	isLoading: ComputedRef<boolean>;
	isLoaded: ComputedRef<boolean>;
	fetchValidation: () => Promise<void>;
	getDeviceValidation: (deviceId: string) => IDeviceValidationResult | null;
	isDeviceValid: (deviceId: string) => boolean | null;
	getDeviceIssueCount: (deviceId: string) => number;
}

export const useDevicesValidation = (): IUseDevicesValidation => {
	const storesManager = injectStoresManager();

	const validationStore = storesManager.getStore(devicesValidationStoreKey);

	const { data, semaphore, firstLoad, deviceResults } = storeToRefs(validationStore);

	const validation = computed<IDevicesValidation | null>(() => data.value);

	const summary = computed<IValidationSummary | null>(() => data.value?.summary ?? null);

	const invalidDevices = computed<IDeviceValidationResult[]>(() => {
		if (!data.value) {
			return [];
		}
		return data.value.devices.filter((device) => !device.isValid);
	});

	const isLoading = computed<boolean>(() => semaphore.value.fetching.items);

	const isLoaded = computed<boolean>(() => firstLoad.value);

	const fetchValidation = async (): Promise<void> => {
		await validationStore.fetch();
	};

	const getDeviceValidation = (deviceId: string): IDeviceValidationResult | null => {
		return deviceResults.value[deviceId] ?? null;
	};

	const isDeviceValid = (deviceId: string): boolean | null => {
		const result = deviceResults.value[deviceId];
		return result ? result.isValid : null;
	};

	const getDeviceIssueCount = (deviceId: string): number => {
		const result = deviceResults.value[deviceId];
		return result ? result.issues.length : 0;
	};

	return {
		validation,
		summary,
		invalidDevices,
		isLoading,
		isLoaded,
		fetchValidation,
		getDeviceValidation,
		isDeviceValid,
		getDeviceIssueCount,
	};
};

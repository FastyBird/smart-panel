import { type ComputedRef, computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import type { IDeviceValidationResult, IValidationIssue } from '../store/devices.validation.store';
import { devicesValidationStoreKey } from '../store/keys';

export interface IUseDeviceValidation {
	validation: ComputedRef<IDeviceValidationResult | null>;
	isValid: ComputedRef<boolean | null>;
	issues: ComputedRef<IValidationIssue[]>;
	errorCount: ComputedRef<number>;
	warningCount: ComputedRef<number>;
	isLoading: ComputedRef<boolean>;
	fetchValidation: () => Promise<void>;
}

interface IUseDeviceValidationProps {
	id: string | ComputedRef<string>;
}

export const useDeviceValidation = ({ id }: IUseDeviceValidationProps): IUseDeviceValidation => {
	const storesManager = injectStoresManager();

	const validationStore = storesManager.getStore(devicesValidationStoreKey);

	const { semaphore } = storeToRefs(validationStore);

	const validation = computed<IDeviceValidationResult | null>(() => {
		return validationStore.findById(typeof id === 'string' ? id : id.value);
	});

	const isValid = computed<boolean | null>(() => {
		const result = validationStore.findById(typeof id === 'string' ? id : id.value);
		return result ? result.isValid : null;
	});

	const issues = computed<IValidationIssue[]>(() => {
		const result = validationStore.findById(typeof id === 'string' ? id : id.value);
		return result ? result.issues : [];
	});

	const errorCount = computed<number>(() => {
		const result = validationStore.findById(typeof id === 'string' ? id : id.value);
		if (!result) return 0;
		return result.issues.filter((issue) => issue.severity === 'error').length;
	});

	const warningCount = computed<number>(() => {
		const result = validationStore.findById(typeof id === 'string' ? id : id.value);
		if (!result) return 0;
		return result.issues.filter((issue) => issue.severity === 'warning').length;
	});

	const isLoading = computed<boolean>(() => {
		return semaphore.value.fetching.item.includes(typeof id === 'string' ? id : id.value);
	});

	const fetchValidation = async (): Promise<void> => {
		await validationStore.get({ id: typeof id === 'string' ? id : id.value });
	};

	return {
		validation,
		isValid,
		issues,
		errorCount,
		warningCount,
		isLoading,
		fetchValidation,
	};
};

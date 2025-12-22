import { computed, type ComputedRef } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import { devicesValidationStoreKey } from '../store/keys';
import type { IDeviceValidationResult, IValidationIssue } from '../store/devices.validation.store';

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
	id: string;
}

export const useDeviceValidation = ({ id }: IUseDeviceValidationProps): IUseDeviceValidation => {
	const storesManager = injectStoresManager();

	const validationStore = storesManager.getStore(devicesValidationStoreKey);

	const { semaphore } = storeToRefs(validationStore);

	const validation = computed<IDeviceValidationResult | null>(() => {
		return validationStore.findById(id);
	});

	const isValid = computed<boolean | null>(() => {
		const result = validationStore.findById(id);
		return result ? result.isValid : null;
	});

	const issues = computed<IValidationIssue[]>(() => {
		const result = validationStore.findById(id);
		return result ? result.issues : [];
	});

	const errorCount = computed<number>(() => {
		const result = validationStore.findById(id);
		if (!result) return 0;
		return result.issues.filter((issue) => issue.severity === 'error').length;
	});

	const warningCount = computed<number>(() => {
		const result = validationStore.findById(id);
		if (!result) return 0;
		return result.issues.filter((issue) => issue.severity === 'warning').length;
	});

	const isLoading = computed<boolean>(() => {
		return semaphore.value.fetching.item.includes(id);
	});

	const fetchValidation = async (): Promise<void> => {
		await validationStore.get({ id });
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

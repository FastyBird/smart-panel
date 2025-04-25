import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import { throttleStatusStoreKey } from '../store/keys';
import type { IThrottleStatus } from '../store/throttle-status.store.types';

import type { IUseThrottleStatus } from './types';

export const useThrottleStatus = (): IUseThrottleStatus => {
	const storesManager = injectStoresManager();

	const throttleStatusStore = storesManager.getStore(throttleStatusStoreKey);

	const { data, semaphore } = storeToRefs(throttleStatusStore);

	const throttleStatus = computed<IThrottleStatus | null>((): IThrottleStatus | null => {
		return data.value;
	});

	const fetchThrottleStatus = async (): Promise<void> => {
		await throttleStatusStore.get();
	};

	const isLoading = computed<boolean>((): boolean => {
		if (data.value !== null) {
			return false;
		}

		return semaphore.value.getting;
	});

	return {
		throttleStatus,
		isLoading,
		fetchThrottleStatus,
	};
};

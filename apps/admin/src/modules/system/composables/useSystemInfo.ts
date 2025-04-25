import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import { systemInfoStoreKey } from '../store/keys';
import type { ISystemInfo } from '../store/system-info.store.types';

import type { IUseSystemInfo } from './types';

export const useSystemInfo = (): IUseSystemInfo => {
	const storesManager = injectStoresManager();

	const systemInfoStore = storesManager.getStore(systemInfoStoreKey);

	const { data, semaphore } = storeToRefs(systemInfoStore);

	const systemInfo = computed<ISystemInfo | null>((): ISystemInfo | null => {
		return data.value;
	});

	const fetchSystemInfo = async (): Promise<void> => {
		await systemInfoStore.get();
	};

	const isLoading = computed<boolean>((): boolean => {
		if (data.value !== null) {
			return false;
		}

		return semaphore.value.getting;
	});

	return {
		systemInfo,
		isLoading,
		fetchSystemInfo,
	};
};

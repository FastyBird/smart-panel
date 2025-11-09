import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import { statsStoreKey } from '../store/keys';
import type { IStats } from '../store/stats.store.types';

import type { IUseStats } from './types';

export const useStats = (): IUseStats => {
	const storesManager = injectStoresManager();

	const statsStore = storesManager.getStore(statsStoreKey);

	const { data, semaphore } = storeToRefs(statsStore);

	const stats = computed<IStats | null>((): IStats | null => {
		return data.value;
	});

	const fetchStats = async (): Promise<void> => {
		await statsStore.get();
	};

	const isLoading = computed<boolean>((): boolean => {
		if (data.value !== null) {
			return false;
		}

		return semaphore.value.getting;
	});

	return {
		stats,
		isLoading,
		fetchStats,
	};
};

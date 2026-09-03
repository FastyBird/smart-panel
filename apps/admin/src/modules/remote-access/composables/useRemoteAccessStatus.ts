import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import { remoteAccessStatusStoreKey } from '../store/keys';
import type { IRemoteAccessAdvisory, IRemoteAccessStatus } from '../store/remote-access-status.store.types';

import type { IUseRemoteAccessStatus } from './types';

export const useRemoteAccessStatus = (): IUseRemoteAccessStatus => {
	const storesManager = injectStoresManager();

	const remoteAccessStatusStore = storesManager.getStore(remoteAccessStatusStoreKey);

	const { data, semaphore } = storeToRefs(remoteAccessStatusStore);

	const status = computed<IRemoteAccessStatus | null>((): IRemoteAccessStatus | null => data.value);

	const enabled = computed<boolean>((): boolean => data.value?.enabled ?? false);

	const advisories = computed<IRemoteAccessAdvisory[]>((): IRemoteAccessAdvisory[] => data.value?.advisories ?? []);

	const isLoading = computed<boolean>((): boolean => {
		if (data.value !== null) {
			return false;
		}

		return semaphore.value.getting;
	});

	const fetchStatus = async (): Promise<void> => {
		await remoteAccessStatusStore.get();
	};

	return {
		status,
		enabled,
		advisories,
		isLoading,
		fetchStatus,
	};
};

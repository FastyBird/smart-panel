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

	// Whether at least one external URL is currently published - distinct from `enabled`: a module
	// can be enabled with no provider connected yet (or no external URL configured), which the
	// status banner (D12) reports as its own "reachable but not yet" case, separate from both
	// "disabled" and a posture advisory.
	const hasExternalUrl = computed<boolean>((): boolean => (data.value?.urls.external.length ?? 0) > 0);

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
		hasExternalUrl,
		isLoading,
		fetchStatus,
	};
};

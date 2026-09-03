import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import { remoteAccessStatusStoreKey } from '../store/keys';
import type { IRemoteAccessEndpoint } from '../store/remote-access-status.store.types';

import type { IUseRemoteAccessUrls } from './types';

export const useRemoteAccessUrls = (): IUseRemoteAccessUrls => {
	const storesManager = injectStoresManager();

	const remoteAccessStatusStore = storesManager.getStore(remoteAccessStatusStoreKey);

	const { data, semaphore } = storeToRefs(remoteAccessStatusStore);

	const internal = computed<string | null>((): string | null => data.value?.urls.internal ?? null);

	const candidates = computed<string[]>((): string[] => data.value?.urls.candidates ?? []);

	// Already ranked by the backend: HTTPS before HTTP, public before private, then registration
	// order. This composable renders that order as given rather than re-sorting it.
	const external = computed<IRemoteAccessEndpoint[]>((): IRemoteAccessEndpoint[] => data.value?.urls.external ?? []);

	const primary = computed<string | null>((): string | null => data.value?.urls.primary ?? null);

	const isLoading = computed<boolean>((): boolean => {
		if (data.value !== null) {
			return false;
		}

		return semaphore.value.getting;
	});

	const fetchUrls = async (): Promise<void> => {
		await remoteAccessStatusStore.get();
	};

	return {
		internal,
		candidates,
		external,
		primary,
		isLoading,
		fetchUrls,
	};
};

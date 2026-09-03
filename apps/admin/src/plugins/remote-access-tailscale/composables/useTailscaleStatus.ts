import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import { tailscaleStatusStoreKey } from '../store/keys';
import type { ITailscaleRequirement, ITailscaleStatus } from '../store/tailscale-status.store.types';

import type { IUseTailscaleStatus } from './types';

/**
 * Fetches the Tailscale node status and stays current from there through
 * `RemoteAccessModule.Provider.Status` events (handled by the store's `onEvent()`, wired up once
 * in `remote-access-tailscale.plugin.ts`) - this composable itself never polls.
 */
export const useTailscaleStatus = (): IUseTailscaleStatus => {
	const storesManager = injectStoresManager();

	const tailscaleStatusStore = storesManager.getStore(tailscaleStatusStoreKey);

	const { data, semaphore } = storeToRefs(tailscaleStatusStore);

	const status = computed<ITailscaleStatus | null>((): ITailscaleStatus | null => data.value);

	const requirements = computed<ITailscaleRequirement[]>((): ITailscaleRequirement[] => data.value?.requirements ?? []);

	const isLoading = computed<boolean>((): boolean => {
		if (data.value !== null) {
			return false;
		}

		return semaphore.value.getting;
	});

	const isLoggingOut = computed<boolean>((): boolean => semaphore.value.loggingOut);

	const isResettingPreferences = computed<boolean>((): boolean => semaphore.value.resettingPreferences);

	const fetchStatus = async (): Promise<void> => {
		await tailscaleStatusStore.get();
	};

	const logout = (): Promise<ITailscaleStatus> => tailscaleStatusStore.logout();

	const resetPreferences = (): Promise<ITailscaleStatus> => tailscaleStatusStore.resetPreferences();

	return {
		status,
		requirements,
		isLoading,
		isLoggingOut,
		isResettingPreferences,
		fetchStatus,
		logout,
		resetPreferences,
	};
};

import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import { tailscaleStatusStoreKey } from '../store/keys';
import type { ITailscalePrivilegedSetup, ITailscaleRequirement, ITailscaleSetupJob, ITailscaleStatus } from '../store/tailscale-status.store.types';

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

	// Last known privileged setup job (D12/RA-22) - lets the wizard poll `GET /status` as a
	// fallback to the `Setup.Progress` websocket event and resume its progress view after a page
	// reload, purely from whatever this field already holds.
	const setup = computed<ITailscaleSetupJob | null>((): ITailscaleSetupJob | null => data.value?.setup ?? null);

	// Whether a privileged setup job can run on this installation right now (D12) - `null` only
	// before the first successful fetch; once loaded, the backend always includes this field.
	const privilegedSetup = computed<ITailscalePrivilegedSetup | null>((): ITailscalePrivilegedSetup | null => data.value?.privilegedSetup ?? null);

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
		setup,
		privilegedSetup,
		isLoading,
		isLoggingOut,
		isResettingPreferences,
		fetchStatus,
		logout,
		resetPreferences,
	};
};

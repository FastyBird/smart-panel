import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import type {
	ICloudflareTunnelPrivilegedSetup,
	ICloudflareTunnelRequirement,
	ICloudflareTunnelSetupJob,
	ICloudflareTunnelStatus,
} from '../store/cloudflare-tunnel-status.store.types';
import { cloudflareTunnelStatusStoreKey } from '../store/keys';

import type { IUseCloudflareTunnelStatus } from './types';

/**
 * Fetches the Cloudflare Tunnel status and stays current from there through
 * `RemoteAccessModule.Provider.Status` events (handled by the store's `onEvent()`, wired up once
 * in `remote-access-cloudflare-tunnel.plugin.ts`) - this composable itself never polls. Mirrors
 * `useTailscaleStatus`.
 */
export const useCloudflareTunnelStatus = (): IUseCloudflareTunnelStatus => {
	const storesManager = injectStoresManager();

	const cloudflareTunnelStatusStore = storesManager.getStore(cloudflareTunnelStatusStoreKey);

	const { data, semaphore } = storeToRefs(cloudflareTunnelStatusStore);

	const status = computed<ICloudflareTunnelStatus | null>((): ICloudflareTunnelStatus | null => data.value);

	const requirements = computed<ICloudflareTunnelRequirement[]>((): ICloudflareTunnelRequirement[] => data.value?.requirements ?? []);

	// Last known privileged setup job (D12/D6) - lets the wizard poll `GET /status` as a fallback
	// to the `Setup.Progress` websocket event and resume its progress view after a page reload.
	const setup = computed<ICloudflareTunnelSetupJob | null>((): ICloudflareTunnelSetupJob | null => data.value?.setup ?? null);

	// Whether a privileged setup job can run on this installation right now (D12) - `null` only
	// before the first successful fetch; once loaded, the backend always includes this field.
	const privilegedSetup = computed<ICloudflareTunnelPrivilegedSetup | null>(
		(): ICloudflareTunnelPrivilegedSetup | null => data.value?.privilegedSetup ?? null
	);

	const isLoading = computed<boolean>((): boolean => {
		if (data.value !== null) {
			return false;
		}

		return semaphore.value.getting;
	});

	const isResetting = computed<boolean>((): boolean => semaphore.value.resetting);

	const fetchStatus = async (): Promise<void> => {
		await cloudflareTunnelStatusStore.get();
	};

	const reset = (): Promise<ICloudflareTunnelStatus> => cloudflareTunnelStatusStore.reset();

	return {
		status,
		requirements,
		setup,
		privilegedSetup,
		isLoading,
		isResetting,
		fetchStatus,
		reset,
	};
};

import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import { useRemoteAccessStatusReconciliation } from '../../../modules/remote-access/composables/useRemoteAccessStatusReconciliation';
import type {
	ICloudflareTunnelPrivilegedSetup,
	ICloudflareTunnelRequirement,
	ICloudflareTunnelSetupJob,
	ICloudflareTunnelStatus,
} from '../store/cloudflare-tunnel-status.store.types';
import { cloudflareTunnelStatusStoreKey } from '../store/keys';

import type { IUseCloudflareTunnelStatus } from './types';

/** Keeps provider metadata current with public events and bounded REST reconciliation. */
export const useCloudflareTunnelStatus = (): IUseCloudflareTunnelStatus => {
	const storesManager = injectStoresManager();

	const cloudflareTunnelStatusStore = storesManager.getStore(cloudflareTunnelStatusStoreKey);

	const { data, semaphore } = storeToRefs(cloudflareTunnelStatusStore);

	useRemoteAccessStatusReconciliation(cloudflareTunnelStatusStore, { data, semaphore });

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

	const refreshStatus = async (): Promise<void> => {
		await cloudflareTunnelStatusStore.refresh();
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
		refreshStatus,
		reset,
	};
};

import { computed, onScopeDispose, watch } from 'vue';

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

/** Keeps provider metadata current with public events and bounded REST reconciliation. */
export const useCloudflareTunnelStatus = (): IUseCloudflareTunnelStatus => {
	const storesManager = injectStoresManager();

	const cloudflareTunnelStatusStore = storesManager.getStore(cloudflareTunnelStatusStoreKey);

	const { data, semaphore } = storeToRefs(cloudflareTunnelStatusStore);

	// Public events omit private administrative fields. Reconcile once on a new event,
	// every 5 seconds while work progresses, and every 30 seconds for lost-event recovery.
	// GET commits happen while `getting` is true, so they cannot trigger a read/event loop.
	let lastReconciliation = Date.now();
	const reconcile = (): void => {
		if (semaphore.value.getting) return;
		lastReconciliation = Date.now();
		void cloudflareTunnelStatusStore.get().catch(() => {
			/* Retry on the next bounded tick. */
		});
	};
	watch([() => data.value?.epoch, () => data.value?.revision], reconcile, { flush: 'sync' });
	const reconciliationTimer = setInterval((): void => {
		const progressing = ['connecting', 'pending-auth', 'pending-approval'].includes(data.value?.state ?? '');
		if (progressing || Date.now() - lastReconciliation >= 30_000) reconcile();
	}, 5_000);
	onScopeDispose(() => clearInterval(reconciliationTimer));

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

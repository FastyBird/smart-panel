import { computed, onScopeDispose, watch } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import { tailscaleStatusStoreKey } from '../store/keys';
import type { ITailscalePrivilegedSetup, ITailscaleRequirement, ITailscaleSetupJob, ITailscaleStatus } from '../store/tailscale-status.store.types';

import type { IUseTailscaleStatus } from './types';

/** Keeps provider metadata current with public events and bounded REST reconciliation. */
export const useTailscaleStatus = (): IUseTailscaleStatus => {
	const storesManager = injectStoresManager();

	const tailscaleStatusStore = storesManager.getStore(tailscaleStatusStoreKey);

	const { data, semaphore } = storeToRefs(tailscaleStatusStore);

	// Public events omit private administrative fields. Reconcile once on a new event,
	// every 5 seconds while work progresses, and every 30 seconds for lost-event recovery.
	// GET commits happen while `getting` is true, so they cannot trigger a read/event loop.
	let lastReconciliation = Date.now();
	const reconcile = (): void => {
		if (semaphore.value.getting) return;
		lastReconciliation = Date.now();
		void tailscaleStatusStore.get().catch(() => {
			/* Retry on the next bounded tick. */
		});
	};
	watch([() => data.value?.epoch, () => data.value?.revision], reconcile, { flush: 'sync' });
	const reconciliationTimer = setInterval((): void => {
		const progressing =
			(data.value?.control?.operation !== null && data.value?.control?.operation !== undefined) ||
			['connecting', 'pending-auth', 'pending-approval'].includes(data.value?.state ?? '');
		if (progressing || Date.now() - lastReconciliation >= 30_000) reconcile();
	}, 5_000);
	onScopeDispose(() => clearInterval(reconciliationTimer));

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

	const isConnecting = computed<boolean>(() => semaphore.value.connecting);
	const isDisconnecting = computed<boolean>(() => semaphore.value.disconnecting);

	const isLoggingOut = computed<boolean>((): boolean => semaphore.value.loggingOut);

	const isResettingPreferences = computed<boolean>((): boolean => semaphore.value.resettingPreferences);

	const fetchStatus = async (): Promise<void> => {
		await tailscaleStatusStore.get();
	};

	const refreshStatus = async (): Promise<void> => {
		await tailscaleStatusStore.refresh();
	};

	const connect = (): Promise<ITailscaleStatus> => tailscaleStatusStore.connect();
	const disconnect = (): Promise<ITailscaleStatus> => tailscaleStatusStore.disconnect();

	const logout = (): Promise<ITailscaleStatus> => tailscaleStatusStore.logout();

	const resetPreferences = (): Promise<ITailscaleStatus> => tailscaleStatusStore.resetPreferences();

	return {
		status,
		requirements,
		setup,
		privilegedSetup,
		isLoading,
		isConnecting,
		isDisconnecting,
		isLoggingOut,
		isResettingPreferences,
		fetchStatus,
		refreshStatus,
		connect,
		disconnect,
		logout,
		resetPreferences,
	};
};

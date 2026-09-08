import { computed, ref, watch } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import { CLOUDFLARE_TUNNEL_SETUP_POLL_INTERVAL_MS } from '../remote-access-cloudflare-tunnel.constants';
import type { ICloudflareTunnelSetupProgress } from '../store/cloudflare-tunnel-status.store.types';
import { cloudflareTunnelStatusStoreKey } from '../store/keys';

import type { IUseCloudflareTunnelSetup } from './types';

// Module-level singleton poll handle - mirrors `useTailscaleSetup.ts`: one interval regardless of
// how many components call this composable, so a stray extra mount can never start a second poll
// racing the first. The setup wizard is the only consumer today and only ever has one instance
// open at a time, but the guard costs nothing.
let pollTimer: ReturnType<typeof setInterval> | null = null;
const polling = ref<boolean>(false);

/**
 * Starts the privileged setup job and exposes its live progress - `progress` is updated by the
 * store's `onEvent()` as `RemoteAccessModule.Setup.Progress` events arrive (wired up once in
 * `remote-access-cloudflare-tunnel.plugin.ts`). Alongside that websocket-driven `progress`, this
 * also polls `GET /status` every `CLOUDFLARE_TUNNEL_SETUP_POLL_INTERVAL_MS` while the store's own
 * loaded `data.setup?.state` is `'running'` - a fallback for a lost websocket, and (crucially) the
 * only way a page reload can ever resume the wizard's progress view: the very first `GET /status`
 * this page makes after reloading already carries `setup`, so this watcher (`immediate: true`)
 * starts polling again right away if that job is still running, with no extra endpoint involved.
 * Mirrors `useTailscaleSetup` exactly.
 *
 * `stopPolling` is exposed for the caller to invoke on unmount - the wizard's `onUnmounted` hook
 * calls it, rather than this composable registering `onUnmounted` itself.
 */
export const useCloudflareTunnelSetup = (): IUseCloudflareTunnelSetup => {
	const storesManager = injectStoresManager();

	const cloudflareTunnelStatusStore = storesManager.getStore(cloudflareTunnelStatusStoreKey);

	const { setupProgress, semaphore, data } = storeToRefs(cloudflareTunnelStatusStore);

	const progress = computed<ICloudflareTunnelSetupProgress | null>((): ICloudflareTunnelSetupProgress | null => setupProgress.value);

	const isInstalling = computed<boolean>((): boolean => semaphore.value.installing);

	const stopPolling = (): void => {
		if (pollTimer !== null) {
			clearInterval(pollTimer);
			pollTimer = null;
		}

		polling.value = false;
	};

	const startPolling = (): void => {
		if (pollTimer !== null) {
			return;
		}

		polling.value = true;

		pollTimer = setInterval((): void => {
			cloudflareTunnelStatusStore.get().catch((): void => {
				// A transient poll failure must not stop the poll - only the job reaching a
				// terminal state, or the component unmounting, does.
			});
		}, CLOUDFLARE_TUNNEL_SETUP_POLL_INTERVAL_MS);
	};

	// Driven purely by the loaded status, not by `install()` having been called in this session -
	// this is what lets a page reload resume the progress view: the component that owns this
	// composable fetches status on mount, which updates `data.value.setup`, and this immediate
	// watcher reacts to whatever it finds.
	watch(
		(): string | undefined => data.value?.setup?.state,
		(state): void => {
			if (state === 'running') {
				startPolling();
			} else {
				stopPolling();
			}
		},
		{ immediate: true }
	);

	const install = async (): Promise<string> => {
		const result = await cloudflareTunnelStatusStore.install();

		return result.job;
	};

	return {
		progress,
		isInstalling,
		isPolling: computed<boolean>((): boolean => polling.value),
		install,
		stopPolling,
	};
};

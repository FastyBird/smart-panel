import { computed, ref } from 'vue';

import { injectStoresManager } from '../../../common';
import { TAILSCALE_LOGIN_POLL_INTERVAL_MS, TAILSCALE_LOGIN_POLL_TIMEOUT_MS } from '../remote-access-tailscale.constants';
import { tailscaleStatusStoreKey } from '../store/keys';
import type { ITailscaleLoginResult } from '../store/tailscale-status.store.types';

import type { IUseTailscaleLogin } from './types';

// Module-level singleton poll handle - mirrors `useUpdateStatus.ts`: one interval regardless of
// how many components call this composable, so a stray extra mount can never start a second
// poll racing the first. The setup wizard is the only consumer today and only ever has one
// instance open at a time, but the guard costs nothing.
let pollTimer: ReturnType<typeof setInterval> | null = null;
const polling = ref<boolean>(false);
const loggingIn = ref<boolean>(false);

/**
 * Signs in to Tailscale, with or without a pre-authorised auth key. Without one, the result is
 * `pending-auth` and this starts polling `GET /status` every
 * `TAILSCALE_LOGIN_POLL_INTERVAL_MS` until the node leaves that state, the absolute
 * `TAILSCALE_LOGIN_POLL_TIMEOUT_MS` deadline passes, or the caller stops it explicitly (e.g. the
 * wizard closing, or unmounting).
 */
export const useTailscaleLogin = (): IUseTailscaleLogin => {
	const storesManager = injectStoresManager();

	const tailscaleStatusStore = storesManager.getStore(tailscaleStatusStoreKey);

	const stopPolling = (): void => {
		if (pollTimer !== null) {
			clearInterval(pollTimer);
			pollTimer = null;
		}

		polling.value = false;
	};

	const startPolling = (): void => {
		stopPolling();

		polling.value = true;

		const startedAt = Date.now();

		pollTimer = setInterval((): void => {
			if (Date.now() - startedAt >= TAILSCALE_LOGIN_POLL_TIMEOUT_MS) {
				stopPolling();

				return;
			}

			tailscaleStatusStore
				.get()
				.then((status): void => {
					if (status.state === 'connected' || status.state === 'error') {
						stopPolling();
					}
				})
				.catch((): void => {
					// A transient poll failure must not stop the poll - only a terminal status, an
					// explicit stop, or the absolute timeout above does.
				});
		}, TAILSCALE_LOGIN_POLL_INTERVAL_MS);
	};

	const login = async (authKey?: string): Promise<ITailscaleLoginResult> => {
		loggingIn.value = true;

		try {
			const result = await tailscaleStatusStore.login(authKey);

			if (result.state === 'pending-auth') {
				startPolling();
			} else {
				stopPolling();
			}

			return result;
		} finally {
			loggingIn.value = false;
		}
	};

	return {
		isLoggingIn: computed<boolean>((): boolean => loggingIn.value),
		isPolling: computed<boolean>((): boolean => polling.value),
		login,
		stopPolling,
	};
};

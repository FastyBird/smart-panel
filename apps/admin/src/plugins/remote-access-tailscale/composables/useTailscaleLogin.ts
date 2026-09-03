import { computed, ref } from 'vue';

import { injectStoresManager } from '../../../common';
import { TAILSCALE_LOGIN_POLL_INTERVAL_MS, TAILSCALE_LOGIN_POLL_TIMEOUT_MS } from '../remote-access-tailscale.constants';
import { RemoteAccessTailscaleException } from '../remote-access-tailscale.exceptions';
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

// Identifies the current `login()` call, and the poll it may start. `login()` itself rejects a
// call while one is already in flight (the `loggingIn.value` guard below), but a *poll* from an
// earlier, already-settled attempt can still be ticking in the background when a new `login()`
// starts: the first attempt's own request resolves (to `pending-auth`) and clears `loggingIn`
// long before the node is actually approved, so nothing stops the wizard from starting a second
// attempt while the first one's poll is still running. Every async continuation below - each
// poll tick, and the status check inside it - captures the id it was started with and compares
// it against this before touching any shared state, so a stale attempt can never clear a newer
// attempt's timer or flip `loggingIn`/`polling` off from under it.
let currentAttemptId = 0;

/**
 * Signs in to Tailscale, with or without a pre-authorised auth key. Without one, the result is
 * `pending-auth` and this starts polling `GET /status` every
 * `TAILSCALE_LOGIN_POLL_INTERVAL_MS` until the node leaves that state, the absolute
 * `TAILSCALE_LOGIN_POLL_TIMEOUT_MS` deadline passes, or the caller stops it explicitly (e.g. the
 * wizard closing, or unmounting). A call while a previous one is still in flight is rejected
 * outright - the wizard also disables both sign-in buttons while `isLoggingIn`, so this is a
 * belt-and-braces guard against whatever gets past that (a stray extra click before the button
 * re-renders, a future caller that forgets to check it).
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

	const startPolling = (attemptId: number): void => {
		stopPolling();

		polling.value = true;

		const startedAt = Date.now();

		pollTimer = setInterval((): void => {
			// A newer login() call superseded this one since the interval was set up - nothing
			// left for this attempt to do, and touching shared state here would fight whatever
			// the newer attempt now owns.
			if (attemptId !== currentAttemptId) {
				return;
			}

			if (Date.now() - startedAt >= TAILSCALE_LOGIN_POLL_TIMEOUT_MS) {
				stopPolling();

				return;
			}

			tailscaleStatusStore
				.get()
				.then((status): void => {
					// The tick that fired this request may have started before a newer attempt
					// took over; re-check after the await, not just before it.
					if (attemptId !== currentAttemptId) {
						return;
					}

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
		if (loggingIn.value) {
			throw new RemoteAccessTailscaleException('A Tailscale sign-in is already in progress.');
		}

		// Claimed synchronously, with no `await` between the guard above and this line, so no
		// other `login()` call can ever observe `loggingIn.value` as `false` and slip past the
		// guard while this attempt is in flight - `currentAttemptId` therefore only ever changes
		// here, one call at a time.
		const attemptId = ++currentAttemptId;

		loggingIn.value = true;

		try {
			const result = await tailscaleStatusStore.login(authKey);

			if (result.state === 'pending-auth') {
				startPolling(attemptId);
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

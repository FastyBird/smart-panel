import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { MODULES_PREFIX } from '../../../app.constants';
import { useBackend, useLogger } from '../../../common';
import { CAMERAS_MODULE_PREFIX, RELAY_STATUS_POLL_MS, RELAY_STATUS_TIMEOUT_MS } from '../cameras.constants';
import { CamerasApiException } from '../cameras.exceptions';
import { readErrorMessage } from '../cameras.utils';

import type { IRelayStatus, IRelayStatusStoreActions, IRelayStatusStoreState, RelayStatusStoreSetup } from './relay-status.store.types';
import { transformRelayStatusResponse } from './relay-status.transformers';

export const useRelayStatus = defineStore<'cameras_module-relay_status', RelayStatusStoreSetup>(
	'cameras_module-relay_status',
	(): RelayStatusStoreSetup => {
		const backend = useBackend();
		const logger = useLogger();

		const status = ref<IRelayStatus | null>(null);
		/** The last read failed or timed out, so `status` is the last known one, not the current one. */
		const stale = ref(false);

		let pendingGetPromise: Promise<IRelayStatus> | null = null;

		const get = async (): Promise<IRelayStatus> => {
			if (pendingGetPromise) {
				return pendingGetPromise;
			}

			const getPromise = (async (): Promise<IRelayStatus> => {
				// Without a deadline a stalled read would stay pending, and every later poll would wait on it.
				const controller = new AbortController();
				const deadline = setTimeout((): void => controller.abort(), RELAY_STATUS_TIMEOUT_MS);

				try {
					const {
						data: responseData,
						error,
						response,
					} = await backend.client.GET(`/${MODULES_PREFIX}/${CAMERAS_MODULE_PREFIX}/status`, { signal: controller.signal });

					if (typeof responseData !== 'undefined') {
						status.value = transformRelayStatusResponse(responseData.data);
						stale.value = false;

						return status.value;
					}

					throw new CamerasApiException(readErrorMessage(error) ?? 'Failed to fetch relay status.', response?.status ?? 500);
				} catch (error) {
					stale.value = true;

					throw error;
				} finally {
					clearTimeout(deadline);
				}
			})();

			pendingGetPromise = getPromise;

			try {
				return await getPromise;
			} finally {
				pendingGetPromise = null;
			}
		};

		let holders = 0;
		let timer: ReturnType<typeof setInterval> | null = null;

		const poll = (): void => {
			get().catch((): void => {
				logger.warn('Failed to poll the relay status.');
			});
		};

		const startPolling = (): (() => void) => {
			holders++;

			if (holders === 1) {
				poll();

				timer = setInterval(poll, RELAY_STATUS_POLL_MS);
			}

			let released = false;

			return (): void => {
				if (released) {
					return;
				}

				released = true;
				holders--;

				if (holders === 0 && timer !== null) {
					clearInterval(timer);

					timer = null;
				}
			};
		};

		const isLoaded = (): boolean => status.value !== null;

		const refresh = (): Promise<unknown> => get();

		return { status, stale, get, startPolling, isLoaded, refresh };
	}
);

export const registerRelayStatusStore = (pinia: Pinia): Store<string, IRelayStatusStoreState, object, IRelayStatusStoreActions> => {
	return useRelayStatus(pinia);
};

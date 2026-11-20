import { ref } from 'vue';

import { type Pinia, defineStore } from 'pinia';

import { PLUGINS_PREFIX } from '../../../app.constants';
import { getErrorReason, useBackend, useLogger } from '../../../common';
import type {
	DevicesUnifiProtectPluginGetStatusOperation,
	DevicesUnifiProtectPluginTestConnectionOperation,
	DevicesUnifiProtectPluginTestConnectionRequestSchema,
} from '../../../openapi.constants';
import {
	DEVICES_UNIFI_PROTECT_PLUGIN_PREFIX,
	PROTECT_STATUS_DEADLINE_MS,
	PROTECT_TEST_CONNECTION_DEADLINE_MS,
	STATUS_POLL_MS,
} from '../devices-unifi-protect.constants';
import { ProtectApiException, ProtectTimeoutException } from '../devices-unifi-protect.exceptions';

import { startProtectDeadline } from './protect.deadline';
import { transformProtectStatus, transformProtectTestConnection } from './protect.transformers';
import type { IProtectStatus, IProtectTestResult, IProtectTestTarget, IProtectTestTimeout } from './protect.types';

const isPageVisible = (): boolean => typeof document === 'undefined' || document.visibilityState === 'visible';

export const useProtectStatus = defineStore('devices_unifi_protect_plugin-status', () => {
	const backend = useBackend();
	const logger = useLogger();

	const status = ref<IProtectStatus | null>(null);
	/** The last read failed or timed out, so `status` is the last known one, not the current one. */
	const stale = ref(false);
	/** The latest test and the target it was run for. It never holds the typed API key. */
	const lastTest = ref<IProtectTestResult | null>(null);
	const testing = ref(false);

	let pendingFetch: Promise<IProtectStatus> | null = null;

	const fetch = (): Promise<IProtectStatus> => {
		if (pendingFetch) {
			return pendingFetch;
		}

		const request = (async (): Promise<IProtectStatus> => {
			// Without a deadline a stalled read would stay pending, and every later poll would wait on it.
			const deadline = startProtectDeadline(PROTECT_STATUS_DEADLINE_MS);

			try {
				const { data, error, response } = await backend.client.GET(`/${PLUGINS_PREFIX}/${DEVICES_UNIFI_PROTECT_PLUGIN_PREFIX}/status`, {
					signal: deadline.signal,
				});

				if (data) {
					status.value = transformProtectStatus(data.data);
					stale.value = false;

					return status.value;
				}

				throw new ProtectApiException(
					getErrorReason<DevicesUnifiProtectPluginGetStatusOperation>(error, 'Failed to load UniFi Protect status.'),
					response?.status
				);
			} catch (error) {
				stale.value = true;

				if (deadline.expired()) {
					throw new ProtectTimeoutException('The UniFi Protect status did not answer in time.');
				}

				throw error;
			} finally {
				deadline.clear();
			}
		})();

		pendingFetch = request;

		const release = (): void => {
			pendingFetch = null;
		};

		request.then(release, release);

		return request;
	};

	let testRun = 0;

	const testConnection = async (
		request: DevicesUnifiProtectPluginTestConnectionRequestSchema,
		target: IProtectTestTarget | null
	): Promise<IProtectTestResult | IProtectTestTimeout> => {
		const run = ++testRun;
		const deadline = startProtectDeadline(PROTECT_TEST_CONNECTION_DEADLINE_MS);

		testing.value = true;
		clearLastTest();

		try {
			const { data, error, response } = await backend.client.POST(`/${PLUGINS_PREFIX}/${DEVICES_UNIFI_PROTECT_PLUGIN_PREFIX}/test-connection`, {
				body: request,
				signal: deadline.signal,
			});

			if (data) {
				const result: IProtectTestResult = { result: transformProtectTestConnection(data.data), target, at: Date.now() };

				if (run === testRun) {
					lastTest.value = result;
				}

				return result;
			}

			throw new ProtectApiException(
				getErrorReason<DevicesUnifiProtectPluginTestConnectionOperation>(error, 'Failed to test the UniFi Protect connection.'),
				response?.status
			);
		} catch (error) {
			// The deadline is the client giving up, not a failed test: the console may simply be slow.
			if (deadline.expired()) {
				return { timedOut: true };
			}

			throw error;
		} finally {
			deadline.clear();

			if (run === testRun) {
				testing.value = false;
			}
		}
	};

	const clearLastTest = (): void => {
		lastTest.value = null;
	};

	let holders = 0;
	let timer: ReturnType<typeof setInterval> | null = null;

	const poll = (): void => {
		fetch().catch((): void => {
			logger.warn('Failed to poll the UniFi Protect status.');
		});
	};

	const stopTimer = (): void => {
		if (timer !== null) {
			clearInterval(timer);

			timer = null;
		}
	};

	const startTimer = (): void => {
		if (timer === null) {
			timer = setInterval(poll, STATUS_POLL_MS);
		}
	};

	const onVisibilityChange = (): void => {
		if (isPageVisible()) {
			poll();
			startTimer();
		} else {
			stopTimer();
		}
	};

	const startPolling = (): (() => void) => {
		holders++;

		if (holders === 1) {
			document.addEventListener('visibilitychange', onVisibilityChange);

			if (isPageVisible()) {
				poll();
				startTimer();
			}
		}

		let released = false;

		return (): void => {
			if (released) {
				return;
			}

			released = true;
			holders--;

			if (holders === 0) {
				stopTimer();

				document.removeEventListener('visibilitychange', onVisibilityChange);
			}
		};
	};

	const isLoaded = (): boolean => status.value !== null;

	const refresh = (): Promise<unknown> => fetch();

	return { status, stale, lastTest, testing, fetch, testConnection, clearLastTest, startPolling, isLoaded, refresh };
});

export const registerProtectStatusStore = (pinia: Pinia): ReturnType<typeof useProtectStatus> => useProtectStatus(pinia);

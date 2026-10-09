import { computed, getCurrentScope, ref } from 'vue';

import { tryOnScopeDispose } from '@vueuse/core';

import { MODULES_PREFIX } from '../../../app.constants';
import { useBackend } from '../../../common';
import { onUpdateEvent } from '../services/update-events.service';
import { SYSTEM_MODULE_PREFIX } from '../system.constants';

import type { IUseUpdateStatus } from './types';

const UPDATE_STATUS_PATH = `/${MODULES_PREFIX}/${SYSTEM_MODULE_PREFIX}/system/update/status` as const;
const UPDATE_CHECK_PATH = `/${MODULES_PREFIX}/${SYSTEM_MODULE_PREFIX}/system/update/check` as const;
const UPDATE_INSTALL_PATH = `/${MODULES_PREFIX}/${SYSTEM_MODULE_PREFIX}/system/update/install` as const;

// Deduplication for concurrent fetchStatus calls
let fetchPromise: Promise<void> | null = null;
let lastFetchTimestamp = 0;
let lastFetchGeneration = -1;
const FETCH_DEBOUNCE_MS = 5_000;

// Shared singleton refs — all callers share the same reactive state
const currentVersion = ref<string | null>(null);
const latestVersion = ref<string | null>(null);
const updateAvailable = ref<boolean>(false);
const updateType = ref<'patch' | 'minor' | 'major' | null>(null);
const lastChecked = ref<Date | null>(null);
const changelogUrl = ref<string | null>(null);

const status = ref<string>('idle');
const phase = ref<string | null>(null);
const progressPercent = ref<number | null>(null);
const error = ref<string | null>(null);

const loading = ref<boolean>(false);
const installing = ref<boolean>(false);
const waitingForRestart = ref<boolean>(false);

// One serial observer for the shared state. Connectivity loss never establishes an
// update failure; keep observing until the backend settles or the last consumer leaves.
let reconnectPollTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectRequestTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectController: AbortController | null = null;
let observerGeneration = 0;
let monitoring = false;
let activeConsumers = 0;
const RECONNECT_POLL_INTERVAL_MS = 4_000;
const RECONNECT_POLL_MAX_INTERVAL_MS = 30_000;
const RECONNECT_REQUEST_TIMEOUT_MS = 10_000;

// Simulated progress remains below completion while status is unconfirmed.
let progressTickTimer: ReturnType<typeof setInterval> | null = null;
const PROGRESS_TICK_INTERVAL_MS = 2_000;
const PROGRESS_MAX_SIMULATED = 90;

const stopProgressTick = (): void => {
	if (progressTickTimer !== null) {
		clearInterval(progressTickTimer);
		progressTickTimer = null;
	}
};

const startProgressTick = (): void => {
	if (progressTickTimer !== null) {
		return;
	}

	progressTickTimer = setInterval(() => {
		const current = progressPercent.value ?? 45;

		if (current >= PROGRESS_MAX_SIMULATED) {
			stopProgressTick();
		} else {
			const remaining = PROGRESS_MAX_SIMULATED - current;
			const step = Math.max(1, Math.floor(remaining * 0.15));

			progressPercent.value = Math.min(PROGRESS_MAX_SIMULATED, current + step);
		}
	}, PROGRESS_TICK_INTERVAL_MS);
};

const stopReconnectPoll = (): void => {
	observerGeneration += 1;
	monitoring = false;
	stopProgressTick();

	if (reconnectPollTimer !== null) {
		clearTimeout(reconnectPollTimer);
		reconnectPollTimer = null;
	}

	if (reconnectRequestTimer !== null) {
		clearTimeout(reconnectRequestTimer);
		reconnectRequestTimer = null;
	}

	reconnectController?.abort();
	reconnectController = null;
};

const isUpdating = computed<boolean>((): boolean => {
	return ['downloading', 'stopping', 'installing', 'migrating', 'starting'].includes(status.value);
});

const applyInfoResponse = (data: Record<string, unknown>): void => {
	currentVersion.value = (data.current_version as string) ?? null;
	latestVersion.value = (data.latest_version as string) ?? null;
	updateAvailable.value = (data.update_available as boolean) ?? false;
	updateType.value = (data.update_type as 'patch' | 'minor' | 'major' | null) ?? null;
	lastChecked.value = data.last_checked ? new Date(data.last_checked as string) : null;
	changelogUrl.value = (data.changelog_url as string) ?? null;

	// Apply process status fields if present in the response
	if (data.status !== undefined) {
		status.value = data.status as string;
	}

	if (data.phase !== undefined) {
		phase.value = data.phase as string | null;
	}

	if (data.progress_percent !== undefined) {
		progressPercent.value = data.progress_percent as number | null;
	}

	if (data.error !== undefined) {
		const rawError = data.error as string | null;

		error.value = rawError === null ? null : 'systemModule.messages.update.updateFailed';
	}

	// Update installing state
	installing.value = isUpdating.value;
};

const applyStatusEvent = (payload: Record<string, unknown>): void => {
	if (payload.update_available !== undefined) {
		updateAvailable.value = payload.update_available as boolean;
	}

	if (payload.latest_version !== undefined) {
		latestVersion.value = payload.latest_version as string | null;
	}

	if (payload.current_version !== undefined) {
		currentVersion.value = payload.current_version as string | null;
	}

	if (payload.update_type !== undefined) {
		updateType.value = payload.update_type as 'patch' | 'minor' | 'major' | null;
	}

	if (payload.status !== undefined) {
		status.value = payload.status as string;
	}

	if (payload.phase !== undefined) {
		phase.value = payload.phase as string | null;
	}

	if (payload.progress_percent !== undefined) {
		progressPercent.value = payload.progress_percent as number | null;
	}

	if (payload.error !== undefined) {
		const rawError = payload.error as string | null;

		error.value = rawError === null ? null : 'systemModule.messages.update.updateFailed';
	}

	// A terminal socket event is authoritative, including during an outstanding GET.
	if (status.value === 'complete' || status.value === 'failed') {
		stopReconnectPoll();
		waitingForRestart.value = false;
	}

	// Update installing state
	installing.value = isUpdating.value;
};

// Module-level singleton subscription — keep the unsubscribe handle so Vite HMR
// can clean up the stale listener before re-registering on module re-evaluation.
const unsubscribe = onUpdateEvent(applyStatusEvent);

if (import.meta.hot) {
	import.meta.hot.dispose(() => {
		unsubscribe();
		stopReconnectPoll();
	});
}

export const useUpdateStatus = (): IUseUpdateStatus => {
	const backend = useBackend();
	let disposed = false;

	const fetchStatus = async (): Promise<void> => {
		if (disposed) {
			return;
		}

		// Returning during the outage must resume observation even if this GET fails
		// or is deduplicated against the previous consumer's request.
		if (isUpdating.value && !monitoring) {
			startReconnectPoll();
		}

		const generation = observerGeneration;
		const now = Date.now();

		// Share only requests from the current observer generation. A request left
		// behind by disposal or a terminal event cannot serve a returning consumer.
		if (fetchPromise && lastFetchGeneration === generation) {
			return fetchPromise;
		}

		if (lastFetchGeneration === generation && now - lastFetchTimestamp < FETCH_DEBOUNCE_MS) {
			return;
		}

		loading.value = true;
		lastFetchTimestamp = now;
		lastFetchGeneration = generation;

		fetchPromise = (async () => {
			try {
				const { data: responseData } = await backend.client.GET(UPDATE_STATUS_PATH);

				if (generation === observerGeneration && responseData?.data) {
					applyInfoResponse(responseData.data);

					if (status.value === 'complete' || status.value === 'failed') {
						waitingForRestart.value = false;
						stopReconnectPoll();
					} else if (isUpdating.value && !monitoring) {
						startReconnectPoll();
					}
				}
			} catch {
				// Silently fail - endpoint may not exist yet
			} finally {
				// A superseded request must not clear the newer shared request.
				if (lastFetchGeneration === generation) {
					loading.value = false;
					fetchPromise = null;
				}
			}
		})();

		return fetchPromise;
	};

	const checkForUpdates = async (): Promise<void> => {
		loading.value = true;

		try {
			const { data: responseData } = await backend.client.POST(UPDATE_CHECK_PATH);

			if (responseData?.data) {
				applyInfoResponse(responseData.data);
			}
		} catch (err) {
			error.value = 'systemModule.messages.update.checkFailed';

			throw err;
		} finally {
			loading.value = false;
		}
	};

	const startReconnectPoll = (): void => {
		stopReconnectPoll();
		monitoring = true;
		const generation = observerGeneration;
		const targetVersion = latestVersion.value;
		let delay = RECONNECT_POLL_INTERVAL_MS;
		const isCurrent = (): boolean => generation === observerGeneration;

		const poll = async (): Promise<void> => {
			if (!isCurrent()) {
				return;
			}

			reconnectPollTimer = null;
			const controller = new AbortController();
			reconnectController = controller;
			const requestTimer = setTimeout(() => controller.abort(), RECONNECT_REQUEST_TIMEOUT_MS);
			reconnectRequestTimer = requestTimer;

			try {
				const { data: responseData } = await backend.client.GET(UPDATE_STATUS_PATH, { signal: controller.signal });

				if (!isCurrent()) {
					return;
				}

				if (controller.signal.aborted || !responseData?.data) {
					throw new Error('Update status unavailable');
				}

				const typedData = responseData.data as Record<string, unknown>;
				const responseStatus = typedData.status as string | undefined;

				applyInfoResponse(typedData);

				if (responseStatus === 'complete' || responseStatus === 'failed') {
					phase.value = null;
					installing.value = false;
					waitingForRestart.value = false;

					if (responseStatus === 'complete') {
						error.value = null;
						progressPercent.value = 100;
					} else {
						error.value = error.value || 'systemModule.messages.update.updateFailed';
					}

					stopReconnectPoll();
				} else if (!responseStatus || responseStatus === 'idle') {
					// Compatibility with backends that clear the completed status on restart.
					if (typedData.current_version && targetVersion && typedData.current_version === targetVersion) {
						status.value = 'complete';
						error.value = null;
						progressPercent.value = 100;
					}

					phase.value = null;
					installing.value = false;
					waitingForRestart.value = false;
					stopReconnectPoll();
				} else {
					stopProgressTick();
					waitingForRestart.value = false;
					delay = RECONNECT_POLL_INTERVAL_MS;
				}
			} catch {
				if (!isCurrent()) {
					return;
				}

				waitingForRestart.value = true;
				startProgressTick();
				delay = Math.min(delay * 2, RECONNECT_POLL_MAX_INTERVAL_MS);
			} finally {
				clearTimeout(requestTimer);

				if (isCurrent()) {
					reconnectController = null;
					reconnectRequestTimer = null;
					reconnectPollTimer = setTimeout(() => void poll(), delay);
				}
			}
		};

		reconnectPollTimer = setTimeout(() => void poll(), delay);
	};

	// Shared polling stays alive while any scoped consumer needs it. The final
	// disposal also cancels an in-flight POST/GET through the generation guard.
	if (getCurrentScope()) {
		activeConsumers += 1;

		tryOnScopeDispose(() => {
			disposed = true;
			activeConsumers -= 1;

			if (activeConsumers === 0) {
				stopReconnectPoll();
			}
		});
	}

	const installUpdate = async (allowMajor: boolean = false): Promise<void> => {
		stopReconnectPoll();
		monitoring = true;
		const generation = observerGeneration;
		installing.value = true;
		status.value = 'downloading';
		waitingForRestart.value = false;
		error.value = null;

		try {
			const { error: responseError } = await backend.client.POST(UPDATE_INSTALL_PATH, {
				body: { allow_major: allowMajor },
			});

			if (generation !== observerGeneration) {
				return;
			}

			if (responseError) {
				installing.value = false;
				status.value = 'failed';
				error.value = 'systemModule.messages.update.installFailed';

				throw new Error('Failed to start update');
			}

			// Update started successfully — begin polling for reconnection
			// after the service restarts
			startReconnectPoll();
		} catch (err) {
			if (generation !== observerGeneration) {
				return;
			}

			stopReconnectPoll();
			installing.value = false;
			status.value = 'failed';
			error.value = 'systemModule.messages.update.installFailed';

			throw err;
		}
	};

	return {
		currentVersion,
		latestVersion,
		updateAvailable,
		updateType,
		lastChecked,
		changelogUrl,
		status,
		phase,
		progressPercent,
		error,
		loading,
		installing,
		waitingForRestart,
		isUpdating,
		fetchStatus,
		checkForUpdates,
		installUpdate,
		applyStatusEvent,
	};
};

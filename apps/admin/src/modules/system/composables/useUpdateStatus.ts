import { computed, ref } from 'vue';

import { useBackend } from '../../../common';
import { MODULES_PREFIX } from '../../../app.constants';
import { onUpdateEvent } from '../services/update-events.service';
import { SYSTEM_MODULE_PREFIX } from '../system.constants';

import type { IUseUpdateStatus } from './types';

const UPDATE_STATUS_PATH = `/${MODULES_PREFIX}/${SYSTEM_MODULE_PREFIX}/system/update/status`;
const UPDATE_CHECK_PATH = `/${MODULES_PREFIX}/${SYSTEM_MODULE_PREFIX}/system/update/check`;
const UPDATE_INSTALL_PATH = `/${MODULES_PREFIX}/${SYSTEM_MODULE_PREFIX}/system/update/install`;

// Deduplication for concurrent fetchStatus calls
let fetchPromise: Promise<void> | null = null;
let lastFetchTimestamp = 0;
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

// Polling handle for reconnection detection after service restart
let reconnectPollTimer: ReturnType<typeof setInterval> | null = null;
const RECONNECT_POLL_INTERVAL_MS = 4_000;
const RECONNECT_POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes max

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

	// Update installing state
	installing.value = isUpdating.value;
};

// Module-level singleton subscription — keep the unsubscribe handle so Vite HMR
// can clean up the stale listener before re-registering on module re-evaluation.
const unsubscribe = onUpdateEvent(applyStatusEvent);

if (import.meta.hot) {
	import.meta.hot.dispose(() => {
		unsubscribe();
	});
}

export const useUpdateStatus = (): IUseUpdateStatus => {
	const backend = useBackend();

	const fetchStatus = async (): Promise<void> => {
		const now = Date.now();

		// Suppress duplicate fetches within the debounce window
		if (now - lastFetchTimestamp < FETCH_DEBOUNCE_MS) {
			return;
		}

		// Reuse in-flight request if one is pending
		if (fetchPromise) {
			return fetchPromise;
		}

		loading.value = true;
		lastFetchTimestamp = now;

		fetchPromise = (async () => {
			try {
				const response = await backend.client.GET(UPDATE_STATUS_PATH as never);

				const responseData = response.data as { data?: Record<string, unknown> } | undefined;

				if (responseData?.data) {
					applyInfoResponse(responseData.data);
				}
			} catch {
				// Silently fail - endpoint may not exist yet
			} finally {
				loading.value = false;
				fetchPromise = null;
			}
		})();

		return fetchPromise;
	};

	const checkForUpdates = async (): Promise<void> => {
		loading.value = true;

		try {
			const response = await backend.client.POST(UPDATE_CHECK_PATH as never);

			const responseData = response.data as { data?: Record<string, unknown> } | undefined;

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

	const stopReconnectPoll = (): void => {
		if (reconnectPollTimer !== null) {
			clearInterval(reconnectPollTimer);
			reconnectPollTimer = null;
		}
	};

	const startReconnectPoll = (): void => {
		stopReconnectPoll();

		const startedAt = Date.now();

		reconnectPollTimer = setInterval(async () => {
			// Timeout — give up after 5 minutes
			if (Date.now() - startedAt > RECONNECT_POLL_TIMEOUT_MS) {
				stopReconnectPoll();
				waitingForRestart.value = false;
				installing.value = false;
				status.value = 'failed';
				error.value = 'systemModule.messages.update.updateFailed';

				return;
			}

			try {
				const response = await backend.client.GET(UPDATE_STATUS_PATH as never);

				const responseData = response.data as { data?: Record<string, unknown> } | undefined;

				if (responseData?.data) {
					applyInfoResponse(responseData.data);

					const responseStatus = responseData.data.status as string | undefined;

					if (responseStatus === 'complete') {
						// Update finished successfully — show 100% and stop polling
						status.value = 'complete';
						progressPercent.value = 100;
						installing.value = false;
						waitingForRestart.value = false;
						stopReconnectPoll();
					} else if (responseStatus === 'failed') {
						// Update failed — show error and stop polling
						installing.value = false;
						waitingForRestart.value = false;
						stopReconnectPoll();
					} else if (!responseStatus || responseStatus === 'idle') {
						// Backend restarted with new version but status was already cleared.
						// Check if the version changed — if so, the update succeeded.
						const newVersion = responseData.data.current_version as string | undefined;

						if (newVersion && latestVersion.value && newVersion === latestVersion.value) {
							status.value = 'complete';
							progressPercent.value = 100;
							installing.value = false;
						}

						waitingForRestart.value = false;
						stopReconnectPoll();
					} else {
						// Still updating (downloading/installing/etc.) — keep polling
						waitingForRestart.value = false;
					}
				}
			} catch {
				// Backend still down — keep polling
				waitingForRestart.value = true;
			}
		}, RECONNECT_POLL_INTERVAL_MS);
	};

	const installUpdate = async (allowMajor: boolean = false): Promise<void> => {
		installing.value = true;
		status.value = 'downloading';
		error.value = null;

		try {
			const response = await backend.client.POST(UPDATE_INSTALL_PATH as never, {
				body: { allow_major: allowMajor },
			} as never);

			const responseError = (response as { error?: unknown }).error;

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

import { computed, onUnmounted, ref } from 'vue';

import { useBackend } from '../../../common';
import { MODULES_PREFIX } from '../../../app.constants';
import { onUpdateEvent } from '../services/update-events.service';
import { SYSTEM_MODULE_PREFIX } from '../system.constants';

import type { IUseUpdateStatus } from './types';

const UPDATE_STATUS_PATH = `/${MODULES_PREFIX}/${SYSTEM_MODULE_PREFIX}/system/update/status`;
const UPDATE_CHECK_PATH = `/${MODULES_PREFIX}/${SYSTEM_MODULE_PREFIX}/system/update/check`;
const UPDATE_INSTALL_PATH = `/${MODULES_PREFIX}/${SYSTEM_MODULE_PREFIX}/system/update/install`;

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
		error.value = data.error as string | null;
	} else {
		error.value = null;
	}

	// Update installing state
	installing.value = isUpdating.value;
};

const applyStatusEvent = (payload: Record<string, unknown>): void => {
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
		error.value = payload.error as string | null;
	}

	// Update installing state
	installing.value = isUpdating.value;
};

export const useUpdateStatus = (): IUseUpdateStatus => {
	const backend = useBackend();

	const fetchStatus = async (): Promise<void> => {
		loading.value = true;

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
		}
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
			error.value = 'Failed to check for updates';

			throw err;
		} finally {
			loading.value = false;
		}
	};

	const installUpdate = async (allowMajor: boolean = false): Promise<void> => {
		installing.value = true;
		status.value = 'downloading';
		error.value = null;

		try {
			await backend.client.POST(UPDATE_INSTALL_PATH as never, {
				body: { allow_major: allowMajor },
			} as never);
		} catch (err) {
			installing.value = false;
			status.value = 'failed';
			error.value = 'Failed to start update';

			throw err;
		}
	};

	// Subscribe to WebSocket update events (each component instance gets its own subscription)
	const unsubscribe = onUpdateEvent(applyStatusEvent);

	onUnmounted((): void => {
		unsubscribe();
	});

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
		isUpdating,
		fetchStatus,
		checkForUpdates,
		installUpdate,
		applyStatusEvent,
	};
};

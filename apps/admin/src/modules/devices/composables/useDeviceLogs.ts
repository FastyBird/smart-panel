import { computed, type ComputedRef, type MaybeRefOrGetter, onScopeDispose, ref, type Ref, toValue, watch } from 'vue';

import { useBackend, useLogger } from '../../../common';
import { MODULES_PREFIX } from '../../../app.constants';
import { SYSTEM_MODULE_PREFIX } from '../../system/system.constants';
import { transformLogEntryResponse } from '../../system/store/logs-entries.transformers';
import type { ILogEntry, ILogEntryRes } from '../../system/store/logs-entries.store.types';
import { SystemModuleLogEntryType } from '../../../openapi.constants';
import type { IDevice } from '../store/devices.store.types';

interface IUseDeviceLogsProps {
	deviceId: MaybeRefOrGetter<IDevice['id']>;
}

export interface IUseDeviceLogs {
	logs: ComputedRef<ILogEntry[]>;
	alertLogs: ComputedRef<ILogEntry[]>;
	alertCount: ComputedRef<number>;
	hasAlerts: ComputedRef<boolean>;
	hasMore: Ref<boolean>;
	isLoading: Ref<boolean>;
	loaded: Ref<boolean>;
	live: Ref<boolean>;
	fetchLogs: () => Promise<void>;
	loadMoreLogs: () => Promise<void>;
	refreshLogs: () => Promise<void>;
}

export const useDeviceLogs = (props: IUseDeviceLogsProps): IUseDeviceLogs => {
	const backend = useBackend();
	const logger = useLogger();

	const logsData = ref<Record<string, ILogEntry>>({});
	const hasMore = ref<boolean>(false);
	const isLoading = ref<boolean>(false);
	const loaded = ref<boolean>(false);
	const nextCursor = ref<string | undefined>(undefined);
	const live = ref<boolean>(false);

	// Track the current device ID to detect stale responses
	let currentFetchDevice: string | null = null;

	const logs = computed<ILogEntry[]>(() => {
		return Object.values(logsData.value).sort((a, b) => {
			return new Date(b.ts).getTime() - new Date(a.ts).getTime();
		});
	});

	// Filter for alert logs (warn, error, fatal, fail)
	const alertLogs = computed<ILogEntry[]>(() => {
		const alertTypes: SystemModuleLogEntryType[] = [
			SystemModuleLogEntryType.warn,
			SystemModuleLogEntryType.error,
			SystemModuleLogEntryType.fatal,
			SystemModuleLogEntryType.fail,
		];

		return logs.value.filter((log) => alertTypes.includes(log.type));
	});

	const alertCount = computed<number>(() => alertLogs.value.length);

	const hasAlerts = computed<boolean>(() => alertCount.value > 0);

	const fetchLogs = async (): Promise<void> => {
		const deviceId = toValue(props.deviceId);

		// Update the expected device ID before making the request
		currentFetchDevice = deviceId;

		// Allow concurrent requests but track which device we're fetching for
		isLoading.value = true;

		try {
			const { data: responseData, error } = await backend.client.GET(`/${MODULES_PREFIX}/${SYSTEM_MODULE_PREFIX}/logs`, {
				params: {
					query: {
						resource: deviceId,
						limit: 50,
					},
				},
			});

			// Discard response if device ID changed while request was in-flight
			if (currentFetchDevice !== deviceId) {
				return;
			}

			if (typeof responseData !== 'undefined') {
				const transformed = Object.fromEntries(
					responseData.data.map((logEntry: ILogEntryRes) => {
						const transformedLogEntry = transformLogEntryResponse(logEntry);
						return [transformedLogEntry.id, transformedLogEntry];
					})
				);

				logsData.value = transformed;
				loaded.value = true;
				hasMore.value = responseData.metadata.has_more;
				nextCursor.value = responseData.metadata.next_cursor;
			} else if (error) {
				logger.error('Failed to fetch device logs:', error);
			}
		} catch (err) {
			// Only log error if this is still the current device
			if (currentFetchDevice === deviceId) {
				logger.error('Error fetching device logs:', err);
			}
		} finally {
			// Only clear loading state if this is still the current device
			if (currentFetchDevice === deviceId) {
				isLoading.value = false;
			}
		}
	};

	const loadMoreLogs = async (): Promise<void> => {
		if (isLoading.value || !hasMore.value || !nextCursor.value) {
			return;
		}

		const deviceId = toValue(props.deviceId);
		const cursor = nextCursor.value;

		isLoading.value = true;

		try {
			const { data: responseData, error } = await backend.client.GET(`/${MODULES_PREFIX}/${SYSTEM_MODULE_PREFIX}/logs`, {
				params: {
					query: {
						resource: deviceId,
						after_id: cursor,
						limit: 50,
					},
				},
			});

			// Discard response if device ID changed while request was in-flight
			if (currentFetchDevice !== deviceId) {
				return;
			}

			if (typeof responseData !== 'undefined') {
				const transformed = Object.fromEntries(
					responseData.data.map((logEntry: ILogEntryRes) => {
						const transformedLogEntry = transformLogEntryResponse(logEntry);
						return [transformedLogEntry.id, transformedLogEntry];
					})
				);

				logsData.value = { ...logsData.value, ...transformed };
				hasMore.value = responseData.metadata.has_more;
				nextCursor.value = responseData.metadata.next_cursor;
			} else if (error) {
				logger.error('Failed to load more device logs:', error);
			}
		} catch (err) {
			// Only log error if this is still the current device
			if (currentFetchDevice === deviceId) {
				logger.error('Error loading more device logs:', err);
			}
		} finally {
			// Only clear loading state if this is still the current device
			if (currentFetchDevice === deviceId) {
				isLoading.value = false;
			}
		}
	};

	const refreshLogs = async (): Promise<void> => {
		logsData.value = {};
		nextCursor.value = undefined;
		hasMore.value = false;
		loaded.value = false;
		await fetchLogs();
	};

	// Live mode: auto-refresh every 3 seconds
	let timer: ReturnType<typeof setInterval> | null = null;

	watch(
		(): boolean => live.value,
		(on) => {
			if (timer) {
				clearInterval(timer);
				timer = null;
			}

			if (on) {
				timer = setInterval(() => {
					// Skip if a request is already in flight to prevent concurrent requests
					if (!isLoading.value) {
						void fetchLogs();
					}
				}, 3000);
			}
		}
	);

	// Clean up timer when composable scope is disposed
	onScopeDispose(() => {
		if (timer) {
			clearInterval(timer);
			timer = null;
		}
	});

	// Re-fetch when device ID changes
	watch(
		(): string => toValue(props.deviceId),
		() => {
			void refreshLogs();
		}
	);

	return {
		logs,
		alertLogs,
		alertCount,
		hasAlerts,
		hasMore,
		isLoading,
		loaded,
		live,
		fetchLogs,
		loadMoreLogs,
		refreshLogs,
	};
};

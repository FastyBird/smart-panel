import { computed, type ComputedRef, type MaybeRefOrGetter, onScopeDispose, ref, type Ref, toValue, watch } from 'vue';

import { useBackend, useLogger } from '../../../common';
import { MODULES_PREFIX } from '../../../app.constants';
import { SYSTEM_MODULE_PREFIX } from '../../system/system.constants';
import { transformLogEntryResponse } from '../../system/store/logs-entries.transformers';
import type { ILogEntry, ILogEntryRes } from '../../system/store/logs-entries.store.types';
import type { IExtension } from '../store/extensions.store.types';

interface IUseExtensionLogsProps {
	extensionType: MaybeRefOrGetter<IExtension['type']>;
}

export interface IUseExtensionLogs {
	logs: ComputedRef<ILogEntry[]>;
	hasMore: Ref<boolean>;
	isLoading: Ref<boolean>;
	loaded: Ref<boolean>;
	live: Ref<boolean>;
	fetchLogs: () => Promise<void>;
	loadMoreLogs: () => Promise<void>;
	refreshLogs: () => Promise<void>;
}

export const useExtensionLogs = (props: IUseExtensionLogsProps): IUseExtensionLogs => {
	const backend = useBackend();
	const logger = useLogger();

	const logsData = ref<Record<string, ILogEntry>>({});
	const hasMore = ref<boolean>(false);
	const isLoading = ref<boolean>(false);
	const loaded = ref<boolean>(false);
	const nextCursor = ref<string | undefined>(undefined);
	const live = ref<boolean>(false);

	// Track the current extension type to detect stale responses
	let currentFetchExtension: string | null = null;

	const logs = computed<ILogEntry[]>(() => {
		return Object.values(logsData.value).sort((a, b) => {
			return new Date(b.ts).getTime() - new Date(a.ts).getTime();
		});
	});

	const fetchLogs = async (): Promise<void> => {
		const extensionType = toValue(props.extensionType);

		// Update the expected extension type before making the request
		currentFetchExtension = extensionType;

		// Allow concurrent requests but track which extension we're fetching for
		isLoading.value = true;

		try {
			const { data: responseData, error } = await backend.client.GET(`/${MODULES_PREFIX}/${SYSTEM_MODULE_PREFIX}/logs`, {
				params: {
					query: {
						extension: extensionType,
						limit: 50,
					},
				},
			});

			// Discard response if extension type changed while request was in-flight
			if (currentFetchExtension !== extensionType) {
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
				logger.error('Failed to fetch extension logs:', error);
			}
		} catch (err) {
			// Only log error if this is still the current extension
			if (currentFetchExtension === extensionType) {
				logger.error('Error fetching extension logs:', err);
			}
		} finally {
			// Only clear loading state if this is still the current extension
			if (currentFetchExtension === extensionType) {
				isLoading.value = false;
			}
		}
	};

	const loadMoreLogs = async (): Promise<void> => {
		if (isLoading.value || !hasMore.value || !nextCursor.value) {
			return;
		}

		const extensionType = toValue(props.extensionType);
		const cursor = nextCursor.value;

		isLoading.value = true;

		try {
			const { data: responseData, error } = await backend.client.GET(`/${MODULES_PREFIX}/${SYSTEM_MODULE_PREFIX}/logs`, {
				params: {
					query: {
						extension: extensionType,
						after_id: cursor,
						limit: 50,
					},
				},
			});

			// Discard response if extension type changed while request was in-flight
			if (currentFetchExtension !== extensionType) {
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
				logger.error('Failed to load more extension logs:', error);
			}
		} catch (err) {
			// Only log error if this is still the current extension
			if (currentFetchExtension === extensionType) {
				logger.error('Error loading more extension logs:', err);
			}
		} finally {
			// Only clear loading state if this is still the current extension
			if (currentFetchExtension === extensionType) {
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
				timer = setInterval(() => void fetchLogs(), 3000);
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

	// Re-fetch when extension type changes
	watch(
		(): string => toValue(props.extensionType),
		() => {
			void refreshLogs();
		}
	);

	return {
		logs,
		hasMore,
		isLoading,
		loaded,
		live,
		fetchLogs,
		loadMoreLogs,
		refreshLogs,
	};
};

import { computed, ref, watch } from 'vue';

import { storeToRefs } from 'pinia';

import { isEqual } from 'lodash';

import { injectStoresManager, useListQuery } from '../../../common';
import { logsEntriesStoreKey } from '../store/keys';
import type { ILogEntry } from '../store/logs-entries.store.types';
import { SYSTEM_MODULE_NAME } from '../system.constants';

import { SystemLogsFilterSchema } from './schemas';
import type { ISystemLogsFilter, IUseSystemLogsDataSource } from './types';

export const defaultSystemLogsFilter: ISystemLogsFilter = {
	search: undefined,
	levels: [],
	sources: [],
	tag: undefined,
};

interface IUseSystemLogsDataSourceProps {
	syncQuery?: boolean;
}

export const useSystemLogsDataSource = (props?: IUseSystemLogsDataSourceProps): IUseSystemLogsDataSource => {
	const storesManager = injectStoresManager();

	const logsStore = storesManager.getStore(logsEntriesStoreKey);

	const { firstLoad, hasMore, nextCursor, semaphore } = storeToRefs(logsStore);

	const { filters, reset: resetFilter } = useListQuery<typeof SystemLogsFilterSchema>({
		key: `${SYSTEM_MODULE_NAME}:logs:list`,
		filters: {
			schema: SystemLogsFilterSchema,
			defaults: defaultSystemLogsFilter,
		},
		syncQuery: props?.syncQuery ?? true,
		version: 1,
	});

	const filtersActive = computed<boolean>((): boolean => {
		return (
			filters.value.search !== defaultSystemLogsFilter.search ||
			!isEqual(filters.value.levels, defaultSystemLogsFilter.levels) ||
			!isEqual(filters.value.sources, defaultSystemLogsFilter.sources) ||
			filters.value.tag !== defaultSystemLogsFilter.tag
		);
	});

	const live = ref<boolean>(false);

	const systemLogs = computed<ILogEntry[]>((): ILogEntry[] => {
		return logsStore
			.findAll()
			.sort((a, b): number => {
				return new Date(b.ts).getTime() - new Date(a.ts).getTime();
			})
			.filter(
				(logEntry) =>
					(!filters.value.search ||
						logEntry.id.toLowerCase().includes(filters.value.search.toLowerCase()) ||
						logEntry.message?.toLowerCase().includes(filters.value.search.toLowerCase()) ||
						logEntry.source?.toLowerCase().includes(filters.value.search.toLowerCase())) &&
					(filters.value.levels.length === 0 || filters.value.levels.includes(logEntry.type)) &&
					(filters.value.sources.length === 0 || filters.value.sources.includes(logEntry.source)) &&
					(!filters.value.tag || (logEntry.tag || '').toLowerCase().includes(filters.value.tag.toLowerCase()))
			);
	});

	const fetchSystemLogs = async (): Promise<void> => {
		await logsStore.fetch();
	};

	const loadMoreSystemLogs = async (): Promise<void> => {
		await logsStore.fetch({
			afterId: nextCursor.value,
			append: true,
		});
	};

	const refreshSystemLogs = async (): Promise<void> => {
		await logsStore.fetch();
	};

	const areLoading = computed<boolean>((): boolean => {
		if (semaphore.value.fetching.items) {
			return true;
		}

		if (firstLoad.value) {
			return false;
		}

		return semaphore.value.fetching.items;
	});

	const loaded = computed<boolean>((): boolean => {
		return firstLoad.value;
	});

	let timer: ReturnType<typeof setInterval> | null = null;

	watch(
		(): boolean => live.value,
		(on) => {
			if (timer) {
				clearInterval(timer);

				timer = null;
			}

			if (on) {
				timer = setInterval(() => logsStore.fetch({ append: true }), 3000);
			}
		}
	);

	return {
		systemLogs,
		hasMore,
		areLoading,
		loaded,
		fetchSystemLogs,
		loadMoreSystemLogs,
		filters,
		filtersActive,
		resetFilter,
		live,
		refreshSystemLogs,
	};
};

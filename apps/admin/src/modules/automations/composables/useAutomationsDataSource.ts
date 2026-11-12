import { computed, ref, watch } from 'vue';

import { storeToRefs } from 'pinia';

import { isEqual } from 'lodash';
import { orderBy } from 'natural-orderby';

import { type ISortEntry, injectStoresManager, useListQuery } from '../../../common';
import { AUTOMATIONS_MODULE_NAME, DEFAULT_PAGE, DEFAULT_PAGE_SIZE, WHOLE_HOME_SPACE_FILTER } from '../automations.constants';
import type { IAutomation } from '../store/automations.store.types';
import { automationsStoreKey } from '../store/keys';

import { AutomationsFilterSchema } from './schemas';
import type { AutomationsSortBy, IAutomationsFilter, IUseAutomationsDataSource } from './types';

export const defaultAutomationsFilter: IAutomationsFilter = {
	search: undefined,
	spaceId: undefined,
	enabled: 'all',
	statuses: [],
};

export const defaultAutomationsSort: ISortEntry = {
	by: 'name',
	dir: 'asc',
};

const sortValue = (automation: IAutomation, by: AutomationsSortBy): string | number => {
	if (by === 'lastTriggeredAt') {
		// Automations that never ran sort as the oldest
		return automation.lastTriggeredAt?.getTime() ?? 0;
	}

	return automation[by];
};

export const useAutomationsDataSource = (): IUseAutomationsDataSource => {
	const storesManager = injectStoresManager();

	const automationsStore = storesManager.getStore(automationsStoreKey);

	const { firstLoad, semaphore } = storeToRefs(automationsStore);

	const {
		filters,
		sort,
		pagination,
		reset: resetFilter,
	} = useListQuery<typeof AutomationsFilterSchema>({
		key: `${AUTOMATIONS_MODULE_NAME}:automations:list`,
		filters: {
			schema: AutomationsFilterSchema,
			defaults: defaultAutomationsFilter,
		},
		sort: {
			defaults: [defaultAutomationsSort],
		},
		pagination: {
			defaults: {
				page: DEFAULT_PAGE,
				size: DEFAULT_PAGE_SIZE,
			},
		},
		syncQuery: true,
		version: 1,
	});

	const filtersActive = computed<boolean>((): boolean => {
		return (
			filters.value.search !== defaultAutomationsFilter.search ||
			filters.value.spaceId !== defaultAutomationsFilter.spaceId ||
			filters.value.enabled !== defaultAutomationsFilter.enabled ||
			!isEqual(filters.value.statuses, defaultAutomationsFilter.statuses)
		);
	});

	const paginateSize = ref<number>(pagination.value.size || DEFAULT_PAGE_SIZE);

	const paginatePage = ref<number>(pagination.value.page || DEFAULT_PAGE);

	const sortBy = ref<AutomationsSortBy | undefined>(sort.value.length > 0 ? (sort.value[0]?.by as AutomationsSortBy) : undefined);

	const sortDir = ref<'asc' | 'desc' | null>(sort.value.length > 0 ? (sort.value[0]?.dir ?? null) : null);

	const matchSpaceFilter = (spaceId: IAutomation['spaceId'], filterSpaceId: IAutomationsFilter['spaceId']): boolean => {
		// No filter set - match all
		if (!filterSpaceId) {
			return true;
		}

		// "whole home" filter - match automations with no space assigned
		if (filterSpaceId === WHOLE_HOME_SPACE_FILTER) {
			return !spaceId;
		}

		return spaceId === filterSpaceId;
	};

	const automations = computed<IAutomation[]>((): IAutomation[] => {
		const search = filters.value.search?.toLowerCase();

		const filtered = automationsStore
			.findAll()
			.filter(
				(automation) =>
					(!search ||
						automation.id.toLowerCase().includes(search) ||
						automation.name.toLowerCase().includes(search) ||
						automation.description?.toLowerCase().includes(search)) &&
					matchSpaceFilter(automation.spaceId, filters.value.spaceId) &&
					(filters.value.enabled === 'all' ||
						(filters.value.enabled === 'enabled' && automation.enabled) ||
						(filters.value.enabled === 'disabled' && !automation.enabled)) &&
					(filters.value.statuses.length === 0 || filters.value.statuses.includes(automation.status))
			);

		// When sorting is disabled (sortBy undefined or sortDir null), fall back to name ascending
		const effectiveSortBy: AutomationsSortBy = sortBy.value ?? 'name';
		const effectiveSortDir = sortDir.value ?? 'asc';

		return orderBy<IAutomation>(filtered, [(automation: IAutomation) => sortValue(automation, effectiveSortBy)], [effectiveSortDir]);
	});

	const automationsPaginated = computed<IAutomation[]>((): IAutomation[] => {
		const start = (paginatePage.value - 1) * paginateSize.value;
		const end = start + paginateSize.value;

		return automations.value.slice(start, end);
	});

	const fetchFailed = ref<boolean>(false);

	const fetchAutomations = async (): Promise<void> => {
		fetchFailed.value = false;

		try {
			await automationsStore.fetch();
		} catch (error: unknown) {
			fetchFailed.value = true;

			throw error;
		}
	};

	// The list was never read and the last attempt failed. Without it the list would wait for a first
	// load that is not coming; once anything has loaded it (a retry, the refresh after a reconnect) it is over.
	const loadFailed = computed<boolean>((): boolean => {
		return fetchFailed.value && !firstLoad.value;
	});

	const areLoading = computed<boolean>((): boolean => {
		return semaphore.value.fetching.items || (!firstLoad.value && !loadFailed.value);
	});

	const loaded = computed<boolean>((): boolean => {
		return firstLoad.value;
	});

	const totalRows = computed<number>(() => automationsStore.findAll().length);

	watch(
		(): { page?: number; size?: number } => pagination.value,
		(val: { page?: number; size?: number }): void => {
			paginatePage.value = val.page ?? DEFAULT_PAGE;
			paginateSize.value = val.size ?? DEFAULT_PAGE_SIZE;
		},
		{ deep: true }
	);

	watch(
		(): number => paginatePage.value,
		(val: number): void => {
			pagination.value.page = val;
		}
	);

	watch(
		(): number => paginateSize.value,
		(val: number): void => {
			pagination.value.size = val;
		}
	);

	watch(
		(): 'asc' | 'desc' | null => sortDir.value,
		(val: 'asc' | 'desc' | null): void => {
			if (typeof sortBy.value === 'undefined' || val === null) {
				sort.value = [];
			} else {
				sort.value = [
					{
						by: sortBy.value,
						dir: val,
					},
				];
			}
		}
	);

	watch(
		(): AutomationsSortBy | undefined => sortBy.value,
		(val: AutomationsSortBy | undefined): void => {
			if (typeof val === 'undefined' || sortDir.value === null) {
				sort.value = [];
			} else {
				sort.value = [
					{
						by: val,
						dir: sortDir.value,
					},
				];
			}
		}
	);

	// Reset pagination to page 1 when filters change to avoid showing empty results
	watch(
		() => filters.value,
		() => {
			paginatePage.value = DEFAULT_PAGE;
		},
		{ deep: true }
	);

	return {
		automations,
		automationsPaginated,
		totalRows,
		areLoading,
		loaded,
		loadFailed,
		fetchAutomations,
		filters,
		filtersActive,
		paginateSize,
		paginatePage,
		sortBy,
		sortDir,
		resetFilter,
	};
};

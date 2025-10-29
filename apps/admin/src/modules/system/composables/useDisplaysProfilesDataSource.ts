import { computed, ref, watch } from 'vue';

import { storeToRefs } from 'pinia';

import { orderBy } from 'natural-orderby';

import { type ISortEntry, injectStoresManager, useListQuery } from '../../../common';
import type { IDisplayProfile } from '../store/displays-profiles.store.types';
import { displaysStoreKey } from '../store/keys';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, SYSTEM_MODULE_NAME } from '../system.constants';

import { DisplaysProfilesFilterSchema } from './schemas';
import type { IDisplaysProfilesFilter, IUseDisplaysProfilesDataSource } from './types';

export const defaultDisplaysProfilesFilter: IDisplaysProfilesFilter = {
	search: undefined,
};

export const defaultDisplaysProfilesSort: ISortEntry = {
	by: 'name',
	dir: 'asc',
};

export const useDisplaysProfilesDataSource = (): IUseDisplaysProfilesDataSource => {
	const storesManager = injectStoresManager();

	const displaysStore = storesManager.getStore(displaysStoreKey);

	const { firstLoad, semaphore } = storeToRefs(displaysStore);

	const {
		filters,
		sort,
		pagination,
		reset: resetFilter,
	} = useListQuery<typeof DisplaysProfilesFilterSchema>({
		key: `${SYSTEM_MODULE_NAME}:display-profiles:list`,
		filters: {
			schema: DisplaysProfilesFilterSchema,
			defaults: defaultDisplaysProfilesFilter,
		},
		sort: {
			defaults: [defaultDisplaysProfilesSort],
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
		return filters.value.search !== defaultDisplaysProfilesFilter.search;
	});

	const paginateSize = ref<number>(pagination.value.size || DEFAULT_PAGE_SIZE);

	const paginatePage = ref<number>(pagination.value.page || DEFAULT_PAGE);

	const sortBy = ref<'uid' | 'screenWidth' | 'screenHeight' | 'pixelRatio' | 'rows' | 'cols' | 'primary' | undefined>(
		sort.value.length > 0 ? (sort.value[0].by as 'uid' | 'screenWidth' | 'screenHeight' | 'pixelRatio' | 'rows' | 'cols' | 'primary') : undefined
	);

	const sortDir = ref<'asc' | 'desc' | null>(sort.value.length > 0 ? sort.value[0].dir : null);

	const displays = computed<IDisplayProfile[]>((): IDisplayProfile[] => {
		return orderBy<IDisplayProfile>(
			displaysStore.findAll().filter((display) => !filters.value.search || display.uid.toLowerCase().includes(filters.value.search.toLowerCase())),
			[(display: IDisplayProfile) => display[sortBy.value as keyof IDisplayProfile] ?? ''],
			[sortDir.value === 'asc' ? 'asc' : 'desc']
		);
	});

	const displaysPaginated = computed<IDisplayProfile[]>((): IDisplayProfile[] => {
		const start = (paginatePage.value - 1) * paginateSize.value;
		const end = start + paginateSize.value;

		return displays.value.slice(start, end);
	});

	const fetchDisplays = async (): Promise<void> => {
		await displaysStore.fetch();
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

	const totalRows = computed<number>(() => displaysStore.findAll().length);

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
		(): 'uid' | 'screenWidth' | 'screenHeight' | 'pixelRatio' | 'rows' | 'cols' | 'primary' | undefined => sortBy.value,
		(val: 'uid' | 'screenWidth' | 'screenHeight' | 'pixelRatio' | 'rows' | 'cols' | 'primary' | undefined): void => {
			if (typeof val === 'undefined') {
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

	return {
		displays,
		displaysPaginated,
		totalRows,
		areLoading,
		loaded,
		fetchDisplays,
		filters,
		filtersActive,
		paginateSize,
		paginatePage,
		sortBy,
		sortDir,
		resetFilter,
	};
};

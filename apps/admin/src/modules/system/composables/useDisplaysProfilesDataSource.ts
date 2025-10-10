import { computed, ref, watch } from 'vue';

import { storeToRefs } from 'pinia';

import { orderBy } from 'natural-orderby';

import { deepClone, injectStoresManager } from '../../../common';
import type { IDisplayProfile } from '../store/displays-profiles.store.types';
import { displaysStoreKey } from '../store/keys';

import type { IDisplaysProfilesFilter, IUseDisplaysProfilesDataSource } from './types';

export const defaultDisplaysFilter: IDisplaysProfilesFilter = {
	search: undefined,
};

export const useDisplaysProfilesDataSource = (): IUseDisplaysProfilesDataSource => {
	const storesManager = injectStoresManager();

	const displaysStore = storesManager.getStore(displaysStoreKey);

	const { firstLoad, semaphore } = storeToRefs(displaysStore);

	const paginateSize = ref<number>(10);

	const paginatePage = ref<number>(1);

	const filters = ref<IDisplaysProfilesFilter>(deepClone<IDisplaysProfilesFilter>(defaultDisplaysFilter));

	const filtersActive = computed<boolean>((): boolean => {
		return filters.value.search !== defaultDisplaysFilter.search;
	});

	const sortBy = ref<'uid' | 'screenWidth' | 'screenHeight' | 'pixelRatio' | 'rows' | 'cols' | 'primary'>('uid');

	const sortDir = ref<'ascending' | 'descending' | null>('ascending');

	const displays = computed<IDisplayProfile[]>((): IDisplayProfile[] => {
		return orderBy<IDisplayProfile>(
			displaysStore.findAll().filter((display) => !filters.value.search || display.uid.toLowerCase().includes(filters.value.search.toLowerCase())),
			[(display: IDisplayProfile) => display[sortBy.value as keyof IDisplayProfile] ?? ''],
			[sortDir.value === 'ascending' ? 'asc' : 'desc']
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

	const resetFilter = (): void => {
		filters.value = deepClone<IDisplaysProfilesFilter>(defaultDisplaysFilter);
	};

	watch(
		(): IDisplaysProfilesFilter => filters.value,
		(): void => {
			paginatePage.value = 1;
		},
		{ deep: true }
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

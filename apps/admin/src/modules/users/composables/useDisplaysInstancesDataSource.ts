import { computed, ref, watch } from 'vue';

import { storeToRefs } from 'pinia';

import { cloneDeep } from 'lodash';
import { orderBy } from 'natural-orderby';

import { injectStoresManager } from '../../../common';
import type { IDisplayInstance } from '../store/displays-instances.store.types';
import { displaysInstancesStoreKey } from '../store/keys';

import type { IDisplaysInstancesFilter, IUseDisplaysInstancesDataSource } from './types';

export const defaultDisplaysFilter: IDisplaysInstancesFilter = {
	search: undefined,
};

export const useDisplaysInstancesDataSource = (): IUseDisplaysInstancesDataSource => {
	const storesManager = injectStoresManager();

	const displaysStore = storesManager.getStore(displaysInstancesStoreKey);

	const { firstLoad, semaphore } = storeToRefs(displaysStore);

	const paginateSize = ref<number>(10);

	const paginatePage = ref<number>(1);

	const filters = ref<IDisplaysInstancesFilter>(cloneDeep<IDisplaysInstancesFilter>(defaultDisplaysFilter));

	const filtersActive = computed<boolean>((): boolean => {
		return filters.value.search !== defaultDisplaysFilter.search;
	});

	const sortBy = ref<'uid' | 'mac' | 'version' | 'build' | 'user'>('uid');

	const sortDir = ref<'ascending' | 'descending' | null>('ascending');

	const displays = computed<IDisplayInstance[]>((): IDisplayInstance[] => {
		return orderBy<IDisplayInstance>(
			displaysStore
				.findAll()
				.filter(
					(display) =>
						!display.draft &&
						(!filters.value.search ||
							display.uid.toLowerCase().includes(filters.value.search.toLowerCase()) ||
							display.mac.toLowerCase().includes(filters.value.search.toLowerCase()) ||
							display.version.toLowerCase().includes(filters.value.search.toLowerCase()) ||
							display.build.toLowerCase().includes(filters.value.search.toLowerCase()))
				),
			[(display: IDisplayInstance) => display[sortBy.value as keyof IDisplayInstance] ?? ''],
			[sortDir.value === 'ascending' ? 'asc' : 'desc']
		);
	});

	const displaysPaginated = computed<IDisplayInstance[]>((): IDisplayInstance[] => {
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

	const totalRows = computed<number>(() => displaysStore.findAll().filter((display) => !display.draft).length);

	const resetFilter = (): void => {
		filters.value = cloneDeep<IDisplaysInstancesFilter>(defaultDisplaysFilter);
	};

	watch(
		(): IDisplaysInstancesFilter => filters.value,
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

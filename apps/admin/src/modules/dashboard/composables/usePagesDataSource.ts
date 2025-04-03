import { computed, ref, watch } from 'vue';

import { storeToRefs } from 'pinia';

import { cloneDeep, isEqual } from 'lodash';
import { orderBy } from 'natural-orderby';

import { injectStoresManager } from '../../../common';
import { type IPage, pagesStoreKey } from '../store';

import type { IPagesFilter, IUsePagesDataSource } from './types';

export const defaultPagesFilter: IPagesFilter = {
	search: undefined,
	types: [],
};

export const usePagesDataSource = (): IUsePagesDataSource => {
	const storesManager = injectStoresManager();

	const pagesStore = storesManager.getStore(pagesStoreKey);

	const { firstLoad, semaphore } = storeToRefs(pagesStore);

	const paginateSize = ref<number>(10);

	const paginatePage = ref<number>(1);

	const filters = ref<IPagesFilter>(cloneDeep<IPagesFilter>(defaultPagesFilter));

	const filtersActive = computed<boolean>((): boolean => {
		return filters.value.search !== defaultPagesFilter.search || !isEqual(filters.value.types, defaultPagesFilter.types);
	});

	const sortBy = ref<'title' | 'order' | 'type'>('order');

	const sortDir = ref<'ascending' | 'descending' | null>('ascending');

	const pages = computed<IPage[]>((): IPage[] => {
		return orderBy<IPage>(
			pagesStore
				.findAll()
				.filter(
					(page) =>
						!page.draft &&
						(!filters.value.search || page.title.toLowerCase().includes(filters.value.search.toLowerCase())) &&
						(filters.value.types.length === 0 || filters.value.types.includes(page.type))
				),
			[(page: IPage) => page[sortBy.value as keyof IPage] ?? ''],
			[sortDir.value === 'ascending' ? 'asc' : 'desc']
		);
	});

	const pagesPaginated = computed<IPage[]>((): IPage[] => {
		const start = (paginatePage.value - 1) * paginateSize.value;
		const end = start + paginateSize.value;

		return pages.value.slice(start, end);
	});

	const fetchPages = async (): Promise<void> => {
		await pagesStore.fetch();
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

	const totalRows = computed<number>(() => pagesStore.findAll().filter((page) => !page.draft).length);

	const resetFilter = (): void => {
		filters.value = cloneDeep<IPagesFilter>(defaultPagesFilter);
	};

	watch(
		(): IPagesFilter => filters.value,
		(): void => {
			paginatePage.value = 1;
		},
		{ deep: true }
	);

	return {
		pages,
		pagesPaginated,
		totalRows,
		areLoading,
		loaded,
		fetchPages,
		filters,
		filtersActive,
		paginateSize,
		paginatePage,
		sortBy,
		sortDir,
		resetFilter,
	};
};

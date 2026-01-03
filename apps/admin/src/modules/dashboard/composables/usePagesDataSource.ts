import { computed, ref, watch } from 'vue';

import { storeToRefs } from 'pinia';

import { isEqual } from 'lodash';
import { orderBy } from 'natural-orderby';

import { type ISortEntry, injectStoresManager, useListQuery } from '../../../common';
import { DASHBOARD_MODULE_NAME, DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '../dashboard.constants';
import { pagesStoreKey } from '../store/keys';
import type { IPage } from '../store/pages.store.types';

import { PagesFilterSchema } from './schemas';
import type { IPagesFilter, IUsePagesDataSource } from './types';

export const defaultPagesFilter: IPagesFilter = {
	search: undefined,
	types: [],
	displays: [],
};

export const defaultPagesSort: ISortEntry = {
	by: 'title',
	dir: 'asc',
};

export const usePagesDataSource = (): IUsePagesDataSource => {
	const storesManager = injectStoresManager();

	const pagesStore = storesManager.getStore(pagesStoreKey);

	const { firstLoad, semaphore } = storeToRefs(pagesStore);

	const {
		filters,
		sort,
		pagination,
		reset: resetFilter,
	} = useListQuery<typeof PagesFilterSchema>({
		key: `${DASHBOARD_MODULE_NAME}:pages:list`,
		filters: {
			schema: PagesFilterSchema,
			defaults: defaultPagesFilter,
		},
		sort: {
			defaults: [defaultPagesSort],
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
			filters.value.search !== defaultPagesFilter.search ||
			!isEqual(filters.value.types, defaultPagesFilter.types) ||
			!isEqual(filters.value.displays, defaultPagesFilter.displays)
		);
	});

	const paginateSize = ref<number>(pagination.value.size || DEFAULT_PAGE_SIZE);

	const paginatePage = ref<number>(pagination.value.page || DEFAULT_PAGE);

	const sortBy = ref<'title' | 'order' | 'type' | undefined>(sort.value.length > 0 ? (sort.value[0]?.by as 'title' | 'order' | 'type') : undefined);

	const sortDir = ref<'asc' | 'desc' | null>(sort.value.length > 0 ? sort.value[0]?.dir ?? null : null);

	const pages = computed<IPage[]>((): IPage[] => {
		return orderBy<IPage>(
			pagesStore
				.findAll()
				.filter(
					(page) =>
						!page.draft &&
						(!filters.value.search || page.title.toLowerCase().includes(filters.value.search.toLowerCase())) &&
						(filters.value.types.length === 0 || filters.value.types.includes(page.type)) &&
						(filters.value.displays.length === 0 ||
							(filters.value.displays.includes('all') && (page.displays === null || page.displays.length === 0)) ||
							(page.displays !== null &&
								page.displays.length > 0 &&
								page.displays.some((displayId) => filters.value.displays.includes(displayId))))
				),
			[(page: IPage) => page[sortBy.value as keyof IPage] ?? ''],
			[sortDir.value === 'asc' ? 'asc' : 'desc']
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
		return semaphore.value.fetching.items || !firstLoad.value;
	});

	const loaded = computed<boolean>((): boolean => {
		return firstLoad.value;
	});

	const totalRows = computed<number>(() => pagesStore.findAll().filter((page) => !page.draft).length);

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
		(): 'title' | 'order' | 'type' | undefined => sortBy.value,
		(val: 'title' | 'order' | 'type' | undefined): void => {
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

import { computed, ref, watch } from 'vue';

import { storeToRefs } from 'pinia';

import { isEqual } from 'lodash';
import { orderBy } from 'natural-orderby';

import { type ISortEntry, injectStoresManager, useListQuery } from '../../../common';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, DISPLAYS_MODULE_NAME } from '../displays.constants';
import type { IDisplay } from '../store/displays.store.types';
import { displaysStoreKey } from '../store/keys';

import { DisplaysFilterSchema } from './schemas';
import type { IDisplaysFilter, IUseDisplaysDataSource } from './types';

export const defaultDisplaysFilter: IDisplaysFilter = {
	search: undefined,
	darkMode: 'all',
	screenSaver: 'all',
	state: 'all',
	states: [],
};

export const defaultDisplaysSort: ISortEntry = {
	by: 'name',
	dir: 'asc',
};

export const useDisplaysDataSource = (): IUseDisplaysDataSource => {
	const storesManager = injectStoresManager();

	const displaysStore = storesManager.getStore(displaysStoreKey);

	const { firstLoad, semaphore } = storeToRefs(displaysStore);

	const {
		filters,
		sort,
		pagination,
		reset: resetFilter,
	} = useListQuery<typeof DisplaysFilterSchema>({
		key: `${DISPLAYS_MODULE_NAME}:displays:list`,
		filters: {
			schema: DisplaysFilterSchema,
			defaults: defaultDisplaysFilter,
		},
		sort: {
			defaults: [defaultDisplaysSort],
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
			filters.value.search !== defaultDisplaysFilter.search ||
			!isEqual(filters.value.darkMode, defaultDisplaysFilter.darkMode) ||
			!isEqual(filters.value.screenSaver, defaultDisplaysFilter.screenSaver) ||
			!isEqual(filters.value.state, defaultDisplaysFilter.state) ||
			!isEqual(filters.value.states, defaultDisplaysFilter.states)
		);
	});

	const paginateSize = ref<number>(pagination.value.size || DEFAULT_PAGE_SIZE);

	const paginatePage = ref<number>(pagination.value.page || DEFAULT_PAGE);

	const sortBy = ref<'name' | 'version' | 'screenWidth' | 'status' | undefined>(
		sort.value.length > 0 ? (sort.value[0]?.by as 'name' | 'version' | 'screenWidth' | 'status') : undefined
	);

	const sortDir = ref<'asc' | 'desc' | null>(sort.value.length > 0 ? sort.value[0]?.dir ?? null : null);

	const displays = computed<IDisplay[]>((): IDisplay[] => {
		return orderBy<IDisplay>(
			displaysStore
				.findAll()
				.filter(
					(display) =>
						!display.draft &&
						(!filters.value.search ||
							display.id.toLowerCase().includes(filters.value.search.toLowerCase()) ||
							display.name?.toLowerCase().includes(filters.value.search.toLowerCase()) ||
							display.macAddress.toLowerCase().includes(filters.value.search.toLowerCase()) ||
							display.version.toLowerCase().includes(filters.value.search.toLowerCase())) &&
						(filters.value.darkMode === 'all' ||
							(filters.value.darkMode === 'enabled' && display.darkMode) ||
							(filters.value.darkMode === 'disabled' && !display.darkMode)) &&
						(filters.value.screenSaver === 'all' ||
							(filters.value.screenSaver === 'enabled' && display.screenSaver) ||
							(filters.value.screenSaver === 'disabled' && !display.screenSaver)) &&
						(!filters.value.states || filters.value.states.length === 0 ||
							filters.value.states.includes(display.status ?? 'unknown')) &&
						(filters.value.state === 'all' ||
							(filters.value.state === 'online' && display.status === 'connected') ||
							(filters.value.state === 'offline' &&
								['disconnected', 'lost', 'unknown'].includes(display.status ?? 'unknown')))
				),
			[
				(display: IDisplay) => {
					switch (sortBy.value) {
						case 'name':
							return display.name || display.macAddress;
						case 'version':
							return display.version;
						case 'screenWidth':
							return display.screenWidth ?? 0;
						case 'status':
							return display.status ?? 'unknown';
						default:
							return display.name || display.macAddress;
					}
				},
			],
			[sortDir.value === 'asc' ? 'asc' : 'desc']
		);
	});

	const displaysPaginated = computed<IDisplay[]>((): IDisplay[] => {
		const start = (paginatePage.value - 1) * paginateSize.value;
		const end = start + paginateSize.value;

		return displays.value.slice(start, end);
	});

	const fetchDisplays = async (): Promise<void> => {
		await displaysStore.fetch();
	};

	const areLoading = computed<boolean>((): boolean => {
		return semaphore.value.fetching.items || !firstLoad.value;
	});

	const loaded = computed<boolean>((): boolean => {
		return firstLoad.value;
	});

	const totalRows = computed<number>(() => displaysStore.findAll().filter((display) => !display.draft).length);

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
		(): 'name' | 'version' | 'screenWidth' | 'status' | undefined => sortBy.value,
		(val: 'name' | 'version' | 'screenWidth' | 'status' | undefined): void => {
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

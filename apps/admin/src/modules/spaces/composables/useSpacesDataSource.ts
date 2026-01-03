import { computed, ref, watch } from 'vue';

import { storeToRefs } from 'pinia';

import { isEqual } from 'lodash';
import { orderBy } from 'natural-orderby';

import { type ISortEntry, injectStoresManager, useListQuery } from '../../../common';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, SPACES_MODULE_NAME, SpaceType } from '../spaces.constants';
import type { ISpace } from '../store/spaces.store.types';
import { spacesStoreKey } from '../store/keys';

import { SpacesFilterSchema } from './schemas';
import type { ISpacesFilter, IUseSpacesDataSource } from './types';

export const defaultSpacesFilter: ISpacesFilter = {
	search: undefined,
	type: 'all',
};

export const defaultSpacesSort: ISortEntry = {
	by: 'name',
	dir: 'asc',
};

export const useSpacesDataSource = (): IUseSpacesDataSource => {
	const storesManager = injectStoresManager();

	const spacesStore = storesManager.getStore(spacesStoreKey);

	const { firstLoad, semaphore } = storeToRefs(spacesStore);

	const {
		filters,
		sort,
		pagination,
		reset: resetFilter,
	} = useListQuery<typeof SpacesFilterSchema>({
		key: `${SPACES_MODULE_NAME}:spaces:list`,
		filters: {
			schema: SpacesFilterSchema,
			defaults: defaultSpacesFilter,
		},
		sort: {
			defaults: [defaultSpacesSort],
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
			filters.value.search !== defaultSpacesFilter.search ||
			!isEqual(filters.value.type, defaultSpacesFilter.type)
		);
	});

	const paginateSize = ref<number>(pagination.value.size || DEFAULT_PAGE_SIZE);

	const paginatePage = ref<number>(pagination.value.page || DEFAULT_PAGE);

	const sortBy = ref<'name' | 'type' | 'displayOrder' | undefined>(
		sort.value.length > 0 ? (sort.value[0]?.by as 'name' | 'type' | 'displayOrder') : undefined
	);

	const sortDir = ref<'asc' | 'desc' | null>(sort.value.length > 0 ? sort.value[0]?.dir ?? null : null);

	const spaces = computed<ISpace[]>((): ISpace[] => {
		return orderBy<ISpace>(
			spacesStore
				.findAll()
				.filter(
					(space) =>
						!space.draft &&
						(!filters.value.search ||
							space.id.toLowerCase().includes(filters.value.search.toLowerCase()) ||
							space.name?.toLowerCase().includes(filters.value.search.toLowerCase()) ||
							space.description?.toLowerCase().includes(filters.value.search.toLowerCase())) &&
						(filters.value.type === 'all' ||
							(filters.value.type === SpaceType.ROOM && space.type === SpaceType.ROOM) ||
							(filters.value.type === SpaceType.ZONE && space.type === SpaceType.ZONE))
				),
			[
				(space: ISpace) => {
					switch (sortBy.value) {
						case 'name':
							return space.name;
						case 'type':
							return space.type;
						case 'displayOrder':
							return space.displayOrder;
						default:
							return space.displayOrder;
					}
				},
			],
			[sortDir.value ?? 'asc']
		);
	});

	const spacesPaginated = computed<ISpace[]>((): ISpace[] => {
		const start = (paginatePage.value - 1) * paginateSize.value;
		const end = start + paginateSize.value;

		return spaces.value.slice(start, end);
	});

	const fetchSpaces = async (): Promise<void> => {
		await spacesStore.fetch();
	};

	const areLoading = computed<boolean>((): boolean => {
		if (semaphore.value.fetching.items) {
			return true;
		}

		if (!firstLoad.value) {
			return true;
		}

		return false;
	});

	const loaded = computed<boolean>((): boolean => {
		return firstLoad.value;
	});

	const totalRows = computed<number>(() => spacesStore.findAll().filter((space) => !space.draft).length);

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
		(): 'name' | 'type' | 'displayOrder' | undefined => sortBy.value,
		(val: 'name' | 'type' | 'displayOrder' | undefined): void => {
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
		spaces,
		spacesPaginated,
		totalRows,
		areLoading,
		loaded,
		fetchSpaces,
		filters,
		filtersActive,
		paginateSize,
		paginatePage,
		sortBy,
		sortDir,
		resetFilter,
	};
};

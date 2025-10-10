import { computed, ref, watch } from 'vue';

import { storeToRefs } from 'pinia';

import { isEqual } from 'lodash';
import { orderBy } from 'natural-orderby';

import { type ISortEntry, injectStoresManager, useListQuery } from '../../../common';
import { DASHBOARD_MODULE_NAME, DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '../dashboard.constants';
import { tilesStoreKey } from '../store/keys';
import type { ITile } from '../store/tiles.store.types';

import { TilesFilterSchema } from './schemas';
import type { ITilesFilter, IUseTilesDataSource } from './types';

export const defaultTilesFilter: ITilesFilter = {
	search: undefined,
	types: [],
};

export const defaultTilesSort: ISortEntry = {
	by: 'row',
	dir: 'asc',
};

interface IUseTilesDataSourceProps {
	parent: string;
	parentId: string;
}

export const useTilesDataSource = (props: IUseTilesDataSourceProps): IUseTilesDataSource => {
	const storesManager = injectStoresManager();

	const tilesStore = storesManager.getStore(tilesStoreKey);

	const { firstLoad, semaphore } = storeToRefs(tilesStore);

	const {
		filters,
		sort,
		pagination,
		reset: resetFilter,
	} = useListQuery<typeof TilesFilterSchema>({
		key: `${DASHBOARD_MODULE_NAME}:tiles:${props.parent}:${props.parentId}:list`,
		filters: {
			schema: TilesFilterSchema,
			defaults: defaultTilesFilter,
		},
		sort: {
			defaults: [defaultTilesSort],
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
		return filters.value.search !== defaultTilesFilter.search || !isEqual(filters.value.types, defaultTilesFilter.types);
	});

	const paginateSize = ref<number>(pagination.value.size || DEFAULT_PAGE_SIZE);

	const paginatePage = ref<number>(pagination.value.page || DEFAULT_PAGE);

	const sortBy = ref<'row' | 'col' | 'rowSpan' | 'colSpan' | 'hidden' | 'type' | undefined>(
		sort.value.length > 0 ? (sort.value[0].by as 'row' | 'col' | 'rowSpan' | 'colSpan' | 'hidden' | 'type') : undefined
	);

	const sortDir = ref<'asc' | 'desc' | null>(sort.value.length > 0 ? sort.value[0].dir : null);

	const tiles = computed<ITile[]>((): ITile[] => {
		return orderBy<ITile>(
			tilesStore.findForParent(props.parent, props.parentId).filter((tile) => !tile.draft),
			[(tile: ITile) => tile[sortBy.value as keyof ITile] ?? ''],
			[sortDir.value === 'asc' ? 'asc' : 'desc']
		);
	});

	const tilesPaginated = computed<ITile[]>((): ITile[] => {
		const start = (paginatePage.value - 1) * paginateSize.value;
		const end = start + paginateSize.value;

		return tiles.value.slice(start, end);
	});

	const fetchTiles = async (): Promise<void> => {
		await tilesStore.fetch({ parent: { type: props.parent, id: props.parentId } });
	};

	const areLoading = computed<boolean>((): boolean => {
		if (semaphore.value.fetching.items.includes(props.parentId)) {
			return true;
		}

		if (firstLoad.value.includes(props.parentId)) {
			return false;
		}

		return semaphore.value.fetching.items.includes(props.parentId);
	});

	const loaded = computed<boolean>((): boolean => {
		return firstLoad.value.includes(props.parentId);
	});

	const totalRows = computed<number>(() => {
		return tilesStore.findForParent(props.parent, props.parentId).filter((tile) => !tile.draft).length;
	});

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
		(): 'row' | 'col' | 'rowSpan' | 'colSpan' | 'hidden' | 'type' | undefined => sortBy.value,
		(val: 'row' | 'col' | 'rowSpan' | 'colSpan' | 'hidden' | 'type' | undefined): void => {
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
		tiles,
		tilesPaginated,
		totalRows,
		areLoading,
		loaded,
		fetchTiles,
		filters,
		filtersActive,
		paginateSize,
		paginatePage,
		sortBy,
		sortDir,
		resetFilter,
	};
};

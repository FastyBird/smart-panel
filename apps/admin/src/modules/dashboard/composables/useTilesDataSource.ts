import { computed, ref, watch } from 'vue';

import { storeToRefs } from 'pinia';

import { cloneDeep, isEqual } from 'lodash';
import { orderBy } from 'natural-orderby';

import { injectStoresManager } from '../../../common';
import { tilesStoreKey } from '../store/keys';
import type { ITile } from '../store/tiles.store.types';

import type { ITilesFilter, IUseTilesDataSource } from './types';

export const defaultTilesFilter: ITilesFilter = {
	search: undefined,
	types: [],
};

interface IUseTilesDataSourceProps {
	parent: string;
	parentId: string;
}

export const useTilesDataSource = (props: IUseTilesDataSourceProps): IUseTilesDataSource => {
	const storesManager = injectStoresManager();

	const tilesStore = storesManager.getStore(tilesStoreKey);

	const { firstLoad, semaphore } = storeToRefs(tilesStore);

	const paginateSize = ref<number>(10);

	const paginatePage = ref<number>(1);

	const filters = ref<ITilesFilter>(cloneDeep<ITilesFilter>(defaultTilesFilter));

	const filtersActive = computed<boolean>((): boolean => {
		return filters.value.search !== defaultTilesFilter.search || !isEqual(filters.value.types, defaultTilesFilter.types);
	});

	const sortBy = ref<'row' | 'col' | 'rowSpan' | 'colSpan' | 'hidden' | 'type'>('row');

	const sortDir = ref<'ascending' | 'descending' | null>('ascending');

	const tiles = computed<ITile[]>((): ITile[] => {
		return orderBy<ITile>(
			tilesStore.findForParent(props.parent, props.parentId).filter((tile) => !tile.draft),
			[(tile: ITile) => tile[sortBy.value as keyof ITile] ?? ''],
			[sortDir.value === 'ascending' ? 'asc' : 'desc']
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

	const resetFilter = (): void => {
		filters.value = cloneDeep<ITilesFilter>(defaultTilesFilter);
	};

	watch(
		(): ITilesFilter => filters.value,
		(): void => {
			paginatePage.value = 1;
		},
		{ deep: true }
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

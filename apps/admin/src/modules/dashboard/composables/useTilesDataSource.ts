import { computed, ref, watch } from 'vue';

import { storeToRefs } from 'pinia';

import { cloneDeep, isEqual } from 'lodash';
import { orderBy } from 'natural-orderby';

import { injectStoresManager } from '../../../common';
import { type ICard, type IPage, type ITile, type TileParentTypeMap, tilesStoreKey } from '../store';

import type { ITilesFilter, IUseTilesDataSource } from './types';

export const defaultTilesFilter: ITilesFilter = {
	search: undefined,
	types: [],
};

interface IUsePageTilesDataSourceProps {
	parent: 'page';
	pageId: IPage['id'];
}

interface IUseCardTilesDataSourceProps {
	parent: 'card';
	pageId: IPage['id'];
	cardId: ICard['id'];
}

type IUseTilesDataSourceProps = IUsePageTilesDataSourceProps | IUseCardTilesDataSourceProps;

export const useTilesDataSource = <T extends keyof TileParentTypeMap>(props: IUseTilesDataSourceProps & { parent: T }): IUseTilesDataSource<T> => {
	const is = {
		page: (p: IUseTilesDataSourceProps): p is IUsePageTilesDataSourceProps => p.parent === 'page',
		card: (p: IUseTilesDataSourceProps): p is IUseCardTilesDataSourceProps => p.parent === 'card',
	};

	const storesManager = injectStoresManager();

	const tilesStore = storesManager.getStore(tilesStoreKey);

	const { firstLoad, semaphore } = storeToRefs(tilesStore);

	const paginateSize = ref<number>(10);

	const paginatePage = ref<number>(1);

	const filters = ref<ITilesFilter>(cloneDeep<ITilesFilter>(defaultTilesFilter));

	const filtersActive = computed<boolean>((): boolean => {
		return filters.value.search !== defaultTilesFilter.search || !isEqual(filters.value.types, defaultTilesFilter.types);
	});

	const sortBy = ref<'row' | 'col' | 'type'>('row');

	const sortDir = ref<'ascending' | 'descending' | null>('ascending');

	const tiles = computed<TileParentTypeMap[T][]>((): TileParentTypeMap[T][] => {
		if (is.card(props)) {
			return orderBy<TileParentTypeMap[T]>(
				tilesStore.findForParent(props.parent, props.cardId).filter((tile) => !tile.draft) as TileParentTypeMap[T][],
				[(tile: ITile) => tile[sortBy.value as keyof ITile] ?? ''],
				[sortDir.value === 'ascending' ? 'asc' : 'desc']
			);
		} else {
			return orderBy<TileParentTypeMap[T]>(
				tilesStore.findForParent(props.parent, props.pageId).filter((tile) => !tile.draft) as TileParentTypeMap[T][],
				[(tile: ITile) => tile[sortBy.value as keyof ITile] ?? ''],
				[sortDir.value === 'ascending' ? 'asc' : 'desc']
			);
		}
	});

	const tilesPaginated = computed<TileParentTypeMap[T][]>((): TileParentTypeMap[T][] => {
		const start = (paginatePage.value - 1) * paginateSize.value;
		const end = start + paginateSize.value;

		return tiles.value.slice(start, end);
	});

	const fetchTiles = async (): Promise<void> => {
		if (is.card(props)) {
			await tilesStore.fetch({ parent: props.parent, pageId: props.pageId, cardId: props.cardId });
		} else {
			await tilesStore.fetch({ parent: props.parent, pageId: props.pageId });
		}
	};

	const areLoading = computed<boolean>((): boolean => {
		if (is.card(props)) {
			if (semaphore.value.fetching.items.includes(props.cardId)) {
				return true;
			}

			if (firstLoad.value.includes(props.cardId)) {
				return false;
			}

			return semaphore.value.fetching.items.includes(props.cardId);
		} else {
			if (semaphore.value.fetching.items.includes(props.pageId)) {
				return true;
			}

			if (firstLoad.value.includes(props.pageId)) {
				return false;
			}

			return semaphore.value.fetching.items.includes(props.pageId);
		}
	});

	const loaded = computed<boolean>((): boolean => {
		if (is.card(props)) {
			return firstLoad.value.includes(props.cardId);
		} else {
			return firstLoad.value.includes(props.pageId);
		}
	});

	const totalRows = computed<number>(() => {
		if (is.card(props)) {
			return tilesStore.findForParent(props.parent, props.cardId).filter((tile) => !tile.draft).length;
		} else {
			return tilesStore.findForParent(props.parent, props.pageId).filter((tile) => !tile.draft).length;
		}
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

import { computed, ref, watch } from 'vue';

import { storeToRefs } from 'pinia';

import { cloneDeep, isEqual } from 'lodash';
import { orderBy } from 'natural-orderby';

import { injectStoresManager } from '../../../common';
import { type DataSourceParentTypeMap, type ICard, type IDataSource, type IPage, type ITile, dataSourcesStoreKey } from '../store';

import type { IDataSourcesFilter, IUseDataSourcesDataSource } from './types';

export const defaultDataSourcesFilter: IDataSourcesFilter = {
	search: undefined,
	types: [],
};

interface IUsePageDataSourcesDataSourceProps {
	parent: 'page';
	pageId: IPage['id'];
}

interface IUseCardDataSourcesDataSourceProps {
	parent: 'card';
	pageId: IPage['id'];
	cardId: ICard['id'];
}

interface IUseTileDataSourcesDataSourceProps {
	parent: 'tile';
	pageId: IPage['id'];
	cardId?: ICard['id'];
	tileId: ITile['id'];
}

type IUseDataSourcesDataSourceProps = IUsePageDataSourcesDataSourceProps | IUseCardDataSourcesDataSourceProps | IUseTileDataSourcesDataSourceProps;

export const useDataSourcesDataSource = <T extends keyof DataSourceParentTypeMap>(
	props: IUseDataSourcesDataSourceProps & { parent: T }
): IUseDataSourcesDataSource<T> => {
	const is = {
		page: (p: IUseDataSourcesDataSourceProps): p is IUsePageDataSourcesDataSourceProps => p.parent === 'page',
		card: (p: IUseDataSourcesDataSourceProps): p is IUseCardDataSourcesDataSourceProps => p.parent === 'card',
		tile: (p: IUseDataSourcesDataSourceProps): p is IUseTileDataSourcesDataSourceProps => p.parent === 'tile',
	};

	const storesManager = injectStoresManager();

	const dataSourcesStore = storesManager.getStore(dataSourcesStoreKey);

	const { firstLoad, semaphore } = storeToRefs(dataSourcesStore);

	const paginateSize = ref<number>(10);

	const paginatePage = ref<number>(1);

	const filters = ref<IDataSourcesFilter>(cloneDeep<IDataSourcesFilter>(defaultDataSourcesFilter));

	const filtersActive = computed<boolean>((): boolean => {
		return filters.value.search !== defaultDataSourcesFilter.search || !isEqual(filters.value.types, defaultDataSourcesFilter.types);
	});

	const sortBy = ref<'type'>('type');

	const sortDir = ref<'ascending' | 'descending' | null>('ascending');

	const dataSources = computed<DataSourceParentTypeMap[T][]>((): DataSourceParentTypeMap[T][] => {
		if (is.tile(props)) {
			return orderBy<DataSourceParentTypeMap[T]>(
				dataSourcesStore.findForParent(props.parent, props.tileId).filter((dataSource) => !dataSource.draft) as DataSourceParentTypeMap[T][],
				[(dataSource: IDataSource) => dataSource[sortBy.value as keyof IDataSource] ?? ''],
				[sortDir.value === 'ascending' ? 'asc' : 'desc']
			);
		} else if (is.card(props)) {
			return orderBy<DataSourceParentTypeMap[T]>(
				dataSourcesStore.findForParent(props.parent, props.cardId).filter((dataSource) => !dataSource.draft) as DataSourceParentTypeMap[T][],
				[(dataSource: IDataSource) => dataSource[sortBy.value as keyof IDataSource] ?? ''],
				[sortDir.value === 'ascending' ? 'asc' : 'desc']
			);
		} else {
			return orderBy<DataSourceParentTypeMap[T]>(
				dataSourcesStore.findForParent(props.parent, props.pageId).filter((dataSource) => !dataSource.draft) as DataSourceParentTypeMap[T][],
				[(dataSource: IDataSource) => dataSource[sortBy.value as keyof IDataSource] ?? ''],
				[sortDir.value === 'ascending' ? 'asc' : 'desc']
			);
		}
	});

	const dataSourcesPaginated = computed<DataSourceParentTypeMap[T][]>((): DataSourceParentTypeMap[T][] => {
		const start = (paginatePage.value - 1) * paginateSize.value;
		const end = start + paginateSize.value;

		return dataSources.value.slice(start, end);
	});

	const fetchDataSources = async (): Promise<void> => {
		if (is.tile(props)) {
			await dataSourcesStore.fetch({ parent: props.parent, pageId: props.pageId, cardId: props.cardId, tileId: props.tileId });
		} else if (is.card(props)) {
			await dataSourcesStore.fetch({ parent: props.parent, pageId: props.pageId, cardId: props.cardId });
		} else {
			await dataSourcesStore.fetch({ parent: props.parent, pageId: props.pageId });
		}
	};

	const areLoading = computed<boolean>((): boolean => {
		if (is.tile(props)) {
			if (semaphore.value.fetching.items.includes(props.tileId)) {
				return true;
			}

			if (firstLoad.value.includes(props.tileId)) {
				return false;
			}

			return semaphore.value.fetching.items.includes(props.tileId);
		} else if (is.card(props)) {
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
		if (is.tile(props)) {
			return firstLoad.value.includes(props.tileId);
		} else if (is.card(props)) {
			return firstLoad.value.includes(props.cardId);
		} else {
			return firstLoad.value.includes(props.pageId);
		}
	});

	const totalRows = computed<number>(() => {
		if (is.tile(props)) {
			return dataSourcesStore.findForParent(props.parent, props.tileId).filter((dataSource) => !dataSource.draft).length;
		} else if (is.card(props)) {
			return dataSourcesStore.findForParent(props.parent, props.cardId).filter((dataSource) => !dataSource.draft).length;
		} else {
			return dataSourcesStore.findForParent(props.parent, props.pageId).filter((dataSource) => !dataSource.draft).length;
		}
	});

	const resetFilter = (): void => {
		filters.value = cloneDeep<IDataSourcesFilter>(defaultDataSourcesFilter);
	};

	watch(
		(): IDataSourcesFilter => filters.value,
		(): void => {
			paginatePage.value = 1;
		},
		{ deep: true }
	);

	return {
		dataSources,
		dataSourcesPaginated,
		totalRows,
		areLoading,
		loaded,
		fetchDataSources,
		filters,
		filtersActive,
		paginateSize,
		paginatePage,
		sortBy,
		sortDir,
		resetFilter,
	};
};

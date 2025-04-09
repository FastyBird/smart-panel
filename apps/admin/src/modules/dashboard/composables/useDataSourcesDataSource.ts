import { computed, ref, watch } from 'vue';

import { storeToRefs } from 'pinia';

import { cloneDeep, isEqual } from 'lodash';
import { orderBy } from 'natural-orderby';

import { injectStoresManager } from '../../../common';
import type { IDataSource } from '../store/dataSources.store.types';
import { dataSourcesStoreKey } from '../store/keys';

import type { IDataSourcesFilter, IUseDataSourcesDataSource } from './types';

export const defaultDataSourcesFilter: IDataSourcesFilter = {
	search: undefined,
	types: [],
};

interface IUseDataSourcesDataSourceProps {
	parent: string;
	parentId: string;
}

export const useDataSourcesDataSource = (props: IUseDataSourcesDataSourceProps): IUseDataSourcesDataSource => {
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

	const dataSources = computed<IDataSource[]>((): IDataSource[] => {
		return orderBy<IDataSource>(
			dataSourcesStore.findForParent(props.parent, props.parentId).filter((dataSource) => !dataSource.draft) as IDataSource[],
			[(dataSource: IDataSource) => dataSource[sortBy.value as keyof IDataSource] ?? ''],
			[sortDir.value === 'ascending' ? 'asc' : 'desc']
		);
	});

	const dataSourcesPaginated = computed<IDataSource[]>((): IDataSource[] => {
		const start = (paginatePage.value - 1) * paginateSize.value;
		const end = start + paginateSize.value;

		return dataSources.value.slice(start, end);
	});

	const fetchDataSources = async (): Promise<void> => {
		await dataSourcesStore.fetch({ parent: { type: props.parent, id: props.parentId } });
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
		return dataSourcesStore.findForParent(props.parent, props.parentId).filter((dataSource) => !dataSource.draft).length;
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

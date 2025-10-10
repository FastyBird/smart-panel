import { computed, ref, watch } from 'vue';

import { storeToRefs } from 'pinia';

import { isEqual } from 'lodash';
import { orderBy } from 'natural-orderby';

import { type ISortEntry, injectStoresManager, useListQuery } from '../../../common';
import { DASHBOARD_MODULE_NAME, DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '../dashboard.constants';
import type { IDataSource } from '../store/data-sources.store.types';
import { dataSourcesStoreKey } from '../store/keys';

import { DataSourcesFilterSchema } from './schemas';
import type { IDataSourcesFilter, IUseDataSourcesDataSource } from './types';

export const defaultDataSourcesFilter: IDataSourcesFilter = {
	search: undefined,
	types: [],
};

export const defaultDataSourcesSort: ISortEntry = {
	by: 'type',
	dir: 'asc',
};

interface IUseDataSourcesDataSourceProps {
	parent: string;
	parentId: string;
}

export const useDataSourcesDataSource = (props: IUseDataSourcesDataSourceProps): IUseDataSourcesDataSource => {
	const storesManager = injectStoresManager();

	const dataSourcesStore = storesManager.getStore(dataSourcesStoreKey);

	const { firstLoad, semaphore } = storeToRefs(dataSourcesStore);

	const {
		filters,
		sort,
		pagination,
		reset: resetFilter,
	} = useListQuery<typeof DataSourcesFilterSchema>({
		key: `${DASHBOARD_MODULE_NAME}:dataSources:${props.parent}:${props.parentId}:list`,
		filters: {
			schema: DataSourcesFilterSchema,
			defaults: defaultDataSourcesFilter,
		},
		sort: {
			defaults: [defaultDataSourcesSort],
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
		return filters.value.search !== defaultDataSourcesFilter.search || !isEqual(filters.value.types, defaultDataSourcesFilter.types);
	});

	const paginateSize = ref<number>(pagination.value.size || DEFAULT_PAGE_SIZE);

	const paginatePage = ref<number>(pagination.value.page || DEFAULT_PAGE);

	const sortBy = ref<'type' | undefined>(sort.value.length > 0 ? (sort.value[0].by as 'type') : undefined);

	const sortDir = ref<'asc' | 'desc' | null>(sort.value.length > 0 ? sort.value[0].dir : null);

	const dataSources = computed<IDataSource[]>((): IDataSource[] => {
		return orderBy<IDataSource>(
			dataSourcesStore.findForParent(props.parent, props.parentId).filter((dataSource) => !dataSource.draft) as IDataSource[],
			[(dataSource: IDataSource) => dataSource[sortBy.value as keyof IDataSource] ?? ''],
			[sortDir.value === 'asc' ? 'asc' : 'desc']
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
		(): 'type' | undefined => sortBy.value,
		(val: 'type' | undefined): void => {
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

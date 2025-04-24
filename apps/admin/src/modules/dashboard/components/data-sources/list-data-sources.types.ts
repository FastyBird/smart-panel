import type { IDataSourcesFilter } from '../../composables/types';
import type { IDataSource } from '../../store/data-sources.store.types';

export interface IListDataSourcesProps {
	items: IDataSource[];
	allItems: IDataSource[];
	totalRows: number;
	filters: IDataSourcesFilter;
	filtersActive: boolean;
	paginateSize: number;
	paginatePage: number;
	sortBy: 'title' | 'type' | 'order';
	sortDir: 'ascending' | 'descending' | null;
	loading: boolean;
}

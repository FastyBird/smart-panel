import type { IDataSourcesFilter } from '../../composables/types';
import type { IDataSource } from '../../store/data-sources.store.types';

export interface IDataSourcesTableProps {
	items: IDataSource[];
	totalRows: number;
	sortBy: 'title' | 'type' | 'order';
	sortDir: 'ascending' | 'descending' | null;
	loading: boolean;
	filters: IDataSourcesFilter;
	filtersActive: boolean;
}

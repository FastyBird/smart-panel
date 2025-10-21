import type { IDataSourcesFilter } from '../../composables/types';
import type { IDataSource } from '../../store/data-sources.store.types';

export interface IDataSourcesTableProps {
	items: IDataSource[];
	totalRows: number;
	sortBy: 'type' | undefined;
	sortDir: 'asc' | 'desc' | null;
	loading: boolean;
	filters: IDataSourcesFilter;
	filtersActive: boolean;
	tableHeight?: number;
}

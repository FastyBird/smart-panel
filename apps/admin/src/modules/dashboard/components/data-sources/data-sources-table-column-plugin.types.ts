import type { IDataSourcesFilter } from '../../composables/types';
import type { IDataSource } from '../../store/data-sources.store.types';

export interface IDataSourcesTableColumnPluginProps {
	dataSource: IDataSource;
	filters: IDataSourcesFilter;
}

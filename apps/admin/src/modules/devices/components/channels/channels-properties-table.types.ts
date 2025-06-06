import type { IChannelsPropertiesFilter } from '../../composables/types';
import type { IChannelProperty } from '../../store/channels.properties.store.types';

export interface IChannelsPropertiesTableProps {
	items: IChannelProperty[];
	totalRows: number;
	sortBy: 'name' | 'category';
	sortDir: 'ascending' | 'descending' | null;
	loading: boolean;
	filters: IChannelsPropertiesFilter;
	filtersActive: boolean;
	withChannelColumn?: boolean;
	withFilters?: boolean;
}

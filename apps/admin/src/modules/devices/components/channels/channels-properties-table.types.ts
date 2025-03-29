import type { IChannelsPropertiesFilter } from '../../composables';
import type { IChannelProperty } from '../../store';

export interface IChannelsPropertiesTableProps {
	items: IChannelProperty[];
	totalRows: number;
	sortBy: 'name' | 'category';
	sortDir: 'ascending' | 'descending' | null;
	loading: boolean;
	filters: IChannelsPropertiesFilter;
	filtersActive: boolean;
	withChannelColumn?: boolean;
}

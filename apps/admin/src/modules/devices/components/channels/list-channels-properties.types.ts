import type { IChannelsPropertiesFilter } from '../../composables/composables';
import type { IChannelProperty } from '../../store/channels.properties.store.types';

export interface IListChannelsPropertiesProps {
	items: IChannelProperty[];
	allItems: IChannelProperty[];
	totalRows: number;
	filters: IChannelsPropertiesFilter;
	filtersActive: boolean;
	paginateSize: number;
	paginatePage: number;
	sortBy: 'name' | 'category';
	sortDir: 'ascending' | 'descending' | null;
	loading: boolean;
}

import type { IChannelsPropertiesFilter } from '../../composables/types';
import type { IChannelProperty } from '../../store/channels.properties.store.types';

export interface IListChannelsPropertiesProps {
	items: IChannelProperty[];
	allItems: IChannelProperty[];
	totalRows: number;
	filters: IChannelsPropertiesFilter;
	filtersActive: boolean;
	paginateSize: number;
	paginatePage: number;
	sortBy: 'name' | 'category' | undefined;
	sortDir: 'asc' | 'desc' | null;
	loading: boolean;
}

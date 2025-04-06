import type { IChannelsFilter } from '../../composables/composables';
import type { IChannel } from '../../store/channels.store.types';

export interface IListChannelsProps {
	items: IChannel[];
	allItems: IChannel[];
	totalRows: number;
	filters: IChannelsFilter;
	filtersActive: boolean;
	paginateSize: number;
	paginatePage: number;
	sortBy: 'name' | 'description' | 'category';
	sortDir: 'ascending' | 'descending' | null;
	loading: boolean;
}

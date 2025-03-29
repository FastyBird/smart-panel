import type { IChannelsFilter } from '../../composables';
import type { IChannel } from '../../store';

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

import type { IChannelsFilter } from '../../composables/composables';
import type { IChannel } from '../../store/channels.store.types';

export interface IChannelsTableProps {
	items: IChannel[];
	totalRows: number;
	sortBy: 'name' | 'description' | 'category';
	sortDir: 'ascending' | 'descending' | null;
	loading: boolean;
	filters: IChannelsFilter;
	filtersActive: boolean;
}

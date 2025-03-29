import type { IChannelsFilter } from '../../composables';
import type { IChannel } from '../../store';

export interface IChannelsTableProps {
	items: IChannel[];
	totalRows: number;
	sortBy: 'name' | 'description' | 'category';
	sortDir: 'ascending' | 'descending' | null;
	loading: boolean;
	filters: IChannelsFilter;
	filtersActive: boolean;
}

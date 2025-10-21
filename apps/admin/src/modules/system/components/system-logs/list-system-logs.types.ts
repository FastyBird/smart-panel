import type { ISystemLogsFilter } from '../../composables/types';
import type { ILogEntry } from '../../store/logs-entries.store.types';

export interface IListSystemLogsProps {
	items: ILogEntry[];
	filters: ISystemLogsFilter;
	filtersActive: boolean;
	live: boolean;
	loading: boolean;
	hasMore: boolean;
}

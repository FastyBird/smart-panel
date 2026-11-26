import type { ILogEntry } from '../../store/logs-entries.store.types';

export interface ISystemLogsListProps {
	items: ILogEntry[];
	/** The entry open beside the list */
	activeId?: ILogEntry['id'] | null;
	loading: boolean;
	hasMore: boolean;
	filtersActive: boolean;
	/** The last read of the entries failed */
	failed?: boolean;
}

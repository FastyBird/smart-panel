import type { ILogEntry } from '../../store/logs-entries.store.types';

export interface ISystemLogsTableProps {
	items: ILogEntry[];
	loading: boolean;
	hasMore: boolean;
	filtersActive: boolean;
}

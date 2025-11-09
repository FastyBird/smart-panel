import type { ILogEntry, ISystemLogsFilter } from '../../system';

export type IApplicationLogsProps = {
	systemLogs: ILogEntry[];
	filters: ISystemLogsFilter;
	filtersActive: boolean;
	loading: boolean;
};

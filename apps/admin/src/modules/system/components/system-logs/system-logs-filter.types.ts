import type { ISystemLogsFilter } from '../../composables/types';

export interface ISystemLogsFilterProps {
	filters: ISystemLogsFilter;
	filtersActive: boolean;
	live: boolean;
}

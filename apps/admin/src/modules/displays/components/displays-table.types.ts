import type { IDisplay } from '../store/displays.store.types';
import type { IDisplaysFilter } from '../composables/types';

export interface IDisplaysTableProps {
	items: IDisplay[];
	totalRows: number;
	loading: boolean;
	filtersActive: boolean;
	filters: IDisplaysFilter;
	tableHeight?: number;
	sortBy?: 'name' | 'version' | 'screenWidth' | 'status';
	sortDir?: 'asc' | 'desc' | null;
}

import type { IDisplaysFilter } from '../composables/types';
import type { IDisplay } from '../store/displays.store.types';

export interface IListDisplaysProps {
	items: IDisplay[];
	allItems: IDisplay[];
	totalRows: number;
	loading: boolean;
	filtersActive: boolean;
	filters: IDisplaysFilter;
	paginateSize: number;
	paginatePage: number;
	sortBy?: 'name' | 'version' | 'screenWidth' | 'status';
	sortDir: 'asc' | 'desc' | null;
}

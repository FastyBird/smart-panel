import type { ISpacesFilter } from '../composables/types';
import type { ISpace } from '../store/spaces.store.types';

export interface ISpacesTableProps {
	items: ISpace[];
	totalRows: number;
	loading: boolean;
	filtersActive: boolean;
	tableHeight?: number;
	filters: ISpacesFilter;
	sortBy?: 'name' | 'type' | 'displayOrder';
	sortDir?: 'asc' | 'desc' | null;
}

import type { ISpacesFilter } from '../composables/types';
import type { ISpace } from '../store/spaces.store.types';

export interface IListSpacesProps {
	items: ISpace[];
	allItems: ISpace[];
	totalRows: number;
	loading: boolean;
	filtersActive: boolean;
	filters: ISpacesFilter;
	paginatePage: number;
	paginateSize: number;
	sortBy?: 'name' | 'type' | 'displayOrder';
	sortDir?: 'asc' | 'desc' | null;
}

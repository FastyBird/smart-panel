import type { IPagesFilter } from '../../composables/types';
import type { IPage } from '../../store/pages.store.types';

export interface IListPagesProps {
	items: IPage[];
	allItems: IPage[];
	totalRows: number;
	filters: IPagesFilter;
	filtersActive: boolean;
	paginateSize: number;
	paginatePage: number;
	sortBy: 'title' | 'type' | 'order' | undefined;
	sortDir: 'asc' | 'desc' | null;
	loading: boolean;
}

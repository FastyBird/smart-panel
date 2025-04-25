import type { IPagesFilter } from '../../composables/types';
import type { IPage } from '../../store/pages.store.types';

export interface IPagesTableProps {
	items: IPage[];
	totalRows: number;
	sortBy: 'title' | 'type' | 'order';
	sortDir: 'ascending' | 'descending' | null;
	loading: boolean;
	filters: IPagesFilter;
	filtersActive: boolean;
}

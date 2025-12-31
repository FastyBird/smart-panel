import type { IScenesFilter } from '../../composables/types';
import type { IScene } from '../../store/scenes.store.types';

export interface IScenesTableProps {
	items: IScene[];
	totalRows: number;
	filters: IScenesFilter;
	filtersActive: boolean;
	tableHeight: number;
	loading: boolean;
	triggering: string[];
	sortBy: 'name' | 'category' | 'displayOrder' | undefined;
	sortDir: 'asc' | 'desc' | null;
}

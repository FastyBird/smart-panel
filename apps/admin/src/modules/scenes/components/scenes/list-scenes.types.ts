import type { IScenesFilter } from '../../composables/types';
import type { IScene } from '../../store/scenes.store.types';

export interface IListScenesProps {
	items: IScene[];
	allItems: IScene[];
	totalRows: number;
	filters: IScenesFilter;
	filtersActive: boolean;
	paginateSize: number;
	paginatePage: number;
	sortBy: 'name' | 'category' | 'displayOrder' | undefined;
	sortDir: 'asc' | 'desc' | null;
	loading: boolean;
	triggering: IScene['id'][];
}

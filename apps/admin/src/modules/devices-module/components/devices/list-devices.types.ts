import type { IDevicesFilter } from '../../composables';
import type { IDevice } from '../../store';

export interface IListDevicesProps {
	items: IDevice[];
	allItems: IDevice[];
	totalRows: number;
	filters: IDevicesFilter;
	filtersActive: boolean;
	paginateSize: number;
	paginatePage: number;
	sortBy: 'name' | 'description' | 'type' | 'category';
	sortDir: 'ascending' | 'descending' | null;
	loading: boolean;
}

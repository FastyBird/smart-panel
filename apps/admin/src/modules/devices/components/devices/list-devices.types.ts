import type { IDevicesFilter } from '../../composables/types';
import type { IDevice } from '../../store/devices.store.types';

export interface IListDevicesProps {
	items: IDevice[];
	allItems: IDevice[];
	totalRows: number;
	filters: IDevicesFilter;
	filtersActive: boolean;
	paginateSize: number;
	paginatePage: number;
	sortBy: 'name' | 'description' | 'type' | 'state' | 'category';
	sortDir: 'ascending' | 'descending' | null;
	loading: boolean;
}

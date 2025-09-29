import type { IDevicesFilter } from '../../composables/types';
import type { IDevice } from '../../store/devices.store.types';

export interface IDevicesTableProps {
	items: IDevice[];
	totalRows: number;
	sortBy: 'name' | 'description' | 'type' | 'state' | 'category';
	sortDir: 'ascending' | 'descending' | null;
	loading: boolean;
	filters: IDevicesFilter;
	filtersActive: boolean;
}

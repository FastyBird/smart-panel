import type { IDevicesFilter } from '../../composables/composables';
import type { IDevice } from '../../store/devices.store.types';

export interface IDevicesTableProps {
	items: IDevice[];
	totalRows: number;
	sortBy: 'name' | 'description' | 'type' | 'category';
	sortDir: 'ascending' | 'descending' | null;
	loading: boolean;
	filters: IDevicesFilter;
	filtersActive: boolean;
}

import type { IDevicesFilter } from '../../composables/types';
import type { IDevice } from '../../store/devices.store.types';

export interface IDevicesTableProps {
	items: IDevice[];
	totalRows: number;
	sortBy: 'name' | 'description' | 'type' | 'state' | 'category' | undefined;
	sortDir: 'asc' | 'desc' | null;
	loading: boolean;
	filters: IDevicesFilter;
	filtersActive: boolean;
}

import type { IDevicesFilter } from '../../composables';
import type { IDevice } from '../../store';

export interface IDevicesTableProps {
	items: IDevice[];
	totalRows: number;
	sortBy: 'name' | 'description' | 'type' | 'category';
	sortDir: 'ascending' | 'descending' | null;
	loading: boolean;
	filters: IDevicesFilter;
	filtersActive: boolean;
}

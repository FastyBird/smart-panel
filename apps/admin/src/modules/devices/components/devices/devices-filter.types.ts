import type { IBulkAction } from '../../../../common';
import type { IDevicesFilter } from '../../composables/composables';

export interface IDevicesFilterProps {
	filters: IDevicesFilter;
	filtersActive: boolean;
	selectedCount: number;
	bulkActions: IBulkAction[];
}

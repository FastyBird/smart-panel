import type { IBulkAction } from '../../../common';
import type { IDisplaysFilter } from '../composables/types';

export interface IDisplaysFilterProps {
	filters: IDisplaysFilter;
	filtersActive: boolean;
	selectedCount: number;
	bulkActions: IBulkAction[];
}

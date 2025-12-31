import type { IBulkAction } from '../../../common';
import type { ISpacesFilter } from '../composables/types';

export interface ISpacesFilterProps {
	filters: ISpacesFilter;
	filtersActive: boolean;
	selectedCount: number;
	bulkActions: IBulkAction[];
}

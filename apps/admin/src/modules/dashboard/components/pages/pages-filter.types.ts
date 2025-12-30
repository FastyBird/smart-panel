import type { IBulkAction } from '../../../../common';
import type { IPagesFilter } from '../../composables/types';

export interface IPagesFilterProps {
	filters: IPagesFilter;
	filtersActive: boolean;
	selectedCount: number;
	bulkActions: IBulkAction[];
}

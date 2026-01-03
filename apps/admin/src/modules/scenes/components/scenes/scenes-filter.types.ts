import type { IBulkAction } from '../../../../common';
import type { IScenesFilter } from '../../composables/types';

export interface IScenesFilterProps {
	filters: IScenesFilter;
	filtersActive: boolean;
	selectedCount: number;
	bulkActions: IBulkAction[];
}

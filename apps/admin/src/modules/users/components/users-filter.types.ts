import type { IBulkAction } from '../../../common';
import type { IUsersFilter } from '../composables/types';

export interface IUsersFilterProps {
	filters: IUsersFilter;
	filtersActive: boolean;
	selectedCount: number;
	bulkActions: IBulkAction[];
}

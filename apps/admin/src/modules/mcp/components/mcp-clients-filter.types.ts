import type { IBulkAction } from '../../../common';
import type { IMcpClientsFilter } from '../composables/types';

export interface IMcpClientsFilterProps {
	filters: IMcpClientsFilter;
	filtersActive: boolean;
	selectedCount: number;
	bulkActions: IBulkAction[];
}

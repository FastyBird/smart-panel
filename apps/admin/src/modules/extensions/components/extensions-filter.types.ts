import type { IBulkAction } from '../../../common';
import type { IExtensionsFilter } from '../composables/types';

export interface IExtensionsFilterProps {
	filters: IExtensionsFilter;
	filtersActive: boolean;
	viewMode?: 'table' | 'cards';
	selectedCount: number;
	bulkActions: IBulkAction[];
}

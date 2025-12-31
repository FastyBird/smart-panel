import type { IBulkAction } from '../../../common';
import type { IWeatherLocationsFilter } from '../composables/types';

export interface ILocationsFilterProps {
	filters: IWeatherLocationsFilter;
	filtersActive: boolean;
	selectedCount: number;
	bulkActions: IBulkAction[];
}

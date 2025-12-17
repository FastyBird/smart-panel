import type { IWeatherLocationsFilter } from '../composables/types';

export interface IListLocationsAdjustProps {
	filters: IWeatherLocationsFilter;
	filtersActive: boolean;
}

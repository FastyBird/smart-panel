import type { IWeatherLocationsFilter } from '../composables/types';

export interface ILocationsFilterProps {
	filters: IWeatherLocationsFilter;
	filtersActive: boolean;
}

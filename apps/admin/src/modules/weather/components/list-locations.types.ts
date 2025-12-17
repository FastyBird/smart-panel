import type { IWeatherLocationsFilter } from '../composables/types';
import type { ILocationWeatherData } from '../composables/useLocationsWeather';
import type { IWeatherLocation } from '../store/locations.store.types';

export interface IListLocationsProps {
	items: IWeatherLocation[];
	allItems: IWeatherLocation[];
	totalRows: number;
	loading: boolean;
	filtersActive: boolean;
	filters: IWeatherLocationsFilter;
	sortBy: 'name' | 'type';
	sortDir: 'ascending' | 'descending' | null;
	paginateSize: number;
	paginatePage: number;
	primaryLocationId: string | null;
	weatherByLocation: Record<string, ILocationWeatherData>;
	temperatureUnit: 'celsius' | 'fahrenheit';
	weatherFetchCompleted: boolean;
}

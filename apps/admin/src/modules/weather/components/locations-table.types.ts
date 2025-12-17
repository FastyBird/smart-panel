import type { IWeatherLocationsFilter } from '../composables/types';
import type { ILocationWeatherData } from '../composables/useLocationsWeather';
import type { IWeatherLocation } from '../store/locations.store.types';

export interface ILocationsTableProps {
	items: IWeatherLocation[];
	totalRows: number;
	loading: boolean;
	filtersActive: boolean;
	sortBy: 'name' | 'type';
	sortDir: 'ascending' | 'descending' | null;
	tableHeight: number;
	filters: IWeatherLocationsFilter;
	primaryLocationId: string | null;
	weatherByLocation: Record<string, ILocationWeatherData>;
	temperatureUnit: 'celsius' | 'fahrenheit';
	weatherFetchCompleted: boolean;
}

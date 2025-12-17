import type { ILocationWeatherData } from '../composables/useLocationsWeather';

export interface ILocationsTableColumnWeatherProps {
	locationId: string;
	weatherByLocation: Record<string, ILocationWeatherData>;
	temperatureUnit: 'celsius' | 'fahrenheit';
	fetchCompleted: boolean;
}

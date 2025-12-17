import type { IWeatherDay } from '../store/weather-day.store.types';
import type { IWeatherLocation } from '../store/locations.store.types';

export interface ILocationDetailProps {
	location: IWeatherLocation;
	current: IWeatherDay;
}

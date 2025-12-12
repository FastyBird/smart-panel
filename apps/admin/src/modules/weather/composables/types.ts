import type { ComputedRef, Ref } from 'vue';

import type { FormInstance } from 'element-plus';

import type { IWeatherLocation } from '../store/locations.store.types';
import type { IWeatherDay } from '../store/weather-day.store.types';
import type { IWeatherForecast } from '../store/weather-forecast.store.types';

export interface IUseWeatherLocations {
	locations: ComputedRef<IWeatherLocation[]>;
	areLoading: ComputedRef<boolean>;
	loaded: ComputedRef<boolean>;
	fetchLocations: () => Promise<void>;
}

export interface IUseWeatherLocation {
	location: ComputedRef<IWeatherLocation | null>;
	isLoading: ComputedRef<boolean>;
	fetchLocation: () => Promise<void>;
}

export interface IUseWeatherLocationAddForm {
	model: {
		id: string;
		type: string;
		name: string;
		[key: string]: unknown;
	};
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submit: () => Promise<void>;
}

export interface IUseWeatherLocationEditForm {
	model: {
		name: string;
		[key: string]: unknown;
	};
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submit: () => Promise<void>;
}

export interface IUseWeatherLocationsActions {
	remove: (id: IWeatherLocation['id']) => Promise<void>;
}

export interface IUseWeatherDay {
	weatherDay: ComputedRef<IWeatherDay | null>;
	isLoading: ComputedRef<boolean>;
	fetchWeatherDay: () => Promise<void>;
}

export interface IUseWeatherForecast {
	weatherForecast: ComputedRef<IWeatherForecast | null>;
	isLoading: ComputedRef<boolean>;
	fetchWeatherForecast: () => Promise<void>;
}

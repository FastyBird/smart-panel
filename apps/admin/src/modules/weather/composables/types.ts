import type { ComputedRef, Ref } from 'vue';

import type { FormInstance } from 'element-plus';

import type { IPlugin, IPluginElement } from '../../../common';
import type { IWeatherLocation } from '../store/locations.store.types';
import type { IWeatherDay } from '../store/weather-day.store.types';
import type { IWeatherForecast } from '../store/weather-forecast.store.types';
import type { ILocationPluginsComponents, ILocationPluginsSchemas } from '../weather.types';

export interface IWeatherLocationsFilter {
	search: string | undefined;
	types: string[];
	primary: 'all' | 'primary' | 'secondary';
}

export interface IUseLocationsDataSource {
	locations: ComputedRef<IWeatherLocation[]>;
	locationsPaginated: ComputedRef<IWeatherLocation[]>;
	totalRows: ComputedRef<number>;
	areLoading: ComputedRef<boolean>;
	loaded: ComputedRef<boolean>;
	fetchLocations: () => Promise<void>;
	filters: Ref<IWeatherLocationsFilter>;
	filtersActive: ComputedRef<boolean>;
	paginateSize: Ref<number>;
	paginatePage: Ref<number>;
	sortBy: Ref<'name' | 'type'>;
	sortDir: Ref<'ascending' | 'descending' | null>;
	resetFilter: () => void;
	primaryLocationId: ComputedRef<string | null>;
}

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
	bulkRemove: (locations: IWeatherLocation[]) => Promise<void>;
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

export interface IUseWeatherLocationsPlugin {
	plugin: ComputedRef<IPlugin<ILocationPluginsComponents, ILocationPluginsSchemas> | undefined>;
	element: ComputedRef<IPluginElement<ILocationPluginsComponents, ILocationPluginsSchemas> | undefined>;
}

export interface IUseWeatherLocationsPlugins {
	plugins: ComputedRef<IPlugin<ILocationPluginsComponents, ILocationPluginsSchemas>[]>;
	options: ComputedRef<{ value: IPluginElement['type']; label: string; disabled: boolean }[]>;
	getByName: (type: IPlugin['type']) => IPlugin<ILocationPluginsComponents, ILocationPluginsSchemas> | undefined;
	getByType: (type: IPluginElement['type']) => IPlugin<ILocationPluginsComponents, ILocationPluginsSchemas> | undefined;
	getElement: (type: IPluginElement['type']) => IPluginElement<ILocationPluginsComponents, ILocationPluginsSchemas> | undefined;
}

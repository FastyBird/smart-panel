import { computed, ref, watch } from 'vue';

import { storeToRefs } from 'pinia';

import { orderBy } from 'natural-orderby';

import { injectStoresManager } from '../../../common';
import { useConfigModule } from '../../config';
import { WEATHER_MODULE_NAME } from '../weather.constants';
import { weatherLocationsStoreKey } from '../store/keys';
import type { IWeatherLocation } from '../store/locations.store.types';

import type { IUseLocationsDataSource, IWeatherLocationsFilter } from './types';

export const defaultLocationsFilter: IWeatherLocationsFilter = {
	search: undefined,
	types: [],
	primary: 'all',
};

export const useLocationsDataSource = (): IUseLocationsDataSource => {
	const storesManager = injectStoresManager();

	const locationsStore = storesManager.getStore(weatherLocationsStoreKey);

	const { firstLoad, semaphore } = storeToRefs(locationsStore);

	const { configModule: weatherConfig } = useConfigModule({ type: WEATHER_MODULE_NAME });

	const primaryLocationId = computed<string | null>((): string | null => {
		const config = weatherConfig.value as { primaryLocationId?: string | null } | null;
		return config?.primaryLocationId ?? null;
	});

	const paginateSize = ref<number>(10);

	const paginatePage = ref<number>(1);

	const filters = ref<IWeatherLocationsFilter>({ ...defaultLocationsFilter });

	const filtersActive = computed<boolean>((): boolean => {
		return (
			filters.value.search !== defaultLocationsFilter.search ||
			filters.value.types.length > 0 ||
			filters.value.primary !== defaultLocationsFilter.primary
		);
	});

	const sortBy = ref<'name' | 'type'>('name');

	const sortDir = ref<'ascending' | 'descending' | null>('ascending');

	const locations = computed<IWeatherLocation[]>((): IWeatherLocation[] => {
		return orderBy<IWeatherLocation>(
			locationsStore
				.findAll()
				.filter((location) => {
					if (location.draft) return false;
					if (filters.value.search && !location.name.toLowerCase().includes(filters.value.search.toLowerCase())) return false;
					if (filters.value.types.length > 0 && !filters.value.types.includes(location.type)) return false;
					if (filters.value.primary === 'primary' && location.id !== primaryLocationId.value) return false;
					if (filters.value.primary === 'secondary' && location.id === primaryLocationId.value) return false;
					return true;
				}),
			[(location: IWeatherLocation) => location[sortBy.value as keyof IWeatherLocation] ?? ''],
			[sortDir.value === 'ascending' ? 'asc' : 'desc']
		);
	});

	const locationsPaginated = computed<IWeatherLocation[]>((): IWeatherLocation[] => {
		const start = (paginatePage.value - 1) * paginateSize.value;
		const end = start + paginateSize.value;

		return locations.value.slice(start, end);
	});

	const fetchLocations = async (): Promise<void> => {
		await locationsStore.fetch();
	};

	const areLoading = computed<boolean>((): boolean => {
		if (semaphore.value.fetching.items) {
			return true;
		}

		if (firstLoad.value) {
			return false;
		}

		return semaphore.value.fetching.items;
	});

	const loaded = computed<boolean>((): boolean => {
		return firstLoad.value;
	});

	const totalRows = computed<number>(() => locationsStore.findAll().filter((location) => !location.draft).length);

	const resetFilter = (): void => {
		filters.value = { ...defaultLocationsFilter };
	};

	watch(
		(): IWeatherLocationsFilter => filters.value,
		(): void => {
			paginatePage.value = 1;
		},
		{ deep: true }
	);

	return {
		locations,
		locationsPaginated,
		totalRows,
		areLoading,
		loaded,
		fetchLocations,
		filters,
		filtersActive,
		paginateSize,
		paginatePage,
		sortBy,
		sortDir,
		resetFilter,
		primaryLocationId,
	};
};

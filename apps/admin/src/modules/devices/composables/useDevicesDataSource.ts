import { computed, ref, watch } from 'vue';

import { storeToRefs } from 'pinia';

import { cloneDeep, isEqual } from 'lodash';
import { orderBy } from 'natural-orderby';

import { injectStoresManager } from '../../../common';
import type { IDevice } from '../store/devices.store.types';
import { devicesStoreKey } from '../store/keys';

import type { IDevicesFilter, IUseDevicesDataSource } from './types';

export const defaultDevicesFilter: IDevicesFilter = {
	search: undefined,
	types: [],
	state: 'all',
	states: [],
	categories: [],
};

export const useDevicesDataSource = (): IUseDevicesDataSource => {
	const storesManager = injectStoresManager();

	const devicesStore = storesManager.getStore(devicesStoreKey);

	const { firstLoad, semaphore } = storeToRefs(devicesStore);

	const paginateSize = ref<number>(10);

	const paginatePage = ref<number>(1);

	const filters = ref<IDevicesFilter>(cloneDeep<IDevicesFilter>(defaultDevicesFilter));

	const filtersActive = computed<boolean>((): boolean => {
		return (
			filters.value.search !== defaultDevicesFilter.search ||
			!isEqual(filters.value.types, defaultDevicesFilter.types) ||
			filters.value.state !== defaultDevicesFilter.state ||
			!isEqual(filters.value.states, defaultDevicesFilter.states) ||
			!isEqual(filters.value.categories, defaultDevicesFilter.categories)
		);
	});

	const sortBy = ref<'name' | 'description' | 'type' | 'category'>('name');

	const sortDir = ref<'ascending' | 'descending' | null>('ascending');

	const devices = computed<IDevice[]>((): IDevice[] => {
		return orderBy<IDevice>(
			devicesStore
				.findAll()
				.filter(
					(device) =>
						!device.draft &&
						(!filters.value.search ||
							device.name.toLowerCase().includes(filters.value.search.toLowerCase()) ||
							device.description?.toLowerCase().includes(filters.value.search.toLowerCase())) &&
						(filters.value.types.length === 0 || filters.value.types.includes(device.type))
				),
			[(device: IDevice) => device[sortBy.value as keyof IDevice] ?? ''],
			[sortDir.value === 'ascending' ? 'asc' : 'desc']
		);
	});

	const devicesPaginated = computed<IDevice[]>((): IDevice[] => {
		const start = (paginatePage.value - 1) * paginateSize.value;
		const end = start + paginateSize.value;

		return devices.value.slice(start, end);
	});

	const fetchDevices = async (): Promise<void> => {
		await devicesStore.fetch();
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

	const totalRows = computed<number>(() => devicesStore.findAll().filter((device) => !device.draft).length);

	const resetFilter = (): void => {
		filters.value = cloneDeep<IDevicesFilter>(defaultDevicesFilter);
	};

	watch(
		(): IDevicesFilter => filters.value,
		(): void => {
			paginatePage.value = 1;
		},
		{ deep: true }
	);

	return {
		devices,
		devicesPaginated,
		totalRows,
		areLoading,
		loaded,
		fetchDevices,
		filters,
		filtersActive,
		paginateSize,
		paginatePage,
		sortBy,
		sortDir,
		resetFilter,
	};
};

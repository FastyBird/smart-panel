import { computed, ref, watch } from 'vue';

import { storeToRefs } from 'pinia';

import { cloneDeep } from 'lodash';
import { orderBy } from 'natural-orderby';

import { injectStoresManager } from '../../../common';
import type { IHomeAssistantDiscoveredDevice } from '../store/home-assistant-discovered-devices.store.types';
import { discoveredDevicesStoreKey } from '../store/keys';

import type { IDiscoveredDevicesFilter, IUseDiscoveredDevicesDataSource } from './types';

export const defaultDiscoveredDevicesFilter: IDiscoveredDevicesFilter = {
	search: undefined,
	adopted: undefined,
};

export const useDiscoveredDevicesDataSource = (): IUseDiscoveredDevicesDataSource => {
	const storesManager = injectStoresManager();

	const devicesStore = storesManager.getStore(discoveredDevicesStoreKey);

	const { firstLoad, semaphore } = storeToRefs(devicesStore);

	const paginateSize = ref<number>(10);

	const paginatePage = ref<number>(1);

	const filters = ref<IDiscoveredDevicesFilter>(cloneDeep<IDiscoveredDevicesFilter>(defaultDiscoveredDevicesFilter));

	const filtersActive = computed<boolean>((): boolean => {
		return filters.value.search !== defaultDiscoveredDevicesFilter.search || filters.value.adopted !== defaultDiscoveredDevicesFilter.adopted;
	});

	const sortBy = ref<'name' | 'adoptedDeviceId'>('name');

	const sortDir = ref<'ascending' | 'descending' | null>('ascending');

	const discoveredDevices = computed<IHomeAssistantDiscoveredDevice[]>((): IHomeAssistantDiscoveredDevice[] => {
		return orderBy<IHomeAssistantDiscoveredDevice>(
			devicesStore
				.findAll()
				.filter(
					(device) =>
						(!filters.value.search || device.name.toLowerCase().includes(filters.value.search.toLowerCase())) &&
						(!filters.value.adopted ||
							(filters.value.adopted && device.adoptedDeviceId !== null) ||
							(!filters.value.adopted && device.adoptedDeviceId === null))
				),
			[(device: IHomeAssistantDiscoveredDevice) => device[sortBy.value as keyof IHomeAssistantDiscoveredDevice] ?? ''],
			[sortDir.value === 'ascending' ? 'asc' : 'desc']
		);
	});

	const discoveredDevicesPaginated = computed<IHomeAssistantDiscoveredDevice[]>((): IHomeAssistantDiscoveredDevice[] => {
		const start = (paginatePage.value - 1) * paginateSize.value;
		const end = start + paginateSize.value;

		return discoveredDevices.value.slice(start, end);
	});

	const fetchDiscoveredDevices = async (): Promise<void> => {
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

	const totalRows = computed<number>(() => devicesStore.findAll().length);

	const resetFilter = (): void => {
		filters.value = cloneDeep<IDiscoveredDevicesFilter>(defaultDiscoveredDevicesFilter);
	};

	watch(
		(): IDiscoveredDevicesFilter => filters.value,
		(): void => {
			paginatePage.value = 1;
		},
		{ deep: true }
	);

	return {
		discoveredDevices,
		discoveredDevicesPaginated,
		totalRows,
		areLoading,
		loaded,
		fetchDiscoveredDevices,
		filters,
		filtersActive,
		paginateSize,
		paginatePage,
		sortBy,
		sortDir,
		resetFilter,
	};
};

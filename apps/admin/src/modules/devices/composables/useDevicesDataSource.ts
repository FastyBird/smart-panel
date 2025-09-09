import { computed, ref, watch } from 'vue';

import { storeToRefs } from 'pinia';

import { cloneDeep, isEqual } from 'lodash';
import { orderBy } from 'natural-orderby';

import { injectStoresManager } from '../../../common';
import { DevicesModuleChannelCategory, DevicesModuleChannelPropertyCategory } from '../../../openapi';
import { ConnectionState } from '../devices.constants';
import type { IDevice } from '../store/devices.store.types';
import { channelsPropertiesStoreKey, channelsStoreKey, devicesStoreKey } from '../store/keys';

import type { IDevicesFilter, IUseDevicesDataSource } from './types';

export const defaultDevicesFilter: IDevicesFilter = {
	search: undefined,
	types: [],
	state: 'all',
	states: [],
	categories: [],
	enabled: 'all',
};

export const useDevicesDataSource = (): IUseDevicesDataSource => {
	const storesManager = injectStoresManager();

	const devicesStore = storesManager.getStore(devicesStoreKey);

	const channelsStore = storesManager.getStore(channelsStoreKey);

	const channelsPropertiesStore = storesManager.getStore(channelsPropertiesStoreKey);

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
			!isEqual(filters.value.categories, defaultDevicesFilter.categories) ||
			!isEqual(filters.value.enabled, defaultDevicesFilter.enabled)
		);
	});

	const sortBy = ref<'name' | 'description' | 'type' | 'state' | 'category'>('name');

	const sortDir = ref<'ascending' | 'descending' | null>('ascending');

	const states = computed<Map<IDevice['id'], ConnectionState>>((): Map<IDevice['id'], ConnectionState> => {
		const devices = devicesStore.findAll();

		const statesMap = new Map();

		for (const device of devices) {
			const channel =
				channelsStore.findForDevice(device.id).find((channel) => channel.category === DevicesModuleChannelCategory.device_information) || null;

			if (!channel) {
				statesMap.set(device.id, ConnectionState.UNKNOWN);

				continue;
			}

			const property =
				channelsPropertiesStore.findForChannel(channel.id).find((property) => property.category === DevicesModuleChannelPropertyCategory.status) ||
				null;

			if (!property) {
				statesMap.set(device.id, ConnectionState.UNKNOWN);

				continue;
			}

			if (typeof property.value === 'string' && Object.values(ConnectionState).includes(property.value as ConnectionState)) {
				statesMap.set(device.id, property.value as ConnectionState);

				continue;
			}

			statesMap.set(device.id, ConnectionState.UNKNOWN);
		}

		return statesMap;
	});

	const devices = computed<IDevice[]>((): IDevice[] => {
		return orderBy<IDevice>(
			devicesStore
				.findAll()
				.filter(
					(device) =>
						!device.draft &&
						(!filters.value.search ||
							device.id.toLowerCase().includes(filters.value.search.toLowerCase()) ||
							device.name.toLowerCase().includes(filters.value.search.toLowerCase()) ||
							device.description?.toLowerCase().includes(filters.value.search.toLowerCase()) ||
							device.identifier?.toLowerCase().includes(filters.value.search.toLowerCase())) &&
						(filters.value.types.length === 0 || filters.value.types.includes(device.type)) &&
						(filters.value.enabled === 'all' ||
							(filters.value.enabled === 'enabled' && device.enabled) ||
							(filters.value.enabled === 'disabled' && !device.enabled)) &&
						(filters.value.states.length === 0 ||
							(states.value.has(device.id) && filters.value.states.includes(states.value.get(device.id) as ConnectionState))) &&
						(filters.value.state === 'all' ||
							(filters.value.state === 'online' &&
								states.value.has(device.id) &&
								[ConnectionState.READY, ConnectionState.CONNECTED, ConnectionState.RUNNING].includes(
									states.value.get(device.id) as ConnectionState
								)) ||
							(filters.value.state === 'offline' &&
								states.value.has(device.id) &&
								[ConnectionState.DISCONNECTED, ConnectionState.STOPPED, ConnectionState.LOST, ConnectionState.UNKNOWN].includes(
									states.value.get(device.id) as ConnectionState
								)))
				),
			[(device: IDevice) => (sortBy.value === 'state' ? (states.value.get(device.id) ?? '') : (device[sortBy.value as keyof IDevice] ?? ''))],
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

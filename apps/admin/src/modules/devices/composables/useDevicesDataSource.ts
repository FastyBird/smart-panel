import { computed, ref, watch } from 'vue';

import { storeToRefs } from 'pinia';

import { isEqual } from 'lodash';
import { orderBy } from 'natural-orderby';

import { type ISortEntry, injectStoresManager, useListQuery } from '../../../common';
import { DevicesModuleChannelCategory, DevicesModuleChannelPropertyCategory } from '../../../openapi';
import { ConnectionState, DEFAULT_PAGE, DEFAULT_PAGE_SIZE, DEVICES_MODULE_NAME } from '../devices.constants';
import type { IDevice } from '../store/devices.store.types';
import { channelsPropertiesStoreKey, channelsStoreKey, devicesStoreKey } from '../store/keys';

import { DevicesFilterSchema } from './schemas';
import type { IDevicesFilter, IUseDevicesDataSource } from './types';

export const defaultDevicesFilter: IDevicesFilter = {
	search: undefined,
	types: [],
	state: 'all',
	states: [],
	categories: [],
	enabled: 'all',
};

export const defaultDevicesSort: ISortEntry = {
	by: 'name',
	dir: 'asc',
};

export const useDevicesDataSource = (): IUseDevicesDataSource => {
	const storesManager = injectStoresManager();

	const devicesStore = storesManager.getStore(devicesStoreKey);

	const channelsStore = storesManager.getStore(channelsStoreKey);

	const channelsPropertiesStore = storesManager.getStore(channelsPropertiesStoreKey);

	const { firstLoad, semaphore } = storeToRefs(devicesStore);

	const {
		filters,
		sort,
		pagination,
		reset: resetFilter,
	} = useListQuery<typeof DevicesFilterSchema>({
		key: `${DEVICES_MODULE_NAME}:devices:list`,
		filters: {
			schema: DevicesFilterSchema,
			defaults: defaultDevicesFilter,
		},
		sort: {
			defaults: [defaultDevicesSort],
		},
		pagination: {
			defaults: {
				page: DEFAULT_PAGE,
				size: DEFAULT_PAGE_SIZE,
			},
		},
		syncQuery: true,
		version: 1,
	});

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

	const paginateSize = ref<number>(pagination.value.size || DEFAULT_PAGE_SIZE);

	const paginatePage = ref<number>(pagination.value.page || DEFAULT_PAGE);

	const sortBy = ref<'name' | 'description' | 'type' | 'state' | 'category' | undefined>(
		sort.value.length > 0 ? (sort.value[0].by as 'name' | 'description' | 'type' | 'state' | 'category') : undefined
	);

	const sortDir = ref<'asc' | 'desc' | null>(sort.value.length > 0 ? sort.value[0].dir : null);

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
						(filters.value.categories.length === 0 || filters.value.categories.includes(device.category)) &&
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
			[sortDir.value === 'asc' ? 'asc' : 'desc']
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

	watch(
		(): { page?: number; size?: number } => pagination.value,
		(val: { page?: number; size?: number }): void => {
			paginatePage.value = val.page ?? DEFAULT_PAGE;
			paginateSize.value = val.size ?? DEFAULT_PAGE_SIZE;
		},
		{ deep: true }
	);

	watch(
		(): number => paginatePage.value,
		(val: number): void => {
			pagination.value.page = val;
		}
	);

	watch(
		(): number => paginateSize.value,
		(val: number): void => {
			pagination.value.size = val;
		}
	);

	watch(
		(): 'asc' | 'desc' | null => sortDir.value,
		(val: 'asc' | 'desc' | null): void => {
			if (typeof sortBy.value === 'undefined') {
				sort.value = [];
			} else {
				sort.value = [
					{
						by: sortBy.value,
						dir: val,
					},
				];
			}
		}
	);

	watch(
		(): 'name' | 'description' | 'type' | 'state' | 'category' | undefined => sortBy.value,
		(val: 'name' | 'description' | 'type' | 'state' | 'category' | undefined): void => {
			if (typeof val === 'undefined') {
				sort.value = [];
			} else {
				sort.value = [
					{
						by: val,
						dir: sortDir.value,
					},
				];
			}
		}
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

import { computed, ref, watch } from 'vue';

import { storeToRefs } from 'pinia';

import { isEqual } from 'lodash';
import { orderBy } from 'natural-orderby';

import { type ISortEntry, injectStoresManager, useListQuery } from '../../../common';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, DEVICES_MODULE_NAME } from '../devices.constants';
import type { IChannel } from '../store/channels.store.types';
import type { IDevice } from '../store/devices.store.types';
import { channelsStoreKey } from '../store/keys';

import { ChannelsFilterSchema } from './schemas';
import type { IChannelsFilter, IUseChannelsDataSource } from './types';

export const defaultChannelsFilter: IChannelsFilter = {
	search: undefined,
	devices: [],
	categories: [],
};

export const defaultChannelsSort: ISortEntry = {
	by: 'name',
	dir: 'asc',
};

interface IUseChannelsDataSourceProps {
	deviceId?: IDevice['id'];
}

export const useChannelsDataSource = (props: IUseChannelsDataSourceProps = {}): IUseChannelsDataSource => {
	const { deviceId } = props;

	const storesManager = injectStoresManager();

	const channelsStore = storesManager.getStore(channelsStoreKey);

	const { firstLoad, semaphore } = storeToRefs(channelsStore);

	const {
		filters,
		sort,
		pagination,
		reset: resetFilter,
	} = useListQuery<typeof ChannelsFilterSchema>({
		key: `${DEVICES_MODULE_NAME}:channels:list`,
		filters: {
			schema: ChannelsFilterSchema,
			defaults: defaultChannelsFilter,
		},
		sort: {
			defaults: [defaultChannelsSort],
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
			filters.value.search !== defaultChannelsFilter.search ||
			!isEqual(filters.value.devices, defaultChannelsFilter.devices) ||
			!isEqual(filters.value.categories, defaultChannelsFilter.categories)
		);
	});

	const paginateSize = ref<number>(pagination.value.size || DEFAULT_PAGE_SIZE);

	const paginatePage = ref<number>(pagination.value.page || DEFAULT_PAGE);

	const sortBy = ref<'name' | 'description' | 'category' | undefined>(
		sort.value.length > 0 ? (sort.value[0].by as 'name' | 'description' | 'category') : undefined
	);

	const sortDir = ref<'asc' | 'desc' | null>(sort.value.length > 0 ? sort.value[0].dir : null);

	const channels = computed<IChannel[]>((): IChannel[] => {
		return orderBy<IChannel>(
			channelsStore
				.findAll()
				.filter((channel) => !deviceId || channel.device === deviceId)
				.filter(
					(channel) =>
						!channel.draft &&
						(!filters.value.search ||
							channel.id.toLowerCase().includes(filters.value.search.toLowerCase()) ||
							channel.name.toLowerCase().includes(filters.value.search.toLowerCase()) ||
							channel.description?.toLowerCase().includes(filters.value.search.toLowerCase()) ||
							channel.identifier?.toLowerCase().includes(filters.value.search.toLowerCase())) &&
						(filters.value.categories.length === 0 || filters.value.categories.includes(channel.category)) &&
						(filters.value.devices.length === 0 || filters.value.devices.includes(channel.device))
				),
			[(channel: IChannel) => channel[sortBy.value as keyof IChannel] ?? ''],
			[sortDir.value === 'asc' ? 'asc' : 'desc']
		);
	});

	const channelsPaginated = computed<IChannel[]>((): IChannel[] => {
		const start = (paginatePage.value - 1) * paginateSize.value;
		const end = start + paginateSize.value;

		return channels.value.slice(start, end);
	});

	const fetchChannels = async (): Promise<void> => {
		await channelsStore.fetch({ deviceId });
	};

	const areLoading = computed<boolean>((): boolean => {
		if (semaphore.value.fetching.items.includes(deviceId ?? 'all')) {
			return true;
		}

		if (firstLoad.value.includes(deviceId ?? 'all')) {
			return false;
		}

		return semaphore.value.fetching.items.includes(deviceId ?? 'all');
	});

	const loaded = computed<boolean>((): boolean => {
		return firstLoad.value.includes(deviceId ?? 'all');
	});

	const totalRows = computed<number>(
		() =>
			channelsStore
				.findAll()
				.filter((channel) => !deviceId || channel.device === deviceId)
				.filter((channel) => !channel.draft).length
	);

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
			if (typeof sortBy.value === 'undefined' || val === null) {
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
		(): 'name' | 'description' | 'category' | undefined => sortBy.value,
		(val: 'name' | 'description' | 'category' | undefined): void => {
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
		channels,
		channelsPaginated,
		totalRows,
		areLoading,
		loaded,
		fetchChannels,
		filters,
		filtersActive,
		paginateSize,
		paginatePage,
		sortBy,
		sortDir,
		resetFilter,
	};
};

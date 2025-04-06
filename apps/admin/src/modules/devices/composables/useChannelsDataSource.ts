import { computed, ref, watch } from 'vue';

import { storeToRefs } from 'pinia';

import { cloneDeep, isEqual } from 'lodash';
import { orderBy } from 'natural-orderby';

import { injectStoresManager } from '../../../common';
import type { IChannel } from '../store/channels.store.types';
import type { IDevice } from '../store/devices.store.types';
import { channelsStoreKey } from '../store/keys';

import type { IChannelsFilter, IUseChannelsDataSource } from './types';

export const defaultChannelsFilter: IChannelsFilter = {
	search: undefined,
	devices: [],
	categories: [],
};

interface IUseChannelsDataSourceProps {
	deviceId?: IDevice['id'];
}

export const useChannelsDataSource = (props: IUseChannelsDataSourceProps = {}): IUseChannelsDataSource => {
	const { deviceId } = props;

	const storesManager = injectStoresManager();

	const channelsStore = storesManager.getStore(channelsStoreKey);

	const { firstLoad, semaphore } = storeToRefs(channelsStore);

	const paginateSize = ref<number>(10);

	const paginatePage = ref<number>(1);

	const filters = ref<IChannelsFilter>(cloneDeep<IChannelsFilter>(defaultChannelsFilter));

	const filtersActive = computed<boolean>((): boolean => {
		return (
			filters.value.search !== defaultChannelsFilter.search ||
			!isEqual(filters.value.devices, defaultChannelsFilter.devices) ||
			!isEqual(filters.value.categories, defaultChannelsFilter.categories)
		);
	});

	const sortBy = ref<'name' | 'description' | 'category'>('name');

	const sortDir = ref<'ascending' | 'descending' | null>('ascending');

	const channels = computed<IChannel[]>((): IChannel[] => {
		return orderBy<IChannel>(
			channelsStore
				.findAll()
				.filter((channel) => !deviceId || channel.device === deviceId)
				.filter(
					(channel) =>
						!channel.draft &&
						(!filters.value.search ||
							channel.name.toLowerCase().includes(filters.value.search.toLowerCase()) ||
							channel.description?.toLowerCase().includes(filters.value.search.toLowerCase()))
				),
			[(channel: IChannel) => channel[sortBy.value as keyof IChannel] ?? ''],
			[sortDir.value === 'ascending' ? 'asc' : 'desc']
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

	const resetFilter = (): void => {
		filters.value = cloneDeep<IChannelsFilter>(defaultChannelsFilter);
	};

	watch(
		(): IChannelsFilter => filters.value,
		(): void => {
			paginatePage.value = 1;
		},
		{ deep: true }
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

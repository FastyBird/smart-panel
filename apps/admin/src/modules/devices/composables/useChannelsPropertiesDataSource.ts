import { computed, ref, watch } from 'vue';

import { storeToRefs } from 'pinia';

import { cloneDeep, isEqual } from 'lodash';
import { orderBy } from 'natural-orderby';

import { injectStoresManager } from '../../../common';
import type { IChannelProperty } from '../store/channels.properties.store.types';
import type { IChannel } from '../store/channels.store.types';
import { channelsPropertiesStoreKey } from '../store/keys';

import type { IChannelsPropertiesFilter, IUseChannelsPropertiesDataSource } from './types';

export const defaultChannelsPropertiesFilter: IChannelsPropertiesFilter = {
	search: undefined,
	channels: [],
	categories: [],
	permissions: [],
	dataTypes: [],
};

interface IUseChannelsPropertiesDataSourceProps {
	channelId: IChannel['id'];
}

export const useChannelsPropertiesDataSource = ({ channelId }: IUseChannelsPropertiesDataSourceProps): IUseChannelsPropertiesDataSource => {
	const storesManager = injectStoresManager();

	const propertiesStore = storesManager.getStore(channelsPropertiesStoreKey);

	const { firstLoad, semaphore } = storeToRefs(propertiesStore);

	const paginateSize = ref<number>(10);

	const paginatePage = ref<number>(1);

	const filters = ref<IChannelsPropertiesFilter>(cloneDeep<IChannelsPropertiesFilter>(defaultChannelsPropertiesFilter));

	const filtersActive = computed<boolean>((): boolean => {
		return (
			filters.value.search !== defaultChannelsPropertiesFilter.search ||
			!isEqual(filters.value.channels, defaultChannelsPropertiesFilter.channels) ||
			!isEqual(filters.value.categories, defaultChannelsPropertiesFilter.categories) ||
			!isEqual(filters.value.permissions, defaultChannelsPropertiesFilter.permissions) ||
			!isEqual(filters.value.dataTypes, defaultChannelsPropertiesFilter.dataTypes)
		);
	});

	const sortBy = ref<'name' | 'category'>('category');

	const sortDir = ref<'ascending' | 'descending' | null>('ascending');

	const properties = computed<IChannelProperty[]>((): IChannelProperty[] => {
		return orderBy<IChannelProperty>(
			propertiesStore
				.findAll()
				.filter((property) => !channelId || property.channel === channelId)
				.filter(
					(property) =>
						!property.draft &&
						(!filters.value.search ||
							property.id?.toLowerCase().includes(filters.value.search.toLowerCase()) ||
							property.name?.toLowerCase().includes(filters.value.search.toLowerCase()) ||
							property.identifier?.toLowerCase().includes(filters.value.search.toLowerCase()))
				),
			[(property: IChannelProperty) => property[sortBy.value as keyof IChannelProperty] ?? ''],
			[sortDir.value === 'ascending' ? 'asc' : 'desc']
		);
	});

	const propertiesPaginated = computed<IChannelProperty[]>((): IChannelProperty[] => {
		const start = (paginatePage.value - 1) * paginateSize.value;
		const end = start + paginateSize.value;

		return properties.value.slice(start, end);
	});

	const fetchProperties = async (): Promise<void> => {
		await propertiesStore.fetch({ channelId });
	};

	const areLoading = computed<boolean>((): boolean => {
		if (semaphore.value.fetching.items.includes(channelId)) {
			return true;
		}

		if (firstLoad.value.includes(channelId)) {
			return false;
		}

		return semaphore.value.fetching.items.includes(channelId);
	});

	const loaded = computed<boolean>((): boolean => {
		return firstLoad.value.includes(channelId);
	});

	const totalRows = computed<number>(
		() =>
			propertiesStore
				.findAll()
				.filter((property) => !channelId || property.channel === channelId)
				.filter((property) => !property.draft).length
	);

	const resetFilter = (): void => {
		filters.value = cloneDeep<IChannelsPropertiesFilter>(defaultChannelsPropertiesFilter);
	};

	watch(
		(): IChannelsPropertiesFilter => filters.value,
		(): void => {
			paginatePage.value = 1;
		},
		{ deep: true }
	);

	return {
		properties,
		propertiesPaginated,
		totalRows,
		areLoading,
		loaded,
		fetchProperties,
		filters,
		filtersActive,
		paginateSize,
		paginatePage,
		sortBy,
		sortDir,
		resetFilter,
	};
};

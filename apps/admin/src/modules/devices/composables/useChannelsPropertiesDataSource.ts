import { computed, ref, watch } from 'vue';

import { storeToRefs } from 'pinia';

import { isEqual } from 'lodash';
import { orderBy } from 'natural-orderby';

import { type ISortEntry, injectStoresManager, useListQuery } from '../../../common';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, DEVICES_MODULE_NAME } from '../devices.constants';
import type { IChannelProperty } from '../store/channels.properties.store.types';
import type { IChannel } from '../store/channels.store.types';
import { channelsPropertiesStoreKey } from '../store/keys';

import { ChannelsPropertiesFilterSchema } from './schemas';
import type { IChannelsPropertiesFilter, IUseChannelsPropertiesDataSource } from './types';

export const defaultChannelsPropertiesFilter: IChannelsPropertiesFilter = {
	search: undefined,
	channels: [],
	categories: [],
	permissions: [],
	dataTypes: [],
};

export const defaultChannelsPropertiesSort: ISortEntry = {
	by: 'category',
	dir: 'asc',
};

interface IUseChannelsPropertiesDataSourceProps {
	channelId: IChannel['id'];
	key?: string;
}

export const useChannelsPropertiesDataSource = ({
	channelId,
	key = 'list',
}: IUseChannelsPropertiesDataSourceProps): IUseChannelsPropertiesDataSource => {
	const storesManager = injectStoresManager();

	const propertiesStore = storesManager.getStore(channelsPropertiesStoreKey);

	const { firstLoad, semaphore } = storeToRefs(propertiesStore);

	const {
		filters,
		sort,
		pagination,
		reset: resetFilter,
	} = useListQuery<typeof ChannelsPropertiesFilterSchema>({
		key: `${DEVICES_MODULE_NAME}:channels-properties:${key}`,
		filters: {
			schema: ChannelsPropertiesFilterSchema,
			defaults: defaultChannelsPropertiesFilter,
		},
		sort: {
			defaults: [defaultChannelsPropertiesSort],
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
			filters.value.search !== defaultChannelsPropertiesFilter.search ||
			!isEqual(filters.value.channels, defaultChannelsPropertiesFilter.channels) ||
			!isEqual(filters.value.categories, defaultChannelsPropertiesFilter.categories) ||
			!isEqual(filters.value.permissions, defaultChannelsPropertiesFilter.permissions) ||
			!isEqual(filters.value.dataTypes, defaultChannelsPropertiesFilter.dataTypes)
		);
	});

	const paginateSize = ref<number>(pagination.value.size || DEFAULT_PAGE_SIZE);

	const paginatePage = ref<number>(pagination.value.page || DEFAULT_PAGE);

	const sortBy = ref<'name' | 'category' | undefined>(sort.value.length > 0 ? (sort.value[0].by as 'name' | 'category') : undefined);

	const sortDir = ref<'asc' | 'desc' | null>(sort.value.length > 0 ? sort.value[0].dir : null);

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
							property.identifier?.toLowerCase().includes(filters.value.search.toLowerCase())) &&
						(filters.value.categories.length === 0 || filters.value.categories.includes(property.category)) &&
						(filters.value.dataTypes.length === 0 || filters.value.dataTypes.includes(property.dataType)) &&
						(filters.value.permissions.length === 0 || property.permissions.some((perm) => filters.value.permissions.includes(perm)))
				),
			[(property: IChannelProperty) => property[sortBy.value as keyof IChannelProperty] ?? ''],
			[sortDir.value === 'asc' ? 'asc' : 'desc']
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
		(): 'name' | 'category' | undefined => sortBy.value,
		(val: 'name' | 'category' | undefined): void => {
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

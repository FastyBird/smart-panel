import { computed, ref, watch } from 'vue';

import { storeToRefs } from 'pinia';

import { orderBy } from 'natural-orderby';

import { type ISortEntry, injectStoresManager, useListQuery } from '../../../common';
import type { IExtension } from '../store/extensions.store.types';
import { extensionsStoreKey } from '../store/keys';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, SYSTEM_MODULE_NAME } from '../system.constants';

import { ExtensionsFilterSchema } from './schemas';
import type { IExtensionsFilter, IUseExtensionsDataSource } from './types';

export const defaultExtensionsFilter: IExtensionsFilter = {
	search: undefined,
	kinds: [],
	surfaces: [],
	sources: [],
};

export const defaultExtensionsSort: ISortEntry = {
	by: 'name',
	dir: 'asc',
};

export const useExtensionsDataSource = (): IUseExtensionsDataSource => {
	const storesManager = injectStoresManager();

	const extensionsStore = storesManager.getStore(extensionsStoreKey);

	const { firstLoad, semaphore } = storeToRefs(extensionsStore);

	const {
		filters,
		sort,
		pagination,
		reset: resetFilter,
	} = useListQuery<typeof ExtensionsFilterSchema>({
		key: `${SYSTEM_MODULE_NAME}:extensions:list`,
		filters: {
			schema: ExtensionsFilterSchema,
			defaults: defaultExtensionsFilter,
		},
		sort: {
			defaults: [defaultExtensionsSort],
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
		return filters.value.search !== defaultExtensionsFilter.search;
	});

	const paginateSize = ref<number>(pagination.value.size || DEFAULT_PAGE_SIZE);

	const paginatePage = ref<number>(pagination.value.page || DEFAULT_PAGE);

	const sortBy = ref<'name' | 'kind' | 'surface' | 'displayName' | 'version' | 'source' | undefined>(
		sort.value.length > 0 ? (sort.value[0].by as 'name' | 'kind' | 'surface' | 'displayName' | 'version' | 'source') : undefined
	);

	const sortDir = ref<'asc' | 'desc' | null>(sort.value.length > 0 ? sort.value[0].dir : null);

	const extensions = computed<{ admin?: IExtension; backend?: IExtension }[]>((): { admin?: IExtension; backend?: IExtension }[] => {
		return orderBy<{ admin?: IExtension; backend?: IExtension }>(
			extensionsStore
				.findAll()
				.filter(
					(extension) =>
						!filters.value.search ||
						extension.admin?.name.toLowerCase().includes(filters.value.search.toLowerCase()) ||
						extension.backend?.name.toLowerCase().includes(filters.value.search.toLowerCase()) ||
						extension.admin?.displayName.toLowerCase().includes(filters.value.search.toLowerCase()) ||
						extension.backend?.displayName.toLowerCase().includes(filters.value.search.toLowerCase()) ||
						extension.admin?.description?.toLowerCase().includes(filters.value.search.toLowerCase()) ||
						extension.backend?.description?.toLowerCase().includes(filters.value.search.toLowerCase()) ||
						extension.admin?.version?.toLowerCase().includes(filters.value.search.toLowerCase()) ||
						extension.backend?.version?.toLowerCase().includes(filters.value.search.toLowerCase())
				),
			[
				(extension: { admin?: IExtension; backend?: IExtension }) =>
					extension.admin?.[sortBy.value as keyof IExtension] ?? extension.backend?.[sortBy.value as keyof IExtension] ?? '',
			],
			[sortDir.value === 'asc' ? 'asc' : 'desc']
		);
	});

	const extensionsPaginated = computed<{ admin?: IExtension; backend?: IExtension }[]>((): { admin?: IExtension; backend?: IExtension }[] => {
		const start = (paginatePage.value - 1) * paginateSize.value;
		const end = start + paginateSize.value;

		return extensions.value.slice(start, end);
	});

	const fetchExtensions = async (): Promise<void> => {
		await extensionsStore.fetch();
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

	const totalRows = computed<number>(() => extensionsStore.findAll().length);

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
		(): 'name' | 'kind' | 'surface' | 'displayName' | 'version' | 'source' | undefined => sortBy.value,
		(val: 'name' | 'kind' | 'surface' | 'displayName' | 'version' | 'source' | undefined): void => {
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
		extensions,
		extensionsPaginated,
		totalRows,
		areLoading,
		loaded,
		fetchExtensions,
		filters,
		filtersActive,
		paginateSize,
		paginatePage,
		sortBy,
		sortDir,
		resetFilter,
	};
};

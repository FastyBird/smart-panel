import { type Ref, computed, ref, watch } from 'vue';

import { storeToRefs } from 'pinia';

import { orderBy } from 'natural-orderby';

import { type ISortEntry, injectStoresManager, useListQuery } from '../../../common';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, DEFAULT_VIEW_MODE, ExtensionKind, EXTENSIONS_MODULE_NAME } from '../extensions.constants';
import type { IExtension } from '../store/extensions.store.types';
import { extensionsStoreKey } from '../store/keys';

import { ExtensionsFilterSchema } from './schemas';
import type { ExtensionsViewMode, IExtensionsFilter, IUseExtensionsDataSource } from './types';

export const defaultExtensionsFilter: IExtensionsFilter = {
	search: undefined,
	kind: 'all',
	enabled: 'all',
	isCore: 'all',
};

export const defaultExtensionsSort: ISortEntry = {
	by: 'name',
	dir: 'asc',
};

export const useExtensionsDataSource = (): IUseExtensionsDataSource => {
	const storesManager = injectStoresManager();

	const extensionsStore = storesManager.getStore(extensionsStoreKey);

	const { semaphore } = storeToRefs(extensionsStore);

	const {
		filters,
		sort,
		pagination,
		viewMode: rawViewMode,
		reset: resetFilter,
	} = useListQuery<typeof ExtensionsFilterSchema, ExtensionsViewMode>({
		key: `${EXTENSIONS_MODULE_NAME}:extensions:list`,
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
		viewMode: {
			options: ['table', 'cards'],
			default: DEFAULT_VIEW_MODE,
		},
		syncQuery: true,
		version: 1,
	});

	// Ensure viewMode always has a value (fallback to default)
	const viewMode = computed({
		get: () => rawViewMode.value ?? DEFAULT_VIEW_MODE,
		set: (val: ExtensionsViewMode) => {
			rawViewMode.value = val;
		},
	}) as Ref<ExtensionsViewMode>;

	const filtersActive = computed<boolean>((): boolean => {
		return (
			filters.value.search !== defaultExtensionsFilter.search ||
			filters.value.kind !== defaultExtensionsFilter.kind ||
			filters.value.enabled !== defaultExtensionsFilter.enabled ||
			filters.value.isCore !== defaultExtensionsFilter.isCore
		);
	});

	const paginateSize = ref<number>(pagination.value.size || DEFAULT_PAGE_SIZE);

	const paginatePage = ref<number>(pagination.value.page || DEFAULT_PAGE);

	const sortBy = ref<'name' | 'type' | 'kind' | 'enabled' | undefined>(
		sort.value.length > 0 ? (sort.value[0]?.by as 'name' | 'type' | 'kind' | 'enabled') : undefined
	);

	const sortDir = ref<'asc' | 'desc' | null>(sort.value.length > 0 ? sort.value[0]?.dir ?? null : null);

	const allExtensions = computed<IExtension[]>((): IExtension[] => {
		return Object.values(extensionsStore.data);
	});

	const filteredExtensions = computed<IExtension[]>((): IExtension[] => {
		return orderBy<IExtension>(
			allExtensions.value.filter(
				(extension) =>
					// Search filter
					(!filters.value.search ||
						extension.type.toLowerCase().includes(filters.value.search.toLowerCase()) ||
						extension.name.toLowerCase().includes(filters.value.search.toLowerCase()) ||
						extension.description?.toLowerCase().includes(filters.value.search.toLowerCase())) &&
					// Kind filter
					(filters.value.kind === 'all' || extension.kind === filters.value.kind) &&
					// Enabled filter
					(filters.value.enabled === 'all' ||
						(filters.value.enabled === 'enabled' && extension.enabled) ||
						(filters.value.enabled === 'disabled' && !extension.enabled)) &&
					// Core filter
					(filters.value.isCore === 'all' ||
						(filters.value.isCore === 'core' && extension.isCore) ||
						(filters.value.isCore === 'addon' && !extension.isCore))
			),
			[
				(ext: IExtension) =>
					sortBy.value === 'enabled' ? (ext.enabled ? 1 : 0) : (ext[sortBy.value as keyof IExtension] ?? ''),
			],
			[sortDir.value === 'asc' ? 'asc' : 'desc']
		);
	});

	const extensions = computed<IExtension[]>((): IExtension[] => {
		return filteredExtensions.value;
	});

	const extensionsPaginated = computed<IExtension[]>((): IExtension[] => {
		const start = (paginatePage.value - 1) * paginateSize.value;
		const end = start + paginateSize.value;

		return extensions.value.slice(start, end);
	});

	const modules = computed<IExtension[]>((): IExtension[] => {
		return filteredExtensions.value.filter((ext) => ext.kind === ExtensionKind.MODULE);
	});

	const plugins = computed<IExtension[]>((): IExtension[] => {
		return filteredExtensions.value.filter((ext) => ext.kind === ExtensionKind.PLUGIN);
	});

	const fetchExtensions = async (): Promise<void> => {
		await extensionsStore.fetch();
	};

	const areLoading = computed<boolean>((): boolean => {
		return semaphore.value.fetching.items;
	});

	const totalRows = computed<number>(() => extensions.value.length);

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
		(): 'name' | 'type' | 'kind' | 'enabled' | undefined => sortBy.value,
		(val: 'name' | 'type' | 'kind' | 'enabled' | undefined): void => {
			if (typeof val === 'undefined' || sortDir.value === null) {
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
		modules,
		plugins,
		totalRows,
		areLoading,
		fetchExtensions,
		filters,
		filtersActive,
		paginateSize,
		paginatePage,
		sortBy,
		sortDir,
		viewMode,
		resetFilter,
	};
};

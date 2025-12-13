import { computed, ref, watch } from 'vue';

import { storeToRefs } from 'pinia';

import { isEqual } from 'lodash';
import { orderBy } from 'natural-orderby';

import { injectStoresManager, useListQuery } from '../../../common';
import { ExtensionKind, EXTENSIONS_MODULE_NAME } from '../extensions.constants';
import type { IExtension } from '../store/extensions.store.types';
import { extensionsStoreKey } from '../store/keys';

import { ExtensionsFilterSchema } from './schemas';
import type { IExtensionsFilter, IUseExtensionsDataSource } from './types';

export const defaultExtensionsFilter: IExtensionsFilter = {
	search: undefined,
	kind: 'all',
	enabled: 'all',
	isCore: 'all',
};

export const useExtensionsDataSource = (): IUseExtensionsDataSource => {
	const storesManager = injectStoresManager();

	const extensionsStore = storesManager.getStore(extensionsStoreKey);

	const { semaphore } = storeToRefs(extensionsStore);

	const {
		filters,
		reset: resetFilter,
	} = useListQuery<typeof ExtensionsFilterSchema>({
		key: `${EXTENSIONS_MODULE_NAME}:extensions:list`,
		filters: {
			schema: ExtensionsFilterSchema,
			defaults: defaultExtensionsFilter,
		},
		syncQuery: true,
		version: 1,
	});

	const filtersActive = computed<boolean>((): boolean => {
		return (
			filters.value.search !== defaultExtensionsFilter.search ||
			filters.value.kind !== defaultExtensionsFilter.kind ||
			filters.value.enabled !== defaultExtensionsFilter.enabled ||
			filters.value.isCore !== defaultExtensionsFilter.isCore
		);
	});

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
			[(ext: IExtension) => ext.name],
			['asc']
		);
	});

	const extensions = computed<IExtension[]>((): IExtension[] => {
		return filteredExtensions.value;
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

	return {
		extensions,
		modules,
		plugins,
		areLoading,
		fetchExtensions,
		filters,
		filtersActive,
		resetFilter,
	};
};

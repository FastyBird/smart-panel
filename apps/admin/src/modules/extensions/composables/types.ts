import type { ComputedRef, Ref } from 'vue';

import { z } from 'zod';

import type { IExtension } from '../store/extensions.store.types';

import { ExtensionsFilterSchema } from './schemas';

export type IExtensionsFilter = z.infer<typeof ExtensionsFilterSchema>;

export interface IUseExtensions {
	extensions: ComputedRef<IExtension[]>;
	modules: ComputedRef<IExtension[]>;
	plugins: ComputedRef<IExtension[]>;
	areLoading: ComputedRef<boolean>;
	fetchExtensions: () => Promise<void>;
}

export type ExtensionsViewMode = 'table' | 'cards';

export interface IUseExtensionsDataSource {
	extensions: ComputedRef<IExtension[]>;
	extensionsPaginated: ComputedRef<IExtension[]>;
	modules: ComputedRef<IExtension[]>;
	plugins: ComputedRef<IExtension[]>;
	totalRows: ComputedRef<number>;
	areLoading: ComputedRef<boolean>;
	fetchExtensions: () => Promise<void>;
	filters: Ref<IExtensionsFilter>;
	filtersActive: ComputedRef<boolean>;
	paginateSize: Ref<number>;
	paginatePage: Ref<number>;
	sortBy: Ref<'name' | 'type' | 'kind' | 'enabled' | undefined>;
	sortDir: Ref<'asc' | 'desc' | null>;
	viewMode: Ref<ExtensionsViewMode>;
	resetFilter: () => void;
}

export interface IUseExtensionActions {
	toggleEnabled: (type: IExtension['type'], enabled: boolean) => Promise<boolean>;
}

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

export interface IUseExtensionsDataSource {
	extensions: ComputedRef<IExtension[]>;
	modules: ComputedRef<IExtension[]>;
	plugins: ComputedRef<IExtension[]>;
	areLoading: ComputedRef<boolean>;
	fetchExtensions: () => Promise<void>;
	filters: Ref<IExtensionsFilter>;
	filtersActive: ComputedRef<boolean>;
	resetFilter: () => void;
}

export interface IUseExtensionActions {
	toggleEnabled: (type: IExtension['type'], enabled: boolean) => Promise<boolean>;
}

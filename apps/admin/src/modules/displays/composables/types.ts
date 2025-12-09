import type { ComputedRef, Ref } from 'vue';

import { z } from 'zod';

import type { IDisplay } from '../store/displays.store.types';

import { DisplaysFilterSchema } from './schemas';

export type IDisplaysFilter = z.infer<typeof DisplaysFilterSchema>;

export interface IUseDisplaysDataSource {
	displays: ComputedRef<IDisplay[]>;
	displaysPaginated: ComputedRef<IDisplay[]>;
	totalRows: ComputedRef<number>;
	areLoading: ComputedRef<boolean>;
	loaded: ComputedRef<boolean>;
	fetchDisplays: () => Promise<void>;
	filters: Ref<IDisplaysFilter>;
	filtersActive: ComputedRef<boolean>;
	paginateSize: Ref<number>;
	paginatePage: Ref<number>;
	sortBy: Ref<'name' | 'version' | 'screenWidth' | 'createdAt' | undefined>;
	sortDir: Ref<'asc' | 'desc' | null>;
	resetFilter: () => void;
}

export interface IUseDisplaysActions {
	remove: (id: IDisplay['id']) => Promise<void>;
}

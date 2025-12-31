import type { ComputedRef, Ref } from 'vue';

import { z } from 'zod';

import type { IScene } from '../store/scenes.store.types';

import { ScenesFilterSchema } from './schemas';

export type IScenesFilter = z.infer<typeof ScenesFilterSchema>;

export interface IUseScenesDataSource {
	scenes: ComputedRef<IScene[]>;
	scenesPaginated: ComputedRef<IScene[]>;
	totalRows: ComputedRef<number>;
	areLoading: ComputedRef<boolean>;
	loaded: ComputedRef<boolean>;
	fetchScenes: () => Promise<void>;
	filters: Ref<IScenesFilter>;
	filtersActive: ComputedRef<boolean>;
	paginateSize: Ref<number>;
	paginatePage: Ref<number>;
	sortBy: Ref<'name' | 'category' | 'displayOrder' | undefined>;
	sortDir: Ref<'asc' | 'desc' | null>;
	resetFilter: () => void;
}

export interface IUseScenesActions {
	remove: (id: IScene['id']) => Promise<void>;
	trigger: (id: IScene['id'], source?: string) => Promise<void>;
}

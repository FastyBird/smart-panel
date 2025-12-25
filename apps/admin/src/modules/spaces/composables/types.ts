import type { ComputedRef, Ref } from 'vue';

import type { SpaceType } from '../spaces.constants';
import type { ISpace, ISpaceEditData } from '../store/spaces.store.types';

export interface ISpacesFilter {
	search?: string | undefined;
	type: SpaceType | 'all';
}

export interface IUseSpacesDataSource {
	spaces: ComputedRef<ISpace[]>;
	spacesPaginated: ComputedRef<ISpace[]>;
	totalRows: ComputedRef<number>;
	areLoading: ComputedRef<boolean>;
	loaded: ComputedRef<boolean>;
	fetchSpaces: () => Promise<void>;
	filters: Ref<ISpacesFilter>;
	filtersActive: ComputedRef<boolean>;
	paginateSize: Ref<number>;
	paginatePage: Ref<number>;
	sortBy: Ref<'name' | 'type' | 'displayOrder' | undefined>;
	sortDir: Ref<'asc' | 'desc' | null>;
	resetFilter: () => void;
}

export interface IUseSpace {
	space: ComputedRef<ISpace | null>;
	fetching: ComputedRef<boolean>;
	fetchSpace: () => Promise<ISpace | null>;
	editSpace: (data: ISpaceEditData) => Promise<ISpace>;
	removeSpace: () => Promise<void>;
}

export interface IUseSpaces {
	spaces: ComputedRef<ISpace[]>;
	fetching: ComputedRef<boolean>;
	firstLoadFinished: ComputedRef<boolean>;
	fetchSpaces: () => Promise<ISpace[]>;
}

export interface IUseSpacesActions {
	remove: (id: ISpace['id']) => Promise<boolean>;
}

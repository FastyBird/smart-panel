import type { ComputedRef, Ref } from 'vue';

import type { IPage } from '../store';

export interface IPagesFilter {
	search: string | undefined;
	types: string[];
}

export interface IUsePage {
	page: ComputedRef<IPage | null>;
	isLoading: ComputedRef<boolean>;
	fetchPage: () => Promise<void>;
}

export interface IUsePages {
	pages: ComputedRef<IPage[]>;
	areLoading: ComputedRef<boolean>;
	loaded: ComputedRef<boolean>;
	fetchPages: () => Promise<void>;
}

export interface IUsePagesDataSource {
	pages: ComputedRef<IPage[]>;
	pagesPaginated: ComputedRef<IPage[]>;
	totalRows: ComputedRef<number>;
	areLoading: ComputedRef<boolean>;
	loaded: ComputedRef<boolean>;
	fetchPages: () => Promise<void>;
	filters: Ref<IPagesFilter>;
	filtersActive: ComputedRef<boolean>;
	paginateSize: Ref<number>;
	paginatePage: Ref<number>;
	sortBy: Ref<'title' | 'order' | 'type'>;
	sortDir: Ref<'ascending' | 'descending' | null>;
	resetFilter: () => void;
}

export interface IUsePagesActions {
	remove: (id: IPage['id']) => Promise<void>;
}

export interface IUsePageIcon {
	icon: ComputedRef<string>;
}

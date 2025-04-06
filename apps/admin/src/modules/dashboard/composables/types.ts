import type { ComputedRef, Ref } from 'vue';

import type { ICard } from '../store/cards.store.types';
import type { DataSourceParentTypeMap, IDataSource } from '../store/dataSources.store.types';
import type { IPage } from '../store/pages.store.types';
import type { ITile, TileParentTypeMap } from '../store/tiles.store.types';

export interface ICardsFilter {
	search: string | undefined;
	pages: IPage['id'][];
}

export interface IPagesFilter {
	search: string | undefined;
	types: string[];
}

export interface ITilesFilter {
	search: string | undefined;
	types: string[];
}

export interface IDataSourcesFilter {
	search: string | undefined;
	types: string[];
}

export interface IUseCard {
	card: ComputedRef<ICard | null>;
	isLoading: ComputedRef<boolean>;
	fetchCard: () => Promise<void>;
}

export interface IUseCards {
	cards: ComputedRef<ICard[]>;
	areLoading: ComputedRef<boolean>;
	loaded: ComputedRef<boolean>;
	fetchCards: () => Promise<void>;
}

export interface IUseCardsDataSource {
	cards: ComputedRef<ICard[]>;
	cardsPaginated: ComputedRef<ICard[]>;
	totalRows: ComputedRef<number>;
	areLoading: ComputedRef<boolean>;
	loaded: ComputedRef<boolean>;
	fetchCards: () => Promise<void>;
	filters: Ref<ICardsFilter>;
	filtersActive: ComputedRef<boolean>;
	paginateSize: Ref<number>;
	paginatePage: Ref<number>;
	sortBy: Ref<'title' | 'order'>;
	sortDir: Ref<'ascending' | 'descending' | null>;
	resetFilter: () => void;
}

export interface IUseCardsActions {
	remove: (id: ICard['id']) => Promise<void>;
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

export interface IUseTile<T extends keyof TileParentTypeMap> {
	tile: ComputedRef<TileParentTypeMap[T] | null>;
	isLoading: ComputedRef<boolean>;
	fetchTile: () => Promise<void>;
}

export interface IUseTiles<T extends keyof TileParentTypeMap> {
	tiles: ComputedRef<TileParentTypeMap[T][]>;
	areLoading: ComputedRef<boolean>;
	loaded: ComputedRef<boolean>;
	fetchTiles: () => Promise<void>;
}

export interface IUseTilesDataSource<T extends keyof TileParentTypeMap> {
	tiles: ComputedRef<TileParentTypeMap[T][]>;
	tilesPaginated: ComputedRef<TileParentTypeMap[T][]>;
	totalRows: ComputedRef<number>;
	areLoading: ComputedRef<boolean>;
	loaded: ComputedRef<boolean>;
	fetchTiles: () => Promise<void>;
	filters: Ref<ITilesFilter>;
	filtersActive: ComputedRef<boolean>;
	paginateSize: Ref<number>;
	paginatePage: Ref<number>;
	sortBy: Ref<'row' | 'col' | 'type'>;
	sortDir: Ref<'ascending' | 'descending' | null>;
	resetFilter: () => void;
}

export interface IUseTilesActions {
	remove: (id: ITile['id']) => Promise<void>;
}

export interface IUseDataSource<T extends keyof DataSourceParentTypeMap> {
	dataSource: ComputedRef<DataSourceParentTypeMap[T] | null>;
	isLoading: ComputedRef<boolean>;
	fetchDataSource: () => Promise<void>;
}

export interface IUseDataSources<T extends keyof DataSourceParentTypeMap> {
	dataSources: ComputedRef<DataSourceParentTypeMap[T][]>;
	areLoading: ComputedRef<boolean>;
	loaded: ComputedRef<boolean>;
	fetchDataSources: () => Promise<void>;
}

export interface IUseDataSourcesDataSource<T extends keyof DataSourceParentTypeMap> {
	dataSources: ComputedRef<DataSourceParentTypeMap[T][]>;
	dataSourcesPaginated: ComputedRef<DataSourceParentTypeMap[T][]>;
	totalRows: ComputedRef<number>;
	areLoading: ComputedRef<boolean>;
	loaded: ComputedRef<boolean>;
	fetchDataSources: () => Promise<void>;
	filters: Ref<IDataSourcesFilter>;
	filtersActive: ComputedRef<boolean>;
	paginateSize: Ref<number>;
	paginatePage: Ref<number>;
	sortBy: Ref<'type'>;
	sortDir: Ref<'ascending' | 'descending' | null>;
	resetFilter: () => void;
}

export interface IUseDataSourcesActions {
	remove: (id: IDataSource['id']) => Promise<void>;
}

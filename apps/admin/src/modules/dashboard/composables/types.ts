import type { ComputedRef, Reactive, Ref } from 'vue';

import type { FormInstance } from 'element-plus';

import type { IPlugin } from '../../../common';
import type { FormResultType } from '../dashboard.constants';
import type {
	IDataSourcePluginsComponents,
	IDataSourcePluginsSchemas,
	IPagePluginRoutes,
	IPagePluginsComponents,
	IPagePluginsSchemas,
	ITilePluginsComponents,
	ITilePluginsSchemas,
} from '../dashboard.types';
import type { IDataSourceAddForm, IDataSourceEditForm } from '../schemas/dataSources.types';
import type { IPageAddForm, IPageEditForm } from '../schemas/pages.types';
import type { ITileAddForm, ITileEditForm } from '../schemas/tiles.types';
import type { IDataSource } from '../store/data-sources.store.types';
import type { IPage } from '../store/pages.store.types';
import type { ITile } from '../store/tiles.store.types';

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

export interface IUsePageAddForm<TForm extends IPageAddForm = IPageAddForm> {
	model: Reactive<TForm>;
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submit: () => Promise<'added'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
}

export interface IUsePageEditForm<TForm extends IPageEditForm = IPageEditForm> {
	model: Reactive<TForm>;
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submit: () => Promise<'added' | 'saved'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
}

export interface IUsePagesPlugin {
	plugin: ComputedRef<IPlugin<IPagePluginsComponents, IPagePluginsSchemas, IPagePluginRoutes> | undefined>;
}

export interface IUsePagesPlugins {
	plugins: ComputedRef<IPlugin<IPagePluginsComponents, IPagePluginsSchemas, IPagePluginRoutes>[]>;
	options: ComputedRef<{ value: IPlugin['type']; label: IPlugin['name'] }[]>;
	getByType: (type: IPlugin['type']) => IPlugin<IPagePluginsComponents, IPagePluginsSchemas, IPagePluginRoutes> | undefined;
}

export interface IUseTile {
	tile: ComputedRef<ITile | null>;
	isLoading: ComputedRef<boolean>;
	fetchTile: () => Promise<void>;
}

export interface IUseTiles {
	tiles: ComputedRef<ITile[]>;
	areLoading: ComputedRef<boolean>;
	loaded: ComputedRef<boolean>;
	fetchTiles: () => Promise<void>;
}

export interface IUseTilesDataSource {
	tiles: ComputedRef<ITile[]>;
	tilesPaginated: ComputedRef<ITile[]>;
	totalRows: ComputedRef<number>;
	areLoading: ComputedRef<boolean>;
	loaded: ComputedRef<boolean>;
	fetchTiles: () => Promise<void>;
	filters: Ref<ITilesFilter>;
	filtersActive: ComputedRef<boolean>;
	paginateSize: Ref<number>;
	paginatePage: Ref<number>;
	sortBy: Ref<'row' | 'col' | 'rowSpan' | 'colSpan' | 'hidden' | 'type'>;
	sortDir: Ref<'ascending' | 'descending' | null>;
	resetFilter: () => void;
}

export interface IUseTilesActions {
	remove: (id: ITile['id']) => Promise<void>;
}

export interface IUseTileAddForm<TForm extends ITileAddForm = ITileAddForm> {
	model: Reactive<TForm>;
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submit: () => Promise<'added'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
}

export interface IUseTileEditForm<TForm extends ITileEditForm = ITileEditForm> {
	model: Reactive<TForm>;
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submit: () => Promise<'added' | 'saved'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
}

export interface IUseTilesPlugin {
	plugin: ComputedRef<IPlugin<ITilePluginsComponents, ITilePluginsSchemas> | undefined>;
}

export interface IUseTilesPlugins {
	plugins: ComputedRef<IPlugin<ITilePluginsComponents, ITilePluginsSchemas>[]>;
	options: ComputedRef<{ value: IPlugin['type']; label: IPlugin['name'] }[]>;
	getByType: (type: IPlugin['type']) => IPlugin<ITilePluginsComponents, ITilePluginsSchemas> | undefined;
}

export interface IUseDataSource {
	dataSource: ComputedRef<IDataSource | null>;
	isLoading: ComputedRef<boolean>;
	fetchDataSource: () => Promise<void>;
}

export interface IUseDataSources {
	dataSources: ComputedRef<IDataSource[]>;
	areLoading: ComputedRef<boolean>;
	loaded: ComputedRef<boolean>;
	fetchDataSources: () => Promise<void>;
}

export interface IUseDataSourcesDataSource {
	dataSources: ComputedRef<IDataSource[]>;
	dataSourcesPaginated: ComputedRef<IDataSource[]>;
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

export interface IUseDataSourceAddForm<TForm extends IDataSourceAddForm = IDataSourceAddForm> {
	model: Reactive<TForm>;
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submit: () => Promise<'added'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
}

export interface IUseDataSourceEditForm<TForm extends IDataSourceEditForm = IDataSourceEditForm> {
	model: Reactive<TForm>;
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submit: () => Promise<'added' | 'saved'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
}

export interface IUseDataSourcesPlugin {
	plugin: ComputedRef<IPlugin<IDataSourcePluginsComponents, IDataSourcePluginsSchemas> | undefined>;
}

export interface IUseDataSourcesPlugins {
	plugins: ComputedRef<IPlugin<IDataSourcePluginsComponents, IDataSourcePluginsSchemas>[]>;
	options: ComputedRef<{ value: IPlugin['type']; label: IPlugin['name'] }[]>;
	getByType: (type: IPlugin['type']) => IPlugin<IDataSourcePluginsComponents, IDataSourcePluginsSchemas> | undefined;
}

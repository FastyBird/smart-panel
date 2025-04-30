/*
eslint-disable @typescript-eslint/no-empty-object-type
*/
import type { ComponentOptionsMixin, DefineComponent } from 'vue';
import type { RouteLocationResolvedGeneric } from 'vue-router';

import { type IDataSourceAddFormProps, dataSourceAddFormEmits } from './components/data-sources/data-source-add-form.types';
import { type IDataSourceEditFormProps, dataSourceEditFormEmits } from './components/data-sources/data-source-edit-form.types';
import { type IPageAddFormProps, pageAddFormEmits } from './components/pages/page-add-form.types';
import { type IPageEditFormProps, pageEditFormEmits } from './components/pages/page-edit-form.types';
import { type ITileAddFormProps, tileAddFormEmits } from './components/tiles/tile-add-form.types';
import { type ITileEditFormProps, tileEditFormEmits } from './components/tiles/tile-edit-form.types';
import { type DataSourceAddFormSchema, DataSourceEditFormSchema } from './schemas/dataSources.schemas';
import { PageAddFormSchema, PageEditFormSchema } from './schemas/pages.schemas';
import { type TileAddFormSchema, TileEditFormSchema } from './schemas/tiles.schemas';
import { DataSourceCreateReqSchema, type DataSourceSchema, DataSourceUpdateReqSchema } from './store/data-sources.store.schemas';
import { PageCreateReqSchema, PageSchema, PageUpdateReqSchema } from './store/pages.store.schemas';
import type { IPage } from './store/pages.store.types';
import { TileCreateReqSchema, type TileSchema, TileUpdateReqSchema } from './store/tiles.store.schemas';

export interface IPageDetailProps {
	page: IPage;
}

export type IPagePluginsComponents = {
	pageDetail?: DefineComponent<IPageDetailProps, {}, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, {}>;
	pageAddForm?: DefineComponent<IPageAddFormProps, {}, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, typeof pageAddFormEmits>;
	pageEditForm?: DefineComponent<IPageEditFormProps, {}, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, typeof pageEditFormEmits>;
};

export type IPagePluginsSchemas = {
	pageSchema?: typeof PageSchema;
	pageAddFormSchema?: typeof PageAddFormSchema;
	pageEditFormSchema?: typeof PageEditFormSchema;
	pageCreateReqSchema?: typeof PageCreateReqSchema;
	pageUpdateReqSchema?: typeof PageUpdateReqSchema;
};

export type IPagePluginRoutes = {
	configure?: ((id: IPage['id']) => string | RouteLocationResolvedGeneric) | string | RouteLocationResolvedGeneric;
};

export type ITilePluginsComponents = {
	tileAddForm?: DefineComponent<ITileAddFormProps, {}, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, typeof tileAddFormEmits>;
	tileEditForm?: DefineComponent<ITileEditFormProps, {}, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, typeof tileEditFormEmits>;
};

export type ITilePluginsSchemas = {
	tileSchema?: typeof TileSchema;
	tileAddFormSchema?: typeof TileAddFormSchema;
	tileEditFormSchema?: typeof TileEditFormSchema;
	tileCreateReqSchema?: typeof TileCreateReqSchema;
	tileUpdateReqSchema?: typeof TileUpdateReqSchema;
};

export type IDataSourcePluginsComponents = {
	dataSourceAddForm?: DefineComponent<
		IDataSourceAddFormProps,
		{},
		{},
		{},
		{},
		ComponentOptionsMixin,
		ComponentOptionsMixin,
		typeof dataSourceAddFormEmits
	>;
	dataSourceEditForm?: DefineComponent<
		IDataSourceEditFormProps,
		{},
		{},
		{},
		{},
		ComponentOptionsMixin,
		ComponentOptionsMixin,
		typeof dataSourceEditFormEmits
	>;
};

export type IDataSourcePluginsSchemas = {
	dataSourceSchema?: typeof DataSourceSchema;
	dataSourceAddFormSchema?: typeof DataSourceAddFormSchema;
	dataSourceEditFormSchema?: typeof DataSourceEditFormSchema;
	dataSourceCreateReqSchema?: typeof DataSourceCreateReqSchema;
	dataSourceUpdateReqSchema?: typeof DataSourceUpdateReqSchema;
};

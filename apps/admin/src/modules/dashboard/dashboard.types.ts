/*
eslint-disable @typescript-eslint/no-empty-object-type
*/
import type { ComponentOptionsMixin, DefineComponent } from 'vue';

import { type IDataSourceAddFormProps, dataSourceAddFormEmits } from './components/data-sources/data-source-add-form.types';
import { type IDataSourceEditFormProps, dataSourceEditFormEmits } from './components/data-sources/data-source-edit-form.types';
import { type IPageAddFormProps, pageAddFormEmits } from './components/pages/page-add-form.types';
import { type IPageEditFormProps, pageEditFormEmits } from './components/pages/page-edit-form.types';
import { type ITileAddFormProps, tileAddFormEmits } from './components/tiles/tile-add-form.types';
import { type ITileEditFormProps, tileEditFormEmits } from './components/tiles/tile-edit-form.types';
import { type DataSourceCreateSchema, DataSourceUpdateSchema } from './schemas/dataSources.schemas';
import { PageCreateSchema, PageUpdateSchema } from './schemas/pages.schemas';
import { type TileCreateSchema, TileUpdateSchema } from './schemas/tiles.schemas';
import { DataSourceCreateReqSchema, type DataSourceSchema, DataSourceUpdateReqSchema } from './store/dataSources.store.schemas';
import { PageCreateReqSchema, PageSchema, PageUpdateReqSchema } from './store/pages.store.schemas';
import { TileCreateReqSchema, type TileSchema, TileUpdateReqSchema } from './store/tiles.store.schemas';

export type IPagePluginsComponents = {
	pageAddForm?: DefineComponent<IPageAddFormProps, {}, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, typeof pageAddFormEmits>;
	pageEditForm?: DefineComponent<IPageEditFormProps, {}, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, typeof pageEditFormEmits>;
};

export type IPagePluginsSchemas = {
	pageSchema?: typeof PageSchema;
	pageCreateSchema?: typeof PageCreateSchema;
	pageEditSchema?: typeof PageUpdateSchema;
	pageCreateReqSchema?: typeof PageCreateReqSchema;
	pageUpdateReqSchema?: typeof PageUpdateReqSchema;
};

export type ITilePluginsComponents = {
	tileAddForm?: DefineComponent<ITileAddFormProps, {}, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, typeof tileAddFormEmits>;
	tileEditForm?: DefineComponent<ITileEditFormProps, {}, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, typeof tileEditFormEmits>;
};

export type ITilePluginsSchemas = {
	tileSchema?: typeof TileSchema;
	tileCreateSchema?: typeof TileCreateSchema;
	tileEditSchema?: typeof TileUpdateSchema;
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
	dataSourceCreateSchema?: typeof DataSourceCreateSchema;
	dataSourceEditSchema?: typeof DataSourceUpdateSchema;
	dataSourceCreateReqSchema?: typeof DataSourceCreateReqSchema;
	dataSourceUpdateReqSchema?: typeof DataSourceUpdateReqSchema;
};

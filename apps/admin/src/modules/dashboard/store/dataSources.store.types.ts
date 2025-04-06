import type { Ref } from 'vue';

import type { Store } from 'pinia';

import { z } from 'zod';

import type { ICard } from './cards.store.types';
import {
	CardDataSourcesAddActionPayloadSchema,
	CardDataSourcesEditActionPayloadSchema,
	CardDataSourcesFetchActionPayloadSchema,
	CardDataSourcesGetActionPayloadSchema,
	CardDataSourcesRemoveActionPayloadSchema,
	CardDataSourcesSaveActionPayloadSchema,
	CardDataSourcesSetActionPayloadSchema,
	CardDataSourcesUnsetActionPayloadSchema,
	CardDeviceChannelDataSourceResSchema,
	CardDeviceChannelDataSourceSchema,
	DataSourceBaseSchema,
	DataSourceCreateBaseReqSchema,
	DataSourceResSchema,
	DataSourceUpdateBaseReqSchema,
	DataSourcesStateSemaphoreSchema,
	DeviceChannelDataSourceCreateReqSchema,
	DeviceChannelDataSourceResSchema,
	DeviceChannelDataSourceSchema,
	DeviceChannelDataSourceUpdateReqSchema,
	PageDataSourcesAddActionPayloadSchema,
	PageDataSourcesEditActionPayloadSchema,
	PageDataSourcesFetchActionPayloadSchema,
	PageDataSourcesGetActionPayloadSchema,
	PageDataSourcesRemoveActionPayloadSchema,
	PageDataSourcesSaveActionPayloadSchema,
	PageDataSourcesSetActionPayloadSchema,
	PageDataSourcesUnsetActionPayloadSchema,
	PageDeviceChannelDataSourceResSchema,
	PageDeviceChannelDataSourceSchema,
	TileDataSourcesAddActionPayloadSchema,
	TileDataSourcesEditActionPayloadSchema,
	TileDataSourcesFetchActionPayloadSchema,
	TileDataSourcesGetActionPayloadSchema,
	TileDataSourcesRemoveActionPayloadSchema,
	TileDataSourcesSaveActionPayloadSchema,
	TileDataSourcesSetActionPayloadSchema,
	TileDataSourcesUnsetActionPayloadSchema,
	TileDeviceChannelDataSourceResSchema,
	TileDeviceChannelDataSourceSchema,
} from './dataSources.store.schemas';
import type { IPage } from './pages.store.types';
import type { ITile } from './tiles.store.types';

// STORE STATE
// ===========

export type IDataSourceBase = z.infer<typeof DataSourceBaseSchema>;

export type IDeviceChannelDataSource = z.infer<typeof DeviceChannelDataSourceSchema>;

export type IDataSource = IDeviceChannelDataSource;

export type IPageDeviceChannelDataSource = z.infer<typeof PageDeviceChannelDataSourceSchema>;

export type ICardDeviceChannelDataSource = z.infer<typeof CardDeviceChannelDataSourceSchema>;

export type ITileDeviceChannelDataSource = z.infer<typeof TileDeviceChannelDataSourceSchema>;

export type IDataSourcesStateSemaphore = z.infer<typeof DataSourcesStateSemaphoreSchema>;

// STORE ACTIONS
// =============

export type IPageDataSourcesSetActionPayload = z.infer<typeof PageDataSourcesSetActionPayloadSchema>;

export type ICardDataSourcesSetActionPayload = z.infer<typeof CardDataSourcesSetActionPayloadSchema>;

export type ITileDataSourcesSetActionPayload = z.infer<typeof TileDataSourcesSetActionPayloadSchema>;

export type IDataSourcesSetActionPayload = IPageDataSourcesSetActionPayload | ICardDataSourcesSetActionPayload | ITileDataSourcesSetActionPayload;

export type IPageDataSourcesUnsetActionPayload = z.infer<typeof PageDataSourcesUnsetActionPayloadSchema>;

export type ICardDataSourcesUnsetActionPayload = z.infer<typeof CardDataSourcesUnsetActionPayloadSchema>;

export type ITileDataSourcesUnsetActionPayload = z.infer<typeof TileDataSourcesUnsetActionPayloadSchema>;

export type IDataSourcesUnsetActionPayload =
	| IPageDataSourcesUnsetActionPayload
	| ICardDataSourcesUnsetActionPayload
	| ITileDataSourcesUnsetActionPayload;

export type IPageDataSourcesGetActionPayload = z.infer<typeof PageDataSourcesGetActionPayloadSchema>;

export type ICardDataSourcesGetActionPayload = z.infer<typeof CardDataSourcesGetActionPayloadSchema>;

export type ITileDataSourcesGetActionPayload = z.infer<typeof TileDataSourcesGetActionPayloadSchema>;

export type IDataSourcesGetActionPayload = IPageDataSourcesGetActionPayload | ICardDataSourcesGetActionPayload | ITileDataSourcesGetActionPayload;

export type IPageDataSourcesFetchActionPayload = z.infer<typeof PageDataSourcesFetchActionPayloadSchema>;

export type ICardDataSourcesFetchActionPayload = z.infer<typeof CardDataSourcesFetchActionPayloadSchema>;

export type ITileDataSourcesFetchActionPayload = z.infer<typeof TileDataSourcesFetchActionPayloadSchema>;

export type IDataSourcesFetchActionPayload =
	| IPageDataSourcesFetchActionPayload
	| ICardDataSourcesFetchActionPayload
	| ITileDataSourcesFetchActionPayload;

export type IPageDataSourcesAddActionPayload = z.infer<typeof PageDataSourcesAddActionPayloadSchema>;

export type ICardDataSourcesAddActionPayload = z.infer<typeof CardDataSourcesAddActionPayloadSchema>;

export type ITileDataSourcesAddActionPayload = z.infer<typeof TileDataSourcesAddActionPayloadSchema>;

export type IDataSourcesAddActionPayload = IPageDataSourcesAddActionPayload | ICardDataSourcesAddActionPayload | ITileDataSourcesAddActionPayload;

export type IPageDataSourcesEditActionPayload = z.infer<typeof PageDataSourcesEditActionPayloadSchema>;

export type ICardDataSourcesEditActionPayload = z.infer<typeof CardDataSourcesEditActionPayloadSchema>;

export type ITileDataSourcesEditActionPayload = z.infer<typeof TileDataSourcesEditActionPayloadSchema>;

export type IDataSourcesEditActionPayload = IPageDataSourcesEditActionPayload | ICardDataSourcesEditActionPayload | ITileDataSourcesEditActionPayload;

export type IPageDataSourcesSaveActionPayload = z.infer<typeof PageDataSourcesSaveActionPayloadSchema>;

export type ICardDataSourcesSaveActionPayload = z.infer<typeof CardDataSourcesSaveActionPayloadSchema>;

export type ITileDataSourcesSaveActionPayload = z.infer<typeof TileDataSourcesSaveActionPayloadSchema>;

export type IDataSourcesSaveActionPayload = IPageDataSourcesSaveActionPayload | ICardDataSourcesSaveActionPayload | ITileDataSourcesSaveActionPayload;

export type IPageDataSourcesRemoveActionPayload = z.infer<typeof PageDataSourcesRemoveActionPayloadSchema>;

export type ICardDataSourcesRemoveActionPayload = z.infer<typeof CardDataSourcesRemoveActionPayloadSchema>;

export type ITileDataSourcesRemoveActionPayload = z.infer<typeof TileDataSourcesRemoveActionPayloadSchema>;

export type IDataSourcesRemoveActionPayload =
	| IPageDataSourcesRemoveActionPayload
	| ICardDataSourcesRemoveActionPayload
	| ITileDataSourcesRemoveActionPayload;

// STORE
// =====

export interface IDataSourcesStoreState {
	data: Ref<{ [key: IDataSourceBase['id']]: IDataSourceBase }>;
	semaphore: Ref<IDataSourcesStateSemaphore>;
	firstLoad: Ref<(IPage['id'] | ICard['id'] | ITile['id'])[]>;
}

export interface IDataSourcesStoreActions {
	// Getters
	firstLoadFinished: (parentId: IPage['id'] | ICard['id'] | ITile['id']) => boolean;
	getting: (id: IDataSourceBase['id']) => boolean;
	fetching: (parentId: IPage['id'] | ICard['id'] | ITile['id']) => boolean;
	findById: (parent: DataSourceParentType, id: IDataSourceBase['id']) => IDataSourceBase | null;
	findForParent: (parent: DataSourceParentType, parentId: IPage['id'] | ICard['id'] | ITile['id']) => IDataSourceBase[];
	findAll: (parent: DataSourceParentType) => IDataSourceBase[];
	// Actions
	set: (payload: IDataSourcesSetActionPayload) => IDataSourceBase;
	unset: (payload: IDataSourcesUnsetActionPayload) => void;
	get: (payload: IDataSourcesGetActionPayload) => Promise<IDataSourceBase>;
	fetch: (payload: IDataSourcesFetchActionPayload) => Promise<IDataSourceBase[]>;
	add: (payload: IDataSourcesAddActionPayload) => Promise<IDataSourceBase>;
	edit: (payload: IDataSourcesEditActionPayload) => Promise<IDataSourceBase>;
	save: (payload: IDataSourcesSaveActionPayload) => Promise<IDataSourceBase>;
	remove: (payload: IDataSourcesRemoveActionPayload) => Promise<boolean>;
}

export type DataSourcesStoreSetup = IDataSourcesStoreState & IDataSourcesStoreActions;

// BACKEND API
// ===========

export type IDataSourceCreateBaseReq = z.infer<typeof DataSourceCreateBaseReqSchema>;

export type IDeviceChannelDataSourceCreateReq = z.infer<typeof DeviceChannelDataSourceCreateReqSchema>;

export type IDataSourceCreateReq = IDeviceChannelDataSourceCreateReq;

export type IDataSourceUpdateBaseReq = z.infer<typeof DataSourceUpdateBaseReqSchema>;

export type IDeviceChannelDataSourceUpdateReq = z.infer<typeof DeviceChannelDataSourceUpdateReqSchema>;

export type IDataSourceUpdateReq = IDeviceChannelDataSourceUpdateReq;

export type IDataSourceRes = z.infer<typeof DataSourceResSchema>;

export type IDeviceChannelDataSourceRes = z.infer<typeof DeviceChannelDataSourceResSchema>;

export type IPageDeviceChannelDataSourceRes = z.infer<typeof PageDeviceChannelDataSourceResSchema>;

export type ICardDeviceChannelDataSourceRes = z.infer<typeof CardDeviceChannelDataSourceResSchema>;

export type ITileDeviceChannelDataSourceRes = z.infer<typeof TileDeviceChannelDataSourceResSchema>;

// STORE
export type DataSourcesStore = Store<string, IDataSourcesStoreState, object, IDataSourcesStoreActions>;

// MISC
export type DataSourceParentType = 'page' | 'card' | 'tile';

export type DataSourceParentTypeMap = {
	page: IPageDeviceChannelDataSource;
	card: ICardDeviceChannelDataSource;
	tile: ITileDeviceChannelDataSource;
};

export type IDataSourcesEntitiesSchemas = {
	dataSource: typeof DataSourceBaseSchema;
	createDataSourceReq: typeof DataSourceCreateBaseReqSchema;
	updateDataSourceReq: typeof DataSourceUpdateBaseReqSchema;
};

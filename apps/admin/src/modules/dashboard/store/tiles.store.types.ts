import type { Ref } from 'vue';

import type { Store } from 'pinia';

import { z } from 'zod';

import type { ICard } from './cards.store.types';
import type { IPageBase } from './pages.store.types';
import {
	CardDayWeatherTileResSchema,
	CardDayWeatherTileSchema,
	CardDevicePreviewTileResSchema,
	CardDevicePreviewTileSchema,
	CardForecastWeatherTileResSchema,
	CardForecastWeatherTileSchema,
	CardTilesAddActionPayloadSchema,
	CardTilesEditActionPayloadSchema,
	CardTilesFetchActionPayloadSchema,
	CardTilesGetActionPayloadSchema,
	CardTilesRemoveActionPayloadSchema,
	CardTilesSaveActionPayloadSchema,
	CardTilesSetActionPayloadSchema,
	CardTilesUnsetActionPayloadSchema,
	CardTimeTileResSchema,
	CardTimeTileSchema,
	DayWeatherTileCreateReqSchema,
	DayWeatherTileResSchema,
	DayWeatherTileSchema,
	DayWeatherTileUpdateReqSchema,
	DevicePreviewTileCreateReqSchema,
	DevicePreviewTileResSchema,
	DevicePreviewTileSchema,
	DevicePreviewTileUpdateReqSchema,
	ForecastWeatherTileCreateReqSchema,
	ForecastWeatherTileResSchema,
	ForecastWeatherTileSchema,
	ForecastWeatherTileUpdateReqSchema,
	PageDayWeatherTileResSchema,
	PageDayWeatherTileSchema,
	PageDevicePreviewTileResSchema,
	PageDevicePreviewTileSchema,
	PageForecastWeatherTileResSchema,
	PageForecastWeatherTileSchema,
	PageTilesAddActionPayloadSchema,
	PageTilesEditActionPayloadSchema,
	PageTilesFetchActionPayloadSchema,
	PageTilesGetActionPayloadSchema,
	PageTilesRemoveActionPayloadSchema,
	PageTilesSaveActionPayloadSchema,
	PageTilesSetActionPayloadSchema,
	PageTilesUnsetActionPayloadSchema,
	PageTimeTileResSchema,
	PageTimeTileSchema,
	TileBaseSchema,
	TileCreateBaseReqSchema,
	TileResSchema,
	TileUpdateBaseReqSchema,
	TilesStateSemaphoreSchema,
	TimeTileCreateReqSchema,
	TimeTileResSchema,
	TimeTileSchema,
	TimeTileUpdateReqSchema,
} from './tiles.store.schemas';

// STORE STATE
// ===========

export type ITileBase = z.infer<typeof TileBaseSchema>;

export type IDevicePreviewTile = z.infer<typeof DevicePreviewTileSchema>;

export type IPageDevicePreviewTile = z.infer<typeof PageDevicePreviewTileSchema>;

export type ICardDevicePreviewTile = z.infer<typeof CardDevicePreviewTileSchema>;

export type ITimeTile = z.infer<typeof TimeTileSchema>;

export type IPageTimeTile = z.infer<typeof PageTimeTileSchema>;

export type ICardTimeTile = z.infer<typeof CardTimeTileSchema>;

export type IDayWeatherTile = z.infer<typeof DayWeatherTileSchema>;

export type IPageDayWeatherTile = z.infer<typeof PageDayWeatherTileSchema>;

export type ICardDayWeatherTile = z.infer<typeof CardDayWeatherTileSchema>;

export type IForecastWeatherTile = z.infer<typeof ForecastWeatherTileSchema>;

export type IPageForecastWeatherTile = z.infer<typeof PageForecastWeatherTileSchema>;

export type ICardForecastWeatherTile = z.infer<typeof CardForecastWeatherTileSchema>;

export type ITilesStateSemaphore = z.infer<typeof TilesStateSemaphoreSchema>;

export type IPageTile = IPageDevicePreviewTile | IPageTimeTile | IPageDayWeatherTile | IPageForecastWeatherTile;

export type ICardTile = ICardDevicePreviewTile | ICardTimeTile | ICardDayWeatherTile | ICardForecastWeatherTile;

export type ITile = IPageTile | ICardTile;

// STORE ACTIONS
// =============

export type IPageTilesSetActionPayload = z.infer<typeof PageTilesSetActionPayloadSchema>;

export type ICardTilesSetActionPayload = z.infer<typeof CardTilesSetActionPayloadSchema>;

export type ITilesSetActionPayload = IPageTilesSetActionPayload | ICardTilesSetActionPayload;

export type IPageTilesUnsetActionPayload = z.infer<typeof PageTilesUnsetActionPayloadSchema>;

export type ICardTilesUnsetActionPayload = z.infer<typeof CardTilesUnsetActionPayloadSchema>;

export type ITilesUnsetActionPayload = IPageTilesUnsetActionPayload | ICardTilesUnsetActionPayload;

export type IPageTilesGetActionPayload = z.infer<typeof PageTilesGetActionPayloadSchema>;

export type ICardTilesGetActionPayload = z.infer<typeof CardTilesGetActionPayloadSchema>;

export type ITilesGetActionPayload = IPageTilesGetActionPayload | ICardTilesGetActionPayload;

export type IPageTilesFetchActionPayload = z.infer<typeof PageTilesFetchActionPayloadSchema>;

export type ICardTilesFetchActionPayload = z.infer<typeof CardTilesFetchActionPayloadSchema>;

export type ITilesFetchActionPayload = IPageTilesFetchActionPayload | ICardTilesFetchActionPayload;

export type IPageTilesAddActionPayload = z.infer<typeof PageTilesAddActionPayloadSchema>;

export type ICardTilesAddActionPayload = z.infer<typeof CardTilesAddActionPayloadSchema>;

export type ITilesAddActionPayload = IPageTilesAddActionPayload | ICardTilesAddActionPayload;

export type IPageTilesEditActionPayload = z.infer<typeof PageTilesEditActionPayloadSchema>;

export type ICardTilesEditActionPayload = z.infer<typeof CardTilesEditActionPayloadSchema>;

export type ITilesEditActionPayload = IPageTilesEditActionPayload | ICardTilesEditActionPayload;

export type IPageTilesSaveActionPayload = z.infer<typeof PageTilesSaveActionPayloadSchema>;

export type ICardTilesSaveActionPayload = z.infer<typeof CardTilesSaveActionPayloadSchema>;

export type ITilesSaveActionPayload = IPageTilesSaveActionPayload | ICardTilesSaveActionPayload;

export type IPageTilesRemoveActionPayload = z.infer<typeof PageTilesRemoveActionPayloadSchema>;

export type ICardTilesRemoveActionPayload = z.infer<typeof CardTilesRemoveActionPayloadSchema>;

export type ITilesRemoveActionPayload = IPageTilesRemoveActionPayload | ICardTilesRemoveActionPayload;

// STORE
// =====

export interface ITilesStoreState {
	data: Ref<{ [key: ITileBase['id']]: ITileBase }>;
	semaphore: Ref<ITilesStateSemaphore>;
	firstLoad: Ref<(IPageBase['id'] | ICard['id'])[]>;
}

export interface ITilesStoreActions {
	// Getters
	firstLoadFinished: (parentId: IPageBase['id'] | ICard['id']) => boolean;
	getting: (id: ITileBase['id']) => boolean;
	fetching: (parentId: IPageBase['id'] | ICard['id']) => boolean;
	findById: (parent: TileParentType, id: ITileBase['id']) => ITileBase | null;
	findForParent: (parent: TileParentType, parentId: IPageBase['id'] | ICard['id']) => ITileBase[];
	findAll: (parent: TileParentType) => ITileBase[];
	// Actions
	set: (payload: ITilesSetActionPayload) => ITileBase;
	unset: (payload: ITilesUnsetActionPayload) => void;
	get: (payload: ITilesGetActionPayload) => Promise<ITileBase>;
	fetch: (payload: ITilesFetchActionPayload) => Promise<ITileBase[]>;
	add: (payload: ITilesAddActionPayload) => Promise<ITileBase>;
	edit: (payload: ITilesEditActionPayload) => Promise<ITileBase>;
	save: (payload: ITilesSaveActionPayload) => Promise<ITileBase>;
	remove: (payload: ITilesRemoveActionPayload) => Promise<boolean>;
}

export type TilesStoreSetup = ITilesStoreState & ITilesStoreActions;

// BACKEND API
// ===========

export type ITileCreateBaseReq = z.infer<typeof TileCreateBaseReqSchema>;

export type IDevicePreviewTileCreateReq = z.infer<typeof DevicePreviewTileCreateReqSchema>;

export type ITimeTileCreateReq = z.infer<typeof TimeTileCreateReqSchema>;

export type IDayWeatherTileCreateReq = z.infer<typeof DayWeatherTileCreateReqSchema>;

export type IForecastWeatherTileCreateReq = z.infer<typeof ForecastWeatherTileCreateReqSchema>;

export type ITileCreateReq = IDevicePreviewTileCreateReq | ITimeTileCreateReq | IDayWeatherTileCreateReq | IForecastWeatherTileCreateReq;

export type ITileUpdateBaseReq = z.infer<typeof TileUpdateBaseReqSchema>;

export type IDevicePreviewTileUpdateReq = z.infer<typeof DevicePreviewTileUpdateReqSchema>;

export type ITimeTileUpdateReq = z.infer<typeof TimeTileUpdateReqSchema>;

export type IDayWeatherTileUpdateReq = z.infer<typeof DayWeatherTileUpdateReqSchema>;

export type IForecastWeatherTileUpdateReq = z.infer<typeof ForecastWeatherTileUpdateReqSchema>;

export type ITileUpdateReq = IDevicePreviewTileUpdateReq | ITimeTileUpdateReq | IDayWeatherTileUpdateReq | IForecastWeatherTileUpdateReq;

export type ITileRes = z.infer<typeof TileResSchema>;

export type IDevicePreviewTileRes = z.infer<typeof DevicePreviewTileResSchema>;

export type IPageDevicePreviewTileRes = z.infer<typeof PageDevicePreviewTileResSchema>;

export type ICardDevicePreviewTileRes = z.infer<typeof CardDevicePreviewTileResSchema>;

export type ITimeTileRes = z.infer<typeof TimeTileResSchema>;

export type IPageTimeTileRes = z.infer<typeof PageTimeTileResSchema>;

export type ICardTimeTileRes = z.infer<typeof CardTimeTileResSchema>;

export type IDayWeatherTileRes = z.infer<typeof DayWeatherTileResSchema>;

export type IPageDayWeatherTileRes = z.infer<typeof PageDayWeatherTileResSchema>;

export type ICardDayWeatherTileRes = z.infer<typeof CardDayWeatherTileResSchema>;

export type IForecastWeatherTileRes = z.infer<typeof ForecastWeatherTileResSchema>;

export type IPageForecastWeatherTileRes = z.infer<typeof PageForecastWeatherTileResSchema>;

export type ICardForecastWeatherTileRes = z.infer<typeof CardForecastWeatherTileResSchema>;

export type IPageTileRes = IPageDevicePreviewTileRes | IPageTimeTileRes | IPageDayWeatherTileRes | IPageForecastWeatherTileRes;

export type ICardTileRes = ICardDevicePreviewTileRes | ICardTimeTileRes | ICardDayWeatherTileRes | ICardForecastWeatherTileRes;

// STORE
export type TilesStore = Store<string, ITilesStoreState, object, ITilesStoreActions>;

// MISC
export type TileParentType = 'page' | 'card';

export type TileParentTypeMap = {
	page: IPageDevicePreviewTile | IPageTimeTile | IPageDayWeatherTile | IPageForecastWeatherTile;
	card: ICardDevicePreviewTile | ICardTimeTile | ICardDayWeatherTile | ICardForecastWeatherTile;
};

export type ITilesEntitiesSchemas = {
	tile: typeof TileBaseSchema;
	createTileReq: typeof TileCreateBaseReqSchema;
	updateTileReq: typeof TileUpdateBaseReqSchema;
};

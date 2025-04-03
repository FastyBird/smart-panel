import type { Ref } from 'vue';

import type { Store } from 'pinia';

import { v4 as uuid } from 'uuid';
import { type ZodType, z } from 'zod';

import {
	DashboardDayWeatherTileType,
	DashboardDevicePreviewTileType,
	DashboardForecastWeatherTileType,
	DashboardTimeTileType,
	type components,
} from '../../../openapi';

import type { ICard } from './cards.store.types';
import { DeviceChannelDataSourceCreateReqSchema, TileDeviceChannelDataSourceResSchema } from './dataSources.store.types';
import type { IPageBase } from './pages.store.types';
import { ItemIdSchema } from './types';

type ApiCreateTileBase = components['schemas']['DashboardCreateTileBase'];
type ApiCreateDevicePreviewTile = components['schemas']['DashboardCreateDevicePreviewTile'];
type ApiCreateTimeTile = components['schemas']['DashboardCreateTimeTile'];
type ApiCreateDayWeatherTile = components['schemas']['DashboardCreateDayWeatherTile'];
type ApiCreateForecastWeatherTile = components['schemas']['DashboardCreateForecastWeatherTile'];

type ApiUpdateTileBase = components['schemas']['DashboardUpdateTileBase'];
type ApiUpdateDevicePreviewTile = components['schemas']['DashboardUpdateDevicePreviewTile'];
type ApiUpdateTimeTile = components['schemas']['DashboardUpdateTimeTile'];
type ApiUpdateDayWeatherTile = components['schemas']['DashboardUpdateDayWeatherTile'];
type ApiUpdateForecastWeatherTile = components['schemas']['DashboardUpdateForecastWeatherTile'];

type ApiTileBase = components['schemas']['DashboardTileBase'];
type ApiDevicePreviewTile = components['schemas']['DashboardDevicePreviewTile'];
type ApiTimeTile = components['schemas']['DashboardTimeTile'];
type ApiDayWeatherTile = components['schemas']['DashboardDayWeatherTile'];
type ApiForecastWeatherTile = components['schemas']['DashboardForecastWeatherTile'];

type ApiCardDevicePreviewTile = components['schemas']['DashboardCardDevicePreviewTile'];
type ApiCardTimeTile = components['schemas']['DashboardCardTimeTile'];
type ApiCardDayWeatherTile = components['schemas']['DashboardCardDayWeatherTile'];
type ApiCardForecastWeatherTile = components['schemas']['DashboardCardForecastWeatherTile'];

type ApiPageDevicePreviewTile = components['schemas']['DashboardPageDevicePreviewTile'];
type ApiPageTimeTile = components['schemas']['DashboardPageTimeTile'];
type ApiPageDayWeatherTile = components['schemas']['DashboardPageDayWeatherTile'];
type ApiPageForecastWeatherTile = components['schemas']['DashboardPageForecastWeatherTile'];

// STORE STATE
// ===========

export const TileBaseSchema = z.object({
	id: ItemIdSchema,
	parent: z.enum(['page', 'card']),
	type: z.string().trim().nonempty(),
	draft: z.boolean().default(false),
	row: z.number(),
	col: z.number(),
	rowSpan: z.number().default(0),
	colSpan: z.number().default(0),
	createdAt: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
	updatedAt: z
		.union([z.string().datetime({ offset: true }), z.date()])
		.transform((date) => (date instanceof Date ? date : new Date(date)))
		.optional()
		.nullable()
		.default(null),
});
export type ITileBase = z.infer<typeof TileBaseSchema>;

export const DevicePreviewTileSchema = TileBaseSchema.extend({
	device: ItemIdSchema,
	icon: z.string().trim().nullable().default(null),
});
export type IDevicePreviewTile = z.infer<typeof DevicePreviewTileSchema>;

export const PageDevicePreviewTileSchema = DevicePreviewTileSchema.extend({
	page: ItemIdSchema,
});
export type IPageDevicePreviewTile = z.infer<typeof PageDevicePreviewTileSchema>;

export const CardDevicePreviewTileSchema = DevicePreviewTileSchema.extend({
	card: ItemIdSchema,
});
export type ICardDevicePreviewTile = z.infer<typeof CardDevicePreviewTileSchema>;

export const TimeTileSchema = TileBaseSchema.extend({});
export type ITimeTile = z.infer<typeof TimeTileSchema>;

export const PageTimeTileSchema = TimeTileSchema.extend({
	page: ItemIdSchema,
});
export type IPageTimeTile = z.infer<typeof PageTimeTileSchema>;

export const CardTimeTileSchema = TimeTileSchema.extend({
	card: ItemIdSchema,
});
export type ICardTimeTile = z.infer<typeof CardTimeTileSchema>;

export const DayWeatherTileSchema = TileBaseSchema.extend({});
export type IDayWeatherTile = z.infer<typeof DayWeatherTileSchema>;

export const PageDayWeatherTileSchema = DayWeatherTileSchema.extend({
	page: ItemIdSchema,
});
export type IPageDayWeatherTile = z.infer<typeof PageDayWeatherTileSchema>;

export const CardDayWeatherTileSchema = DayWeatherTileSchema.extend({
	card: ItemIdSchema,
});
export type ICardDayWeatherTile = z.infer<typeof CardDayWeatherTileSchema>;

export const ForecastWeatherTileSchema = TileBaseSchema.extend({});
export type IForecastWeatherTile = z.infer<typeof ForecastWeatherTileSchema>;

export const PageForecastWeatherTileSchema = ForecastWeatherTileSchema.extend({
	page: ItemIdSchema,
});
export type IPageForecastWeatherTile = z.infer<typeof PageForecastWeatherTileSchema>;

export const CardForecastWeatherTileSchema = ForecastWeatherTileSchema.extend({
	card: ItemIdSchema,
});
export type ICardForecastWeatherTile = z.infer<typeof CardForecastWeatherTileSchema>;

export const TilesStateSemaphoreSchema = z.object({
	fetching: z.object({
		items: z.array(ItemIdSchema).default([]),
		item: z.array(ItemIdSchema),
	}),
	creating: z.array(ItemIdSchema),
	updating: z.array(ItemIdSchema),
	deleting: z.array(ItemIdSchema),
});
export type ITilesStateSemaphore = z.infer<typeof TilesStateSemaphoreSchema>;

export type IPageTile = IPageDevicePreviewTile | IPageTimeTile | IPageDayWeatherTile | IPageForecastWeatherTile;

export type ICardTile = ICardDevicePreviewTile | ICardTimeTile | ICardDayWeatherTile | ICardForecastWeatherTile;

export type ITile = IPageTile | ICardTile;

// STORE ACTIONS
// =============

export const PageTilesSetActionPayloadSchema = z.object({
	id: ItemIdSchema,
	parent: z.literal('page'),
	pageId: ItemIdSchema,
	data: z
		.object({
			type: z.string().trim().nonempty(),
			row: z.number(),
			col: z.number(),
			rowSpan: z.number().default(0),
			colSpan: z.number().default(0),
		})
		.passthrough(),
});
export type IPageTilesSetActionPayload = z.infer<typeof PageTilesSetActionPayloadSchema>;

export const CardTilesSetActionPayloadSchema = z.object({
	id: ItemIdSchema,
	parent: z.literal('card'),
	pageId: ItemIdSchema,
	cardId: ItemIdSchema,
	data: z
		.object({
			type: z.string().trim().nonempty(),
			row: z.number(),
			col: z.number(),
			rowSpan: z.number().default(0),
			colSpan: z.number().default(0),
		})
		.passthrough(),
});
export type ICardTilesSetActionPayload = z.infer<typeof CardTilesSetActionPayloadSchema>;

export type ITilesSetActionPayload = IPageTilesSetActionPayload | ICardTilesSetActionPayload;

export const PageTilesUnsetActionPayloadSchema = z.object({
	id: ItemIdSchema.optional(),
	parent: z.literal('page'),
	pageId: ItemIdSchema,
});
export type IPageTilesUnsetActionPayload = z.infer<typeof PageTilesUnsetActionPayloadSchema>;

export const CardTilesUnsetActionPayloadSchema = z.object({
	id: ItemIdSchema.optional(),
	parent: z.literal('card'),
	pageId: ItemIdSchema,
	cardId: ItemIdSchema,
});
export type ICardTilesUnsetActionPayload = z.infer<typeof CardTilesUnsetActionPayloadSchema>;

export type ITilesUnsetActionPayload = IPageTilesUnsetActionPayload | ICardTilesUnsetActionPayload;

export const PageTilesGetActionPayloadSchema = z.object({
	id: ItemIdSchema,
	parent: z.literal('page'),
	pageId: ItemIdSchema,
});
export type IPageTilesGetActionPayload = z.infer<typeof PageTilesGetActionPayloadSchema>;

export const CardTilesGetActionPayloadSchema = z.object({
	id: ItemIdSchema,
	parent: z.literal('card'),
	pageId: ItemIdSchema,
	cardId: ItemIdSchema,
});
export type ICardTilesGetActionPayload = z.infer<typeof CardTilesGetActionPayloadSchema>;

export type ITilesGetActionPayload = IPageTilesGetActionPayload | ICardTilesGetActionPayload;

export const PageTilesFetchActionPayloadSchema = z.object({
	parent: z.literal('page'),
	pageId: ItemIdSchema,
});
export type IPageTilesFetchActionPayload = z.infer<typeof PageTilesFetchActionPayloadSchema>;

export const CardTilesFetchActionPayloadSchema = z.object({
	parent: z.literal('card'),
	pageId: ItemIdSchema,
	cardId: ItemIdSchema,
});
export type ICardTilesFetchActionPayload = z.infer<typeof CardTilesFetchActionPayloadSchema>;

export type ITilesFetchActionPayload = IPageTilesFetchActionPayload | ICardTilesFetchActionPayload;

export const PageTilesAddActionPayloadSchema = z.object({
	id: ItemIdSchema.optional().default(uuid()),
	parent: z.literal('page'),
	pageId: ItemIdSchema,
	draft: z.boolean().optional().default(false),
	data: z
		.object({
			type: z.string().trim().nonempty(),
			row: z.number(),
			col: z.number(),
			rowSpan: z.number().default(0),
			colSpan: z.number().default(0),
		})
		.passthrough(),
});
export type IPageTilesAddActionPayload = z.infer<typeof PageTilesAddActionPayloadSchema>;

export const CardTilesAddActionPayloadSchema = z.object({
	id: ItemIdSchema.optional().default(uuid()),
	parent: z.literal('card'),
	pageId: ItemIdSchema,
	cardId: ItemIdSchema,
	draft: z.boolean().optional().default(false),
	data: z
		.object({
			type: z.string().trim().nonempty(),
			row: z.number(),
			col: z.number(),
			rowSpan: z.number().default(0),
			colSpan: z.number().default(0),
		})
		.passthrough(),
});
export type ICardTilesAddActionPayload = z.infer<typeof CardTilesAddActionPayloadSchema>;

export type ITilesAddActionPayload = IPageTilesAddActionPayload | ICardTilesAddActionPayload;

export const PageTilesEditActionPayloadSchema = z.object({
	id: ItemIdSchema,
	parent: z.literal('page'),
	pageId: ItemIdSchema,
	data: z
		.object({
			row: z.number().optional(),
			col: z.number().optional(),
			rowSpan: z.number().optional(),
			colSpan: z.number().optional(),
		})
		.passthrough(),
});
export type IPageTilesEditActionPayload = z.infer<typeof PageTilesEditActionPayloadSchema>;

export const CardTilesEditActionPayloadSchema = z.object({
	id: ItemIdSchema,
	parent: z.literal('card'),
	pageId: ItemIdSchema,
	cardId: ItemIdSchema,
	data: z
		.object({
			row: z.number().optional(),
			col: z.number().optional(),
			rowSpan: z.number().optional(),
			colSpan: z.number().optional(),
		})
		.passthrough(),
});
export type ICardTilesEditActionPayload = z.infer<typeof CardTilesEditActionPayloadSchema>;

export type ITilesEditActionPayload = IPageTilesEditActionPayload | ICardTilesEditActionPayload;

export const PageTilesSaveActionPayloadSchema = z.object({
	id: ItemIdSchema,
	parent: z.literal('page'),
	pageId: ItemIdSchema,
});
export type IPageTilesSaveActionPayload = z.infer<typeof PageTilesSaveActionPayloadSchema>;

export const CardTilesSaveActionPayloadSchema = z.object({
	id: ItemIdSchema,
	parent: z.literal('card'),
	pageId: ItemIdSchema,
	cardId: ItemIdSchema,
});
export type ICardTilesSaveActionPayload = z.infer<typeof CardTilesSaveActionPayloadSchema>;

export type ITilesSaveActionPayload = IPageTilesSaveActionPayload | ICardTilesSaveActionPayload;

export const PageTilesRemoveActionPayloadSchema = z.object({
	id: ItemIdSchema,
	parent: z.literal('page'),
	pageId: ItemIdSchema,
});
export type IPageTilesRemoveActionPayload = z.infer<typeof PageTilesRemoveActionPayloadSchema>;

export const CardTilesRemoveActionPayloadSchema = z.object({
	id: ItemIdSchema,
	parent: z.literal('card'),
	pageId: ItemIdSchema,
	cardId: ItemIdSchema,
});
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

export const TileCreateBaseReqSchema: ZodType<ApiCreateTileBase> = z.object({
	id: z.string().uuid().optional(),
	type: z.string().trim().nonempty(),
	row: z.number(),
	col: z.number(),
	row_span: z.number().default(0),
	col_span: z.number().default(0),
	data_source: z.array(DeviceChannelDataSourceCreateReqSchema).optional(),
});
export type ITileCreateBaseReq = z.infer<typeof TileCreateBaseReqSchema>;

export const DevicePreviewTileCreateReqSchema: ZodType<ApiCreateDevicePreviewTile> = TileCreateBaseReqSchema.and(
	z.object({
		type: z.nativeEnum(DashboardDevicePreviewTileType),
		device: z.string().uuid(),
		icon: z.string().trim().nullable(),
	})
);
export type IDevicePreviewTileCreateReq = z.infer<typeof DevicePreviewTileCreateReqSchema>;

export const TimeTileCreateReqSchema: ZodType<ApiCreateTimeTile> = TileCreateBaseReqSchema.and(
	z.object({
		type: z.nativeEnum(DashboardTimeTileType),
	})
);
export type ITimeTileCreateReq = z.infer<typeof TimeTileCreateReqSchema>;

export const DayWeatherTileCreateReqSchema: ZodType<ApiCreateDayWeatherTile> = TileCreateBaseReqSchema.and(
	z.object({
		type: z.nativeEnum(DashboardDayWeatherTileType),
	})
);
export type IDayWeatherTileCreateReq = z.infer<typeof DayWeatherTileCreateReqSchema>;

export const ForecastWeatherTileCreateReqSchema: ZodType<ApiCreateForecastWeatherTile> = TileCreateBaseReqSchema.and(
	z.object({
		type: z.nativeEnum(DashboardForecastWeatherTileType),
	})
);
export type IForecastWeatherTileCreateReq = z.infer<typeof ForecastWeatherTileCreateReqSchema>;

export type ITileCreateReq = IDevicePreviewTileCreateReq | ITimeTileCreateReq | IDayWeatherTileCreateReq | IForecastWeatherTileCreateReq;

export const TileUpdateBaseReqSchema: ZodType<ApiUpdateTileBase> = z.object({
	type: z.string().trim().nonempty(),
	row: z.number().optional(),
	col: z.number().optional(),
	row_span: z.number().optional(),
	col_span: z.number().optional(),
});
export type ITileUpdateBaseReq = z.infer<typeof TileUpdateBaseReqSchema>;

export const DevicePreviewTileUpdateReqSchema: ZodType<ApiUpdateDevicePreviewTile> = TileUpdateBaseReqSchema.and(
	z.object({
		type: z.nativeEnum(DashboardDevicePreviewTileType),
		device: z.string().uuid().optional(),
		icon: z.string().trim().nullable().optional(),
	})
);
export type IDevicePreviewTileUpdateReq = z.infer<typeof DevicePreviewTileUpdateReqSchema>;

export const TimeTileUpdateReqSchema: ZodType<ApiUpdateTimeTile> = TileUpdateBaseReqSchema.and(
	z.object({
		type: z.nativeEnum(DashboardTimeTileType),
	})
);
export type ITimeTileUpdateReq = z.infer<typeof TimeTileUpdateReqSchema>;

export const DayWeatherTileUpdateReqSchema: ZodType<ApiUpdateDayWeatherTile> = TileUpdateBaseReqSchema.and(
	z.object({
		type: z.nativeEnum(DashboardDayWeatherTileType),
	})
);
export type IDayWeatherTileUpdateReq = z.infer<typeof DayWeatherTileUpdateReqSchema>;

export const ForecastWeatherTileUpdateReqSchema: ZodType<ApiUpdateForecastWeatherTile> = TileUpdateBaseReqSchema.and(
	z.object({
		type: z.nativeEnum(DashboardForecastWeatherTileType),
	})
);
export type IForecastWeatherTileUpdateReq = z.infer<typeof ForecastWeatherTileUpdateReqSchema>;

export type ITileUpdateReq = IDevicePreviewTileUpdateReq | ITimeTileUpdateReq | IDayWeatherTileUpdateReq | IForecastWeatherTileUpdateReq;

export const TileResSchema: ZodType<ApiTileBase> = z.object({
	id: z.string().uuid(),
	type: z.string().trim().nonempty(),
	row: z.number(),
	col: z.number(),
	row_span: z.number(),
	col_span: z.number(),
	created_at: z.string().date(),
	updated_at: z.string().date().nullable(),
	data_source: z.array(TileDeviceChannelDataSourceResSchema),
});
export type ITileRes = z.infer<typeof TileResSchema>;

export const DevicePreviewTileResSchema: ZodType<ApiDevicePreviewTile> = TileResSchema.and(
	z.object({
		type: z.nativeEnum(DashboardDevicePreviewTileType),
		device: z.string().uuid(),
		icon: z.string().trim().nullable(),
	})
);
export type IDevicePreviewTileRes = z.infer<typeof DevicePreviewTileResSchema>;

export const PageDevicePreviewTileResSchema: ZodType<ApiPageDevicePreviewTile> = DevicePreviewTileResSchema.and(
	z.object({
		page: z.string().uuid(),
	})
).and(
	z.object({
		type: z.nativeEnum(DashboardDevicePreviewTileType),
	})
);
export type IPageDevicePreviewTileResSchema = z.infer<typeof PageDevicePreviewTileResSchema>;

export const CardDevicePreviewTileResSchema: ZodType<ApiCardDevicePreviewTile> = DevicePreviewTileResSchema.and(
	z.object({
		card: z.string().uuid(),
	})
);
export type ICardDevicePreviewTileResSchema = z.infer<typeof CardDevicePreviewTileResSchema>;

export const TimeTileResSchema: ZodType<ApiTimeTile> = TileResSchema.and(
	z.object({
		type: z.nativeEnum(DashboardTimeTileType),
	})
);
export type ITimeTileRes = z.infer<typeof TimeTileResSchema>;

export const PageTimeTileResSchema: ZodType<ApiPageTimeTile> = TimeTileResSchema.and(
	z.object({
		page: z.string().uuid(),
	})
);
export type IPageTimeTileResSchema = z.infer<typeof PageTimeTileResSchema>;

export const CardTimeTileResSchema: ZodType<ApiCardTimeTile> = TimeTileResSchema.and(
	z.object({
		card: z.string().uuid(),
	})
);
export type ICardTimeTileResSchema = z.infer<typeof CardTimeTileResSchema>;

export const DayWeatherTileResSchema: ZodType<ApiDayWeatherTile> = TileResSchema.and(
	z.object({
		type: z.nativeEnum(DashboardDayWeatherTileType),
	})
);
export type IDayWeatherTileRes = z.infer<typeof DayWeatherTileResSchema>;

export const PageDayWeatherTileResSchema: ZodType<ApiPageDayWeatherTile> = DayWeatherTileResSchema.and(
	z.object({
		page: z.string().uuid(),
	})
);
export type IPageDayWeatherTileResSchema = z.infer<typeof PageDayWeatherTileResSchema>;

export const CardDayWeatherTileResSchema: ZodType<ApiCardDayWeatherTile> = DayWeatherTileResSchema.and(
	z.object({
		card: z.string().uuid(),
	})
);
export type ICardDayWeatherTileResSchema = z.infer<typeof CardDayWeatherTileResSchema>;

export const ForecastWeatherTileResSchema: ZodType<ApiForecastWeatherTile> = TileResSchema.and(
	z.object({
		type: z.nativeEnum(DashboardForecastWeatherTileType),
	})
);
export type IForecastWeatherTileRes = z.infer<typeof ForecastWeatherTileResSchema>;

export const PageForecastWeatherTileResSchema: ZodType<ApiPageForecastWeatherTile> = ForecastWeatherTileResSchema.and(
	z.object({
		page: z.string().uuid(),
	})
);
export type IPageForecastWeatherTileResSchema = z.infer<typeof PageForecastWeatherTileResSchema>;

export const CardForecastWeatherTileResSchema: ZodType<ApiCardForecastWeatherTile> = ForecastWeatherTileResSchema.and(
	z.object({
		card: z.string().uuid(),
	})
);
export type ICardForecastWeatherTileResSchema = z.infer<typeof CardForecastWeatherTileResSchema>;

export type IPageTileResSchema =
	| IPageDevicePreviewTileResSchema
	| IPageTimeTileResSchema
	| IPageDayWeatherTileResSchema
	| IPageForecastWeatherTileResSchema;

export type ICardTileResSchema =
	| ICardDevicePreviewTileResSchema
	| ICardTimeTileResSchema
	| ICardDayWeatherTileResSchema
	| ICardForecastWeatherTileResSchema;

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
	tileRes: typeof TileResSchema;
};

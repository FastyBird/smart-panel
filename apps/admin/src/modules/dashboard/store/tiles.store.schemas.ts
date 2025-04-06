import { v4 as uuid } from 'uuid';
import { type ZodType, z } from 'zod';

import {
	DashboardDayWeatherTileType,
	DashboardDevicePreviewTileType,
	DashboardForecastWeatherTileType,
	DashboardTimeTileType,
	type components,
} from '../../../openapi';

import { DeviceChannelDataSourceCreateReqSchema, TileDeviceChannelDataSourceResSchema } from './dataSources.store.schemas';
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

export const DevicePreviewTileSchema = TileBaseSchema.extend({
	device: ItemIdSchema,
	icon: z.string().trim().nullable().default(null),
});

export const PageDevicePreviewTileSchema = DevicePreviewTileSchema.extend({
	page: ItemIdSchema,
});

export const CardDevicePreviewTileSchema = DevicePreviewTileSchema.extend({
	card: ItemIdSchema,
});

export const TimeTileSchema = TileBaseSchema.extend({});

export const PageTimeTileSchema = TimeTileSchema.extend({
	page: ItemIdSchema,
});

export const CardTimeTileSchema = TimeTileSchema.extend({
	card: ItemIdSchema,
});

export const DayWeatherTileSchema = TileBaseSchema.extend({});

export const PageDayWeatherTileSchema = DayWeatherTileSchema.extend({
	page: ItemIdSchema,
});

export const CardDayWeatherTileSchema = DayWeatherTileSchema.extend({
	card: ItemIdSchema,
});

export const ForecastWeatherTileSchema = TileBaseSchema.extend({});

export const PageForecastWeatherTileSchema = ForecastWeatherTileSchema.extend({
	page: ItemIdSchema,
});

export const CardForecastWeatherTileSchema = ForecastWeatherTileSchema.extend({
	card: ItemIdSchema,
});

export const TilesStateSemaphoreSchema = z.object({
	fetching: z.object({
		items: z.array(ItemIdSchema).default([]),
		item: z.array(ItemIdSchema),
	}),
	creating: z.array(ItemIdSchema),
	updating: z.array(ItemIdSchema),
	deleting: z.array(ItemIdSchema),
});

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

export const PageTilesUnsetActionPayloadSchema = z.object({
	id: ItemIdSchema.optional(),
	parent: z.literal('page'),
	pageId: ItemIdSchema,
});

export const CardTilesUnsetActionPayloadSchema = z.object({
	id: ItemIdSchema.optional(),
	parent: z.literal('card'),
	pageId: ItemIdSchema,
	cardId: ItemIdSchema,
});

export const PageTilesGetActionPayloadSchema = z.object({
	id: ItemIdSchema,
	parent: z.literal('page'),
	pageId: ItemIdSchema,
});

export const CardTilesGetActionPayloadSchema = z.object({
	id: ItemIdSchema,
	parent: z.literal('card'),
	pageId: ItemIdSchema,
	cardId: ItemIdSchema,
});

export const PageTilesFetchActionPayloadSchema = z.object({
	parent: z.literal('page'),
	pageId: ItemIdSchema,
});

export const CardTilesFetchActionPayloadSchema = z.object({
	parent: z.literal('card'),
	pageId: ItemIdSchema,
	cardId: ItemIdSchema,
});

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

export const PageTilesSaveActionPayloadSchema = z.object({
	id: ItemIdSchema,
	parent: z.literal('page'),
	pageId: ItemIdSchema,
});

export const CardTilesSaveActionPayloadSchema = z.object({
	id: ItemIdSchema,
	parent: z.literal('card'),
	pageId: ItemIdSchema,
	cardId: ItemIdSchema,
});

export const PageTilesRemoveActionPayloadSchema = z.object({
	id: ItemIdSchema,
	parent: z.literal('page'),
	pageId: ItemIdSchema,
});

export const CardTilesRemoveActionPayloadSchema = z.object({
	id: ItemIdSchema,
	parent: z.literal('card'),
	pageId: ItemIdSchema,
	cardId: ItemIdSchema,
});

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

export const DevicePreviewTileCreateReqSchema: ZodType<ApiCreateDevicePreviewTile> = TileCreateBaseReqSchema.and(
	z.object({
		type: z.nativeEnum(DashboardDevicePreviewTileType),
		device: z.string().uuid(),
		icon: z.string().trim().nullable(),
	})
);

export const TimeTileCreateReqSchema: ZodType<ApiCreateTimeTile> = TileCreateBaseReqSchema.and(
	z.object({
		type: z.nativeEnum(DashboardTimeTileType),
	})
);

export const DayWeatherTileCreateReqSchema: ZodType<ApiCreateDayWeatherTile> = TileCreateBaseReqSchema.and(
	z.object({
		type: z.nativeEnum(DashboardDayWeatherTileType),
	})
);

export const ForecastWeatherTileCreateReqSchema: ZodType<ApiCreateForecastWeatherTile> = TileCreateBaseReqSchema.and(
	z.object({
		type: z.nativeEnum(DashboardForecastWeatherTileType),
	})
);

export const TileUpdateBaseReqSchema: ZodType<ApiUpdateTileBase> = z.object({
	type: z.string().trim().nonempty(),
	row: z.number().optional(),
	col: z.number().optional(),
	row_span: z.number().optional(),
	col_span: z.number().optional(),
});

export const DevicePreviewTileUpdateReqSchema: ZodType<ApiUpdateDevicePreviewTile> = TileUpdateBaseReqSchema.and(
	z.object({
		type: z.nativeEnum(DashboardDevicePreviewTileType),
		device: z.string().uuid().optional(),
		icon: z.string().trim().nullable().optional(),
	})
);

export const TimeTileUpdateReqSchema: ZodType<ApiUpdateTimeTile> = TileUpdateBaseReqSchema.and(
	z.object({
		type: z.nativeEnum(DashboardTimeTileType),
	})
);

export const DayWeatherTileUpdateReqSchema: ZodType<ApiUpdateDayWeatherTile> = TileUpdateBaseReqSchema.and(
	z.object({
		type: z.nativeEnum(DashboardDayWeatherTileType),
	})
);

export const ForecastWeatherTileUpdateReqSchema: ZodType<ApiUpdateForecastWeatherTile> = TileUpdateBaseReqSchema.and(
	z.object({
		type: z.nativeEnum(DashboardForecastWeatherTileType),
	})
);

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

export const DevicePreviewTileResSchema: ZodType<ApiDevicePreviewTile> = TileResSchema.and(
	z.object({
		type: z.nativeEnum(DashboardDevicePreviewTileType),
		device: z.string().uuid(),
		icon: z.string().trim().nullable(),
	})
);

export const PageDevicePreviewTileResSchema: ZodType<ApiPageDevicePreviewTile> = DevicePreviewTileResSchema.and(
	z.object({
		page: z.string().uuid(),
	})
).and(
	z.object({
		type: z.nativeEnum(DashboardDevicePreviewTileType),
	})
);

export const CardDevicePreviewTileResSchema: ZodType<ApiCardDevicePreviewTile> = DevicePreviewTileResSchema.and(
	z.object({
		card: z.string().uuid(),
	})
);

export const TimeTileResSchema: ZodType<ApiTimeTile> = TileResSchema.and(
	z.object({
		type: z.nativeEnum(DashboardTimeTileType),
	})
);

export const PageTimeTileResSchema: ZodType<ApiPageTimeTile> = TimeTileResSchema.and(
	z.object({
		page: z.string().uuid(),
	})
);

export const CardTimeTileResSchema: ZodType<ApiCardTimeTile> = TimeTileResSchema.and(
	z.object({
		card: z.string().uuid(),
	})
);

export const DayWeatherTileResSchema: ZodType<ApiDayWeatherTile> = TileResSchema.and(
	z.object({
		type: z.nativeEnum(DashboardDayWeatherTileType),
	})
);

export const PageDayWeatherTileResSchema: ZodType<ApiPageDayWeatherTile> = DayWeatherTileResSchema.and(
	z.object({
		page: z.string().uuid(),
	})
);

export const CardDayWeatherTileResSchema: ZodType<ApiCardDayWeatherTile> = DayWeatherTileResSchema.and(
	z.object({
		card: z.string().uuid(),
	})
);

export const ForecastWeatherTileResSchema: ZodType<ApiForecastWeatherTile> = TileResSchema.and(
	z.object({
		type: z.nativeEnum(DashboardForecastWeatherTileType),
	})
);

export const PageForecastWeatherTileResSchema: ZodType<ApiPageForecastWeatherTile> = ForecastWeatherTileResSchema.and(
	z.object({
		page: z.string().uuid(),
	})
);

export const CardForecastWeatherTileResSchema: ZodType<ApiCardForecastWeatherTile> = ForecastWeatherTileResSchema.and(
	z.object({
		card: z.string().uuid(),
	})
);

import { v4 as uuid } from 'uuid';
import { type ZodType, z } from 'zod';

import { DashboardCardsPageType, DashboardDeviceDetailPageType, DashboardTilesPageType, type components } from '../../../openapi';

import { CardCreateReqSchema, CardResSchema } from './cards.store.schemas';
import { DeviceChannelDataSourceCreateReqSchema, PageDeviceChannelDataSourceResSchema } from './dataSources.store.schemas';
import {
	DayWeatherTileCreateReqSchema,
	DevicePreviewTileCreateReqSchema,
	ForecastWeatherTileCreateReqSchema,
	PageDayWeatherTileResSchema,
	PageDevicePreviewTileResSchema,
	PageForecastWeatherTileResSchema,
	PageTimeTileResSchema,
	TimeTileCreateReqSchema,
} from './tiles.store.schemas';
import { ItemIdSchema } from './types';

type ApiCreatePageBase = components['schemas']['DashboardCreatePageBase'];
type ApiCreateCardsPage = components['schemas']['DashboardCreateCardsPage'];
type ApiCreateTilesPage = components['schemas']['DashboardCreateTilesPage'];
type ApiCreateDeviceDetailPage = components['schemas']['DashboardCreateDeviceDetailPage'];

type ApiUpdatePageBase = components['schemas']['DashboardUpdatePageBase'];
type ApiUpdateCardsPage = components['schemas']['DashboardUpdateCardsPage'];
type ApiUpdateTilesPage = components['schemas']['DashboardUpdateTilesPage'];
type ApiUpdateDeviceDetailPage = components['schemas']['DashboardUpdateDeviceDetailPage'];

type ApiPageBase = components['schemas']['DashboardPageBase'];
type ApiCardsPage = components['schemas']['DashboardCardsPage'];
type ApiTilesPage = components['schemas']['DashboardTilesPage'];
type ApiDeviceDetailPage = components['schemas']['DashboardDeviceDetailPage'];

// STORE STATE
// ===========

export const PageBaseSchema = z.object({
	id: ItemIdSchema,
	type: z.string().trim().nonempty(),
	draft: z.boolean().default(false),
	title: z.string().trim().nonempty(),
	icon: z.string().trim().nullable().default(null),
	order: z.number().default(0),
	createdAt: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
	updatedAt: z
		.union([z.string().datetime({ offset: true }), z.date()])
		.transform((date) => (date instanceof Date ? date : new Date(date)))
		.optional()
		.nullable()
		.default(null),
});

export const CardsPageSchema = PageBaseSchema.extend({});

export const TilesPageSchema = PageBaseSchema.extend({});

export const DeviceDetailPageSchema = PageBaseSchema.extend({
	device: ItemIdSchema,
});

export const PagesStateSemaphoreSchema = z.object({
	fetching: z.object({
		items: z.boolean().default(false),
		item: z.array(ItemIdSchema),
	}),
	creating: z.array(ItemIdSchema),
	updating: z.array(ItemIdSchema),
	deleting: z.array(ItemIdSchema),
});

// STORE ACTIONS
// =============

export const PagesSetActionPayloadSchema = z.object({
	id: ItemIdSchema,
	data: z
		.object({
			type: z.string().trim().nonempty(),
			title: z.string().trim().nonempty(),
			icon: z
				.string()
				.trim()
				.transform((val) => (val === '' ? null : val))
				.nullable()
				.default(null)
				.optional(),
			order: z.number().default(0),
		})
		.passthrough(),
});

export const PagesUnsetActionPayloadSchema = z.object({
	id: ItemIdSchema,
});

export const PagesGetActionPayloadSchema = z.object({
	id: ItemIdSchema,
});

export const PagesAddActionPayloadSchema = z.object({
	id: ItemIdSchema.optional().default(uuid()),
	draft: z.boolean().optional().default(false),
	data: z
		.object({
			type: z.string().trim().nonempty(),
			title: z.string().trim().nonempty(),
			icon: z
				.string()
				.trim()
				.transform((val) => (val === '' ? null : val))
				.nullable()
				.default(null)
				.optional(),
			order: z.number().default(0),
		})
		.passthrough(),
});

export const PagesEditActionPayloadSchema = z.object({
	id: ItemIdSchema,
	data: z
		.object({
			type: z.string().trim().optional(),
			title: z.string().trim().optional(),
			icon: z
				.string()
				.trim()
				.transform((val) => (val === '' ? null : val))
				.nullable()
				.default(null)
				.optional(),
			order: z.number().optional(),
		})
		.passthrough(),
});

export const PagesSaveActionPayloadSchema = z.object({
	id: ItemIdSchema,
});

export const PagesRemoveActionPayloadSchema = z.object({
	id: ItemIdSchema,
});

// BACKEND API
// ===========

export const PageCreateBaseReqSchema: ZodType<ApiCreatePageBase> = z.object({
	id: z.string().uuid().optional(),
	type: z.string().trim().nonempty(),
	title: z.string().trim().nonempty(),
	icon: z
		.string()
		.trim()
		.transform((val) => (val === '' ? null : val))
		.nullable()
		.optional(),
	order: z.number().optional(),
});

export const CardsPageCreateReqSchema: ZodType<ApiCreateCardsPage> = PageCreateBaseReqSchema.and(
	z.object({
		type: z.nativeEnum(DashboardCardsPageType),
		cards: z.array(CardCreateReqSchema).optional(),
		data_source: z.array(DeviceChannelDataSourceCreateReqSchema).optional(),
	})
);

export const TilesPageCreateReqSchema: ZodType<ApiCreateTilesPage> = PageCreateBaseReqSchema.and(
	z.object({
		type: z.nativeEnum(DashboardTilesPageType),
		tiles: z
			.array(z.union([DevicePreviewTileCreateReqSchema, TimeTileCreateReqSchema, DayWeatherTileCreateReqSchema, ForecastWeatherTileCreateReqSchema]))
			.optional(),
		data_source: z.array(DeviceChannelDataSourceCreateReqSchema).optional(),
	})
);

export const DeviceDetailPageCreateReqSchema: ZodType<ApiCreateDeviceDetailPage> = PageCreateBaseReqSchema.and(
	z.object({
		type: z.nativeEnum(DashboardDeviceDetailPageType),
		device: z.string().uuid(),
	})
);

export const PageUpdateBaseReqSchema: ZodType<ApiUpdatePageBase> = z.object({
	type: z.string().trim().nonempty(),
	title: z.string().trim().nonempty().optional(),
	icon: z
		.string()
		.trim()
		.transform((val) => (val === '' ? null : val))
		.nullable()
		.optional(),
	order: z.number().optional(),
});

export const CardsPageUpdateReqSchema: ZodType<ApiUpdateCardsPage> = PageUpdateBaseReqSchema.and(
	z.object({
		type: z.nativeEnum(DashboardCardsPageType),
	})
);

export const TilesPageUpdateReqSchema: ZodType<ApiUpdateTilesPage> = PageUpdateBaseReqSchema.and(
	z.object({
		type: z.nativeEnum(DashboardTilesPageType),
	})
);

export const DeviceDetailPageUpdateReqSchema: ZodType<ApiUpdateDeviceDetailPage> = PageUpdateBaseReqSchema.and(
	z.object({
		type: z.nativeEnum(DashboardDeviceDetailPageType),
		device: z.string().uuid().optional(),
	})
);

export const PageResSchema: ZodType<ApiPageBase> = z.object({
	id: z.string().uuid(),
	type: z.string(),
	title: z.string().trim().nonempty(),
	icon: z.string().trim().nullable(),
	order: z.number(),
	created_at: z.string().date(),
	updated_at: z.string().date().nullable(),
});

export const CardsPageResSchema: ZodType<ApiCardsPage> = PageResSchema.and(
	z.object({
		type: z.nativeEnum(DashboardCardsPageType),
		cards: z.array(CardResSchema),
		data_source: z.array(PageDeviceChannelDataSourceResSchema),
	})
);

export const TilesPageResSchema: ZodType<ApiTilesPage> = PageResSchema.and(
	z.object({
		type: z.nativeEnum(DashboardTilesPageType),
		tiles: z.array(z.union([PageDevicePreviewTileResSchema, PageTimeTileResSchema, PageDayWeatherTileResSchema, PageForecastWeatherTileResSchema])),
		data_source: z.array(PageDeviceChannelDataSourceResSchema),
	})
);

export const DeviceDetailPageResSchema: ZodType<ApiDeviceDetailPage> = PageResSchema.and(
	z.object({
		type: z.nativeEnum(DashboardDeviceDetailPageType),
		device: z.string().uuid(),
	})
);

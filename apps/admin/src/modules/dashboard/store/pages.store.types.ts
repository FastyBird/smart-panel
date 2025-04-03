import type { Ref } from 'vue';

import type { Store } from 'pinia';

import { v4 as uuid } from 'uuid';
import { type ZodType, z } from 'zod';

import { DashboardCardsPageType, DashboardDeviceDetailPageType, DashboardTilesPageType, type components } from '../../../openapi';

import { CardCreateReqSchema, CardResSchema } from './cards.store.types';
import { DeviceChannelDataSourceCreateReqSchema, PageDeviceChannelDataSourceResSchema } from './dataSources.store.types';
import {
	DayWeatherTileCreateReqSchema,
	DevicePreviewTileCreateReqSchema,
	ForecastWeatherTileCreateReqSchema,
	PageDayWeatherTileResSchema,
	PageDevicePreviewTileResSchema,
	PageForecastWeatherTileResSchema,
	PageTimeTileResSchema,
	TimeTileCreateReqSchema,
} from './tiles.store.types';
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
export type IPageBase = z.infer<typeof PageBaseSchema>;

export const CardsPageSchema = PageBaseSchema.extend({});
export type ICardsPage = z.infer<typeof CardsPageSchema>;

export const TilesPageSchema = PageBaseSchema.extend({});
export type ITilesPage = z.infer<typeof TilesPageSchema>;

export const DeviceDetailPageSchema = PageBaseSchema.extend({
	device: ItemIdSchema,
});
export type IDeviceDetailPage = z.infer<typeof DeviceDetailPageSchema>;

export type IPage = ICardsPage | ITilesPage | IDeviceDetailPage;

export const PagesStateSemaphoreSchema = z.object({
	fetching: z.object({
		items: z.boolean().default(false),
		item: z.array(ItemIdSchema),
	}),
	creating: z.array(ItemIdSchema),
	updating: z.array(ItemIdSchema),
	deleting: z.array(ItemIdSchema),
});
export type IPagesStateSemaphore = z.infer<typeof PagesStateSemaphoreSchema>;

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
export type IPagesSetActionPayload = z.infer<typeof PagesSetActionPayloadSchema>;

export const PagesUnsetActionPayloadSchema = z.object({
	id: ItemIdSchema,
});
export type IPagesUnsetActionPayload = z.infer<typeof PagesUnsetActionPayloadSchema>;

export const PagesGetActionPayloadSchema = z.object({
	id: ItemIdSchema,
});
export type IPagesGetActionPayload = z.infer<typeof PagesGetActionPayloadSchema>;

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
export type IPagesAddActionPayload = z.infer<typeof PagesAddActionPayloadSchema>;

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
export type IPagesEditActionPayload = z.infer<typeof PagesEditActionPayloadSchema>;

export const PagesSaveActionPayloadSchema = z.object({
	id: ItemIdSchema,
});
export type IPagesSaveActionPayload = z.infer<typeof PagesSaveActionPayloadSchema>;

export const PagesRemoveActionPayloadSchema = z.object({
	id: ItemIdSchema,
});
export type IPagesRemoveActionPayload = z.infer<typeof PagesRemoveActionPayloadSchema>;

// STORE
// =====

export interface IPagesStoreState {
	data: Ref<{ [key: IPageBase['id']]: IPageBase }>;
	semaphore: Ref<IPagesStateSemaphore>;
	firstLoad: Ref<boolean>;
}

export interface IPagesStoreActions {
	// Getters
	firstLoadFinished: () => boolean;
	getting: (id: IPageBase['id']) => boolean;
	fetching: () => boolean;
	findById: (id: IPageBase['id']) => IPageBase | null;
	findAll: () => IPageBase[];
	// Actions
	set: (payload: IPagesSetActionPayload) => IPageBase;
	unset: (payload: IPagesUnsetActionPayload) => void;
	get: (payload: IPagesGetActionPayload) => Promise<IPageBase>;
	fetch: () => Promise<IPageBase[]>;
	add: (payload: IPagesAddActionPayload) => Promise<IPageBase>;
	edit: (payload: IPagesEditActionPayload) => Promise<IPageBase>;
	save: (payload: IPagesSaveActionPayload) => Promise<IPageBase>;
	remove: (payload: IPagesRemoveActionPayload) => Promise<boolean>;
}

export type PagesStoreSetup = IPagesStoreState & IPagesStoreActions;

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
export type IPageCreateBaseReq = z.infer<typeof PageCreateBaseReqSchema>;

export const CardsPageCreateReqSchema: ZodType<ApiCreateCardsPage> = PageCreateBaseReqSchema.and(
	z.object({
		type: z.nativeEnum(DashboardCardsPageType),
		cards: z.array(CardCreateReqSchema).optional(),
		data_source: z.array(DeviceChannelDataSourceCreateReqSchema).optional(),
	})
);
export type ICardPageCreateReq = z.infer<typeof CardsPageCreateReqSchema>;

export const TilesPageCreateReqSchema: ZodType<ApiCreateTilesPage> = PageCreateBaseReqSchema.and(
	z.object({
		type: z.nativeEnum(DashboardTilesPageType),
		tiles: z
			.array(z.union([DevicePreviewTileCreateReqSchema, TimeTileCreateReqSchema, DayWeatherTileCreateReqSchema, ForecastWeatherTileCreateReqSchema]))
			.optional(),
		data_source: z.array(DeviceChannelDataSourceCreateReqSchema).optional(),
	})
);
export type ITilePageCreateReq = z.infer<typeof TilesPageCreateReqSchema>;

export const DeviceDetailPageCreateReqSchema: ZodType<ApiCreateDeviceDetailPage> = PageCreateBaseReqSchema.and(
	z.object({
		type: z.nativeEnum(DashboardDeviceDetailPageType),
		device: z.string().uuid(),
	})
);
export type IDeviceDetailPageCreateReq = z.infer<typeof DeviceDetailPageCreateReqSchema>;

export type IPageCreateReq = ICardPageCreateReq | ITilePageCreateReq | IDeviceDetailPageCreateReq;

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
export type IPageUpdateBaseReq = z.infer<typeof PageUpdateBaseReqSchema>;

export const CardsPageUpdateReqSchema: ZodType<ApiUpdateCardsPage> = PageUpdateBaseReqSchema.and(
	z.object({
		type: z.nativeEnum(DashboardCardsPageType),
	})
);
export type ICardsPageUpdateReq = z.infer<typeof CardsPageUpdateReqSchema>;

export const TilesPageUpdateReqSchema: ZodType<ApiUpdateTilesPage> = PageUpdateBaseReqSchema.and(
	z.object({
		type: z.nativeEnum(DashboardTilesPageType),
	})
);
export type ITilesPageUpdateReq = z.infer<typeof TilesPageUpdateReqSchema>;

export const DeviceDetailPageUpdateReqSchema: ZodType<ApiUpdateDeviceDetailPage> = PageUpdateBaseReqSchema.and(
	z.object({
		type: z.nativeEnum(DashboardDeviceDetailPageType),
		device: z.string().uuid().optional(),
	})
);
export type IDeviceDetailPageUpdateReq = z.infer<typeof DeviceDetailPageUpdateReqSchema>;

export type IPageUpdateReq = ICardsPageUpdateReq | ITilesPageUpdateReq | IDeviceDetailPageUpdateReq;

export const PageResSchema: ZodType<ApiPageBase> = z.object({
	id: z.string().uuid(),
	type: z.string(),
	title: z.string().trim().nonempty(),
	icon: z.string().trim().nullable(),
	order: z.number(),
	created_at: z.string().date(),
	updated_at: z.string().date().nullable(),
});
export type IPageRes = z.infer<typeof PageResSchema>;

export const CardsPageResSchema: ZodType<ApiCardsPage> = PageResSchema.and(
	z.object({
		type: z.nativeEnum(DashboardCardsPageType),
		cards: z.array(CardResSchema),
		data_source: z.array(PageDeviceChannelDataSourceResSchema),
	})
);
export type ICardsPageResSchema = z.infer<typeof CardsPageResSchema>;

export const TilesPageResSchema: ZodType<ApiTilesPage> = PageResSchema.and(
	z.object({
		type: z.nativeEnum(DashboardTilesPageType),
		tiles: z.array(z.union([PageDevicePreviewTileResSchema, PageTimeTileResSchema, PageDayWeatherTileResSchema, PageForecastWeatherTileResSchema])),
		data_source: z.array(PageDeviceChannelDataSourceResSchema),
	})
);
export type ITilesPageResSchema = z.infer<typeof TilesPageResSchema>;

export const DeviceDetailPageResSchema: ZodType<ApiDeviceDetailPage> = PageResSchema.and(
	z.object({
		type: z.nativeEnum(DashboardDeviceDetailPageType),
		device: z.string().uuid(),
	})
);
export type IDeviceDetailPageResSchema = z.infer<typeof DeviceDetailPageResSchema>;

// STORE
export type PagesStore = Store<string, IPagesStoreState, object, IPagesStoreActions>;

// MISC
export type IPagesEntitiesSchemas = {
	page: typeof PageBaseSchema;
	createPageReq: typeof PageCreateBaseReqSchema;
	updatePageReq: typeof PageUpdateBaseReqSchema;
	pageRes: typeof PageResSchema;
};

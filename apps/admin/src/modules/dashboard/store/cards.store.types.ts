import type { Ref } from 'vue';

import type { Store } from 'pinia';

import { v4 as uuid } from 'uuid';
import { type ZodType, z } from 'zod';

import { type components } from '../../../openapi';

import { CardDeviceChannelDataSourceResSchema, DeviceChannelDataSourceCreateReqSchema } from './dataSources.store.types';
import { type IPage } from './pages.store.types';
import {
	CardDayWeatherTileResSchema,
	CardDevicePreviewTileResSchema,
	CardForecastWeatherTileResSchema,
	CardTimeTileResSchema,
	DayWeatherTileCreateReqSchema,
	DevicePreviewTileCreateReqSchema,
	ForecastWeatherTileCreateReqSchema,
	TimeTileCreateReqSchema,
} from './tiles.store.types';
import { ItemIdSchema } from './types';

type ApiCreateCard = components['schemas']['DashboardCreateCard'];
type ApiUpdateCard = components['schemas']['DashboardUpdateCard'];
type ApiCard = components['schemas']['DashboardCard'];

// STORE STATE
// ===========

export const CardSchema = z.object({
	id: ItemIdSchema,
	draft: z.boolean().default(false),
	page: ItemIdSchema,
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
export type ICard = z.infer<typeof CardSchema>;

export const CardsStateSemaphoreSchema = z.object({
	fetching: z.object({
		items: z.array(ItemIdSchema).default([]),
		item: z.array(ItemIdSchema),
	}),
	creating: z.array(ItemIdSchema),
	updating: z.array(ItemIdSchema),
	deleting: z.array(ItemIdSchema),
});
export type ICardsStateSemaphore = z.infer<typeof CardsStateSemaphoreSchema>;

// STORE ACTIONS
// =============

export const CardsSetActionPayloadSchema = z.object({
	id: ItemIdSchema,
	pageId: ItemIdSchema,
	data: z
		.object({
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
export type ICardsSetActionPayload = z.infer<typeof CardsSetActionPayloadSchema>;

export const CardsUnsetActionPayloadSchema = z.object({
	id: ItemIdSchema.optional(),
	pageId: ItemIdSchema.optional(),
});
export type ICardsUnsetActionPayload = z.infer<typeof CardsUnsetActionPayloadSchema>;

export const CardsGetActionPayloadSchema = z.object({
	id: ItemIdSchema,
	pageId: ItemIdSchema,
});
export type ICardsGetActionPayload = z.infer<typeof CardsGetActionPayloadSchema>;

export const CardsFetchActionPayloadSchema = z.object({
	pageId: ItemIdSchema,
});
export type ICardsFetchActionPayload = z.infer<typeof CardsFetchActionPayloadSchema>;

export const CardsAddActionPayloadSchema = z.object({
	id: ItemIdSchema.optional().default(uuid()),
	pageId: ItemIdSchema,
	draft: z.boolean().optional().default(false),
	data: z.object({
		title: z.string().trim().nonempty(),
		icon: z
			.string()
			.trim()
			.transform((val) => (val === '' ? null : val))
			.nullable()
			.default(null)
			.optional(),
		order: z.number().default(0),
	}),
});
export type ICardsAddActionPayload = z.infer<typeof CardsAddActionPayloadSchema>;

export const CardsEditActionPayloadSchema = z.object({
	id: ItemIdSchema,
	pageId: ItemIdSchema,
	data: z.object({
		title: z.string().trim().nonempty().optional(),
		icon: z
			.string()
			.trim()
			.transform((val) => (val === '' ? null : val))
			.nullable()
			.optional(),
		order: z.number().optional(),
	}),
});
export type ICardsEditActionPayload = z.infer<typeof CardsEditActionPayloadSchema>;

export const CardsSaveActionPayloadSchema = z.object({
	id: ItemIdSchema,
	pageId: ItemIdSchema,
});
export type ICardsSaveActionPayload = z.infer<typeof CardsSaveActionPayloadSchema>;

export const CardsRemoveActionPayloadSchema = z.object({
	id: ItemIdSchema,
	pageId: ItemIdSchema,
});
export type ICardsRemoveActionPayload = z.infer<typeof CardsRemoveActionPayloadSchema>;

// STORE
// =====

export interface ICardsStoreState {
	data: Ref<{ [key: ICard['id']]: ICard }>;
	semaphore: Ref<ICardsStateSemaphore>;
	firstLoad: Ref<IPage['id'][]>;
}

export interface ICardsStoreActions {
	// Getters
	firstLoadFinished: (pageId: IPage['id']) => boolean;
	getting: (id: ICard['id']) => boolean;
	fetching: (pageId: IPage['id']) => boolean;
	findById: (id: ICard['id']) => ICard | null;
	findForPage: (pageId: IPage['id']) => ICard[];
	findAll: () => ICard[];
	// Actions
	set: (payload: ICardsSetActionPayload) => ICard;
	unset: (payload: ICardsUnsetActionPayload) => void;
	get: (payload: ICardsGetActionPayload) => Promise<ICard>;
	fetch: (payload: ICardsFetchActionPayload) => Promise<ICard[]>;
	add: (payload: ICardsAddActionPayload) => Promise<ICard>;
	edit: (payload: ICardsEditActionPayload) => Promise<ICard>;
	save: (payload: ICardsSaveActionPayload) => Promise<ICard>;
	remove: (payload: ICardsRemoveActionPayload) => Promise<boolean>;
}

export type CardsStoreSetup = ICardsStoreState & ICardsStoreActions;

// BACKEND API
// ===========

export const CardCreateReqSchema: ZodType<ApiCreateCard> = z.object({
	id: z.string().uuid().optional(),
	title: z.string().trim().nonempty(),
	icon: z
		.string()
		.trim()
		.transform((val) => (val === '' ? null : val))
		.nullable()
		.optional(),
	order: z.number().optional(),
	tiles: z
		.array(z.union([DevicePreviewTileCreateReqSchema, TimeTileCreateReqSchema, DayWeatherTileCreateReqSchema, ForecastWeatherTileCreateReqSchema]))
		.optional(),
	data_source: z.array(DeviceChannelDataSourceCreateReqSchema).optional(),
});
export type ICardCreateReq = z.infer<typeof CardCreateReqSchema>;

export const CardUpdateReqSchema: ZodType<ApiUpdateCard> = z.object({
	title: z.string().trim().nonempty().optional(),
	icon: z
		.string()
		.trim()
		.transform((val) => (val === '' ? null : val))
		.nullable()
		.optional(),
	order: z.number().optional(),
});
export type ICardUpdateReq = z.infer<typeof CardUpdateReqSchema>;

export const CardResSchema: ZodType<ApiCard> = z.object({
	id: z.string().uuid(),
	page: z.string().uuid(),
	title: z.string().trim().nonempty(),
	icon: z.string().trim().nullable(),
	order: z.number(),
	created_at: z.string().date(),
	updated_at: z.string().date().nullable(),
	tiles: z.array(z.union([CardDevicePreviewTileResSchema, CardTimeTileResSchema, CardDayWeatherTileResSchema, CardForecastWeatherTileResSchema])),
	data_source: z.array(CardDeviceChannelDataSourceResSchema),
});
export type ICardRes = z.infer<typeof CardResSchema>;

// STORE
export type CardsStore = Store<string, ICardsStoreState, object, ICardsStoreActions>;

import { v4 as uuid } from 'uuid';
import { type ZodType, z } from 'zod';

import { DataSourceCreateReqSchema, DataSourceResSchema, ItemIdSchema, TileCreateReqSchema, TileResSchema } from '../../../modules/dashboard';
import { type components } from '../../../openapi';

type ApiCreateCard = components['schemas']['PagesCardsPluginCreateCard'];
type ApiUpdateCard = components['schemas']['PagesCardsPluginUpdateCard'];
type ApiCard = components['schemas']['PagesCardsPluginCard'];

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

export const CardsStateSemaphoreSchema = z.object({
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

export const CardsOnEventActionPayloadSchema = z.object({
	id: ItemIdSchema,
	data: z.object({}),
});

export const CardsSetActionPayloadSchema = z.object({
	id: ItemIdSchema,
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

export const CardsUnsetActionPayloadSchema = z.object({
	id: ItemIdSchema.optional(),
	pageId: ItemIdSchema.optional(),
});

export const CardsGetActionPayloadSchema = z.object({
	id: ItemIdSchema,
	pageId: ItemIdSchema,
});

export const CardsFetchActionPayloadSchema = z.object({
	pageId: ItemIdSchema,
});

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

export const CardsSaveActionPayloadSchema = z.object({
	id: ItemIdSchema,
	pageId: ItemIdSchema,
});

export const CardsRemoveActionPayloadSchema = z.object({
	id: ItemIdSchema,
	pageId: ItemIdSchema,
});

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
	tiles: z.array(TileCreateReqSchema).optional(),
	data_source: z.array(DataSourceCreateReqSchema).optional(),
});

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

export const CardResSchema: ZodType<ApiCard> = z.object({
	id: z.string().uuid(),
	page: z.string().uuid(),
	title: z.string().trim().nonempty(),
	icon: z.string().trim().nullable(),
	order: z.number(),
	created_at: z.string().date(),
	updated_at: z.string().date().nullable(),
	tiles: z.array(TileResSchema),
	data_source: z.array(DataSourceResSchema),
});

import { v4 as uuid } from 'uuid';
import { type ZodType, z } from 'zod';

import { type components } from '../../../openapi';

import { DataSourceResSchema } from './data-sources.store.schemas';
import { ItemIdSchema } from './types';

type ApiCreatePage = components['schemas']['DashboardModuleCreatePage'];
type ApiUpdatePage = components['schemas']['DashboardModuleUpdatePage'];
type ApiPage = components['schemas']['DashboardModulePage'];

// STORE STATE
// ===========

export const PageSchema = z.object({
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

export const PagesOnSetActionPayloadSchema = z.object({
	id: ItemIdSchema,
	type: z.string().trim().nonempty(),
	data: z.object({}),
});

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
			order: z.number().default(0).optional(),
		})
		.passthrough(),
});

export const PagesEditActionPayloadSchema = z.object({
	id: ItemIdSchema,
	data: z
		.object({
			type: z.string().trim().nonempty(),
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

export const PageCreateReqSchema: ZodType<ApiCreatePage> = z.object({
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

export const PageUpdateReqSchema: ZodType<ApiUpdatePage> = z.object({
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

export const PageResSchema: ZodType<ApiPage> = z.object({
	id: z.string().uuid(),
	type: z.string(),
	title: z.string().trim().nonempty(),
	icon: z.string().trim().nullable(),
	order: z.number(),
	data_source: z.array(DataSourceResSchema),
	created_at: z.string().date(),
	updated_at: z.string().date().nullable(),
});

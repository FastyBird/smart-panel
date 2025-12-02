import { v4 as uuid } from 'uuid';
import { type ZodType, z } from 'zod';

import { type components } from '../../../openapi.constants';

import { DataSourceCreateReqSchema, DataSourceResSchema } from './data-sources.store.schemas';
import { ItemIdSchema } from './types';

type ApiCreateTile = components['schemas']['DashboardModuleCreateTile'];
type ApiUpdateTile = components['schemas']['DashboardModuleUpdateSingleTile'];
type ApiTile = components['schemas']['DashboardModuleDataTile'];

// STORE STATE
// ===========

export const TileSchema = z.object({
	id: ItemIdSchema,
	type: z.string().trim().nonempty(),
	parent: z.object({
		id: ItemIdSchema,
		type: z.string().trim().nonempty(),
	}),
	draft: z.boolean().default(false),
	row: z.number(),
	col: z.number(),
	rowSpan: z.number().default(1),
	colSpan: z.number().default(1),
	hidden: z.boolean().default(false),
	createdAt: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
	updatedAt: z
		.union([z.string().datetime({ offset: true }), z.date()])
		.transform((date) => (date instanceof Date ? date : new Date(date)))
		.optional()
		.nullable()
		.default(null),
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

export const TilesOnEventActionPayloadSchema = z.object({
	id: ItemIdSchema,
	parent: z.object({
		id: ItemIdSchema,
		type: z.string().trim().nonempty(),
	}),
	type: z.string().trim().nonempty(),
	data: z.object({}),
});

export const TilesSetActionPayloadSchema = z.object({
	id: ItemIdSchema,
	parent: z.object({
		id: ItemIdSchema,
		type: z.string().trim().nonempty(),
	}),
	data: z
		.object({
			type: z.string().trim().nonempty(),
			row: z.number(),
			col: z.number(),
			rowSpan: z.number().default(1),
			colSpan: z.number().default(1),
			hidden: z.boolean().default(false),
		})
		.passthrough(),
});

export const TilesUnsetActionPayloadSchema = z.object({
	id: ItemIdSchema.optional(),
	parent: z
		.object({
			id: ItemIdSchema,
			type: z.string().trim().nonempty(),
		})
		.optional(),
});

export const TilesGetActionPayloadSchema = z.object({
	id: ItemIdSchema,
	parent: z
		.object({
			id: ItemIdSchema,
			type: z.string().trim().nonempty(),
		})
		.optional(),
});

export const TilesFetchActionPayloadSchema = z.object({
	parent: z.object({
		id: ItemIdSchema,
		type: z.string().trim().nonempty(),
	}),
});

export const TilesAddActionPayloadSchema = z.object({
	id: ItemIdSchema.optional().default(uuid()),
	parent: z.object({
		id: ItemIdSchema,
		type: z.string().trim().nonempty(),
	}),
	draft: z.boolean().optional().default(false),
	data: z
		.object({
			type: z.string().trim().nonempty(),
			row: z.number(),
			col: z.number(),
			rowSpan: z.number().default(1),
			colSpan: z.number().default(1),
			hidden: z.boolean().default(false),
		})
		.passthrough(),
});

export const TilesEditActionPayloadSchema = z.object({
	id: ItemIdSchema,
	parent: z.object({
		id: ItemIdSchema,
		type: z.string().trim().nonempty(),
	}),
	data: z
		.object({
			type: z.string().trim().nonempty(),
			row: z.number().optional(),
			col: z.number().optional(),
			rowSpan: z.number().optional(),
			colSpan: z.number().optional(),
			hidden: z.boolean().optional(),
		})
		.passthrough(),
});

export const TilesSaveActionPayloadSchema = z.object({
	id: ItemIdSchema,
	parent: z.object({
		id: ItemIdSchema,
		type: z.string().trim().nonempty(),
	}),
});

export const TilesRemoveActionPayloadSchema = z.object({
	id: ItemIdSchema,
	parent: z.object({
		id: ItemIdSchema,
		type: z.string().trim().nonempty(),
	}),
});

// BACKEND API
// ===========

export const TileCreateReqSchema: ZodType<ApiCreateTile & { parent: { type: string; id: string } }> = z.object({
	id: z.string().uuid().optional(),
	type: z.string().trim().nonempty(),
	parent: z.object({
		id: z.string().uuid(),
		type: z.string().trim().nonempty(),
	}),
	row: z.number(),
	col: z.number(),
	row_span: z.number().default(1),
	col_span: z.number().default(1),
	hidden: z.boolean().default(false),
	data_source: z.array(DataSourceCreateReqSchema).optional(),
});

export const TileUpdateReqSchema: ZodType<ApiUpdateTile & { parent: { type: string; id: string } }> = z.object({
	type: z.string().trim().nonempty(),
	parent: z.object({
		id: z.string().uuid(),
		type: z.string().trim().nonempty(),
	}),
	row: z.number().optional(),
	col: z.number().optional(),
	row_span: z.number().optional(),
	col_span: z.number().optional(),
	hidden: z.boolean().optional(),
});

export const TileResSchema: ZodType<ApiTile> = z.object({
	id: z.string().uuid(),
	type: z.string().trim().nonempty(),
	parent: z.object({
		id: z.string().uuid(),
		type: z.string().trim().nonempty(),
	}),
	row: z.number(),
	col: z.number(),
	row_span: z.number(),
	col_span: z.number(),
	hidden: z.boolean(),
	created_at: z.string().date(),
	updated_at: z.string().date().nullable(),
	data_source: z.array(DataSourceResSchema),
});

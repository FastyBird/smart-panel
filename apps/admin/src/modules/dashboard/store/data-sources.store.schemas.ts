import { v4 as uuid } from 'uuid';
import { type ZodType, z } from 'zod';

import type { components } from '../../../openapi';

import { ItemIdSchema } from './types';

type ApiCreateDataSource = components['schemas']['DashboardModuleCreateDataSource'];
type ApiUpdateDataSource = components['schemas']['DashboardModuleUpdateSingleDataSource'];
type ApiDataSource = components['schemas']['DashboardModuleDataDataSource'];

// STORE STATE
// ===========

export const DataSourceSchema = z.object({
	id: ItemIdSchema,
	type: z.string().trim().nonempty(),
	parent: z.object({
		id: ItemIdSchema,
		type: z.string().trim().nonempty(),
	}),
	draft: z.boolean().default(false),
	createdAt: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
	updatedAt: z
		.union([z.string().datetime({ offset: true }), z.date()])
		.transform((date) => (date instanceof Date ? date : new Date(date)))
		.nullable()
		.default(null),
});

export const DataSourcesStateSemaphoreSchema = z.object({
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

export const DataSourcesOnEventActionPayloadSchema = z.object({
	id: ItemIdSchema,
	parent: z.object({
		id: ItemIdSchema,
		type: z.string().trim().nonempty(),
	}),
	type: z.string().trim().nonempty(),
	data: z.object({}),
});

export const DataSourcesSetActionPayloadSchema = z.object({
	id: ItemIdSchema,
	parent: z.object({
		id: ItemIdSchema,
		type: z.string().trim().nonempty(),
	}),
	data: z
		.object({
			type: z.string().trim().nonempty(),
		})
		.passthrough(),
});

export const DataSourcesUnsetActionPayloadSchema = z.object({
	id: ItemIdSchema.optional(),
	parent: z
		.object({
			id: ItemIdSchema,
			type: z.string().trim().nonempty(),
		})
		.optional(),
});

export const DataSourcesGetActionPayloadSchema = z.object({
	id: ItemIdSchema,
	parent: z.object({
		id: ItemIdSchema,
		type: z.string().trim().nonempty(),
	}),
});

export const DataSourcesFetchActionPayloadSchema = z.object({
	parent: z.object({
		id: ItemIdSchema,
		type: z.string().trim().nonempty(),
	}),
});

export const DataSourcesAddActionPayloadSchema = z.object({
	id: ItemIdSchema.optional().default(uuid()),
	parent: z.object({
		id: ItemIdSchema,
		type: z.string().trim().nonempty(),
	}),
	draft: z.boolean().optional().default(false),
	data: z
		.object({
			type: z.string().trim().nonempty(),
		})
		.passthrough(),
});

export const DataSourcesEditActionPayloadSchema = z.object({
	id: ItemIdSchema,
	parent: z.object({
		id: ItemIdSchema,
		type: z.string().trim().nonempty(),
	}),
	data: z
		.object({
			type: z.string().trim().nonempty(),
		})
		.passthrough(),
});

export const DataSourcesSaveActionPayloadSchema = z.object({
	id: ItemIdSchema,
	parent: z.object({
		id: ItemIdSchema,
		type: z.string().trim().nonempty(),
	}),
});

export const DataSourcesRemoveActionPayloadSchema = z.object({
	id: ItemIdSchema,
	parent: z.object({
		id: ItemIdSchema,
		type: z.string().trim().nonempty(),
	}),
});

// BACKEND API
// ===========

export const DataSourceCreateReqSchema: ZodType<ApiCreateDataSource & { parent: { type: string; id: string } }> = z.object({
	id: z.string().uuid().optional(),
	type: z.string().trim().nonempty(),
	parent: z.object({
		id: z.string().uuid(),
		type: z.string().trim().nonempty(),
	}),
});

export const DataSourceUpdateReqSchema: ZodType<ApiUpdateDataSource> = z.object({
	type: z.string().trim().nonempty(),
	parent: z.object({
		id: z.string().uuid(),
		type: z.string().trim().nonempty(),
	}),
});

export const DataSourceResSchema: ZodType<ApiDataSource> = z.object({
	id: z.string().uuid(),
	type: z.string().trim().nonempty(),
	parent: z.object({
		id: z.string().uuid(),
		type: z.string().trim().nonempty(),
	}),
	created_at: z.string(),
	updated_at: z.string().nullable(),
});

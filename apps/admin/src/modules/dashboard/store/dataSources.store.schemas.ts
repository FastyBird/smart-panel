import { v4 as uuid } from 'uuid';
import { type ZodType, z } from 'zod';

import { DashboardDeviceChannelDataSourceType, type components } from '../../../openapi';

import { ItemIdSchema } from './types';

type ApiCreateDataSourceBase = components['schemas']['DashboardCreateDataSourceBase'];
type ApiCreateDeviceChannelDataSource = components['schemas']['DashboardCreateDeviceChannelDataSource'];

type ApiUpdateDataSourceBase = components['schemas']['DashboardUpdateDataSourceBase'];
type ApiUpdateDeviceChannelDataSource = components['schemas']['DashboardUpdateDeviceChannelDataSource'];

type ApiDataSourceBase = components['schemas']['DashboardDataSourceBase'];
type ApiDeviceChannelDataSource = components['schemas']['DashboardDeviceChannelDataSource'];

type ApiPageDeviceChannelDataSource = components['schemas']['DashboardPageDeviceChannelDataSource'];
type ApiCardDeviceChannelDataSource = components['schemas']['DashboardCardDeviceChannelDataSource'];
type ApiTileDeviceChannelDataSource = components['schemas']['DashboardTileDeviceChannelDataSource'];

// STORE STATE
// ===========

export const DataSourceBaseSchema = z.object({
	id: ItemIdSchema,
	type: z.string().trim().nonempty(),
	draft: z.boolean().default(false),
	createdAt: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
	updatedAt: z
		.union([z.string().datetime({ offset: true }), z.date()])
		.transform((date) => (date instanceof Date ? date : new Date(date)))
		.nullable()
		.default(null),
});

export const DeviceChannelDataSourceSchema = DataSourceBaseSchema.extend({
	device: ItemIdSchema,
	channel: ItemIdSchema,
	property: ItemIdSchema,
	icon: z
		.string()
		.trim()
		.transform((val) => (val === '' ? null : val))
		.nullable(),
});

export const PageDeviceChannelDataSourceSchema = DeviceChannelDataSourceSchema.extend({
	page: ItemIdSchema,
});

export const CardDeviceChannelDataSourceSchema = DeviceChannelDataSourceSchema.extend({
	card: ItemIdSchema,
});

export const TileDeviceChannelDataSourceSchema = DeviceChannelDataSourceSchema.extend({
	tile: ItemIdSchema,
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

export const PageDataSourcesSetActionPayloadSchema = z.object({
	id: ItemIdSchema,
	parent: z.literal('page'),
	pageId: ItemIdSchema,
	data: z
		.object({
			type: z.string().trim().nonempty(),
		})
		.passthrough(),
});

export const CardDataSourcesSetActionPayloadSchema = z.object({
	id: ItemIdSchema,
	parent: z.literal('card'),
	pageId: ItemIdSchema,
	cardId: ItemIdSchema,
	data: z
		.object({
			type: z.string().trim().nonempty(),
		})
		.passthrough(),
});

export const TileDataSourcesSetActionPayloadSchema = z.object({
	id: ItemIdSchema,
	parent: z.literal('tile'),
	pageId: ItemIdSchema,
	cardId: ItemIdSchema.optional(),
	tileId: ItemIdSchema,
	data: z
		.object({
			type: z.string().trim().nonempty(),
		})
		.passthrough(),
});

export const PageDataSourcesUnsetActionPayloadSchema = z.object({
	id: ItemIdSchema.optional(),
	parent: z.literal('page'),
	pageId: ItemIdSchema,
});

export const CardDataSourcesUnsetActionPayloadSchema = z.object({
	id: ItemIdSchema.optional(),
	parent: z.literal('card'),
	pageId: ItemIdSchema,
	cardId: ItemIdSchema,
});

export const TileDataSourcesUnsetActionPayloadSchema = z.object({
	id: ItemIdSchema.optional(),
	parent: z.literal('tile'),
	pageId: ItemIdSchema,
	cardId: ItemIdSchema.optional(),
	tileId: ItemIdSchema,
});

export const PageDataSourcesGetActionPayloadSchema = z.object({
	id: ItemIdSchema,
	parent: z.literal('page'),
	pageId: ItemIdSchema,
});

export const CardDataSourcesGetActionPayloadSchema = z.object({
	id: ItemIdSchema,
	parent: z.literal('card'),
	pageId: ItemIdSchema,
	cardId: ItemIdSchema,
});

export const TileDataSourcesGetActionPayloadSchema = z.object({
	id: ItemIdSchema,
	parent: z.literal('tile'),
	pageId: ItemIdSchema,
	cardId: ItemIdSchema.optional(),
	tileId: ItemIdSchema,
});

export const PageDataSourcesFetchActionPayloadSchema = z.object({
	parent: z.literal('page'),
	pageId: ItemIdSchema,
});

export const CardDataSourcesFetchActionPayloadSchema = z.object({
	parent: z.literal('card'),
	pageId: ItemIdSchema,
	cardId: ItemIdSchema,
});

export const TileDataSourcesFetchActionPayloadSchema = z.object({
	parent: z.literal('tile'),
	pageId: ItemIdSchema,
	cardId: ItemIdSchema.optional(),
	tileId: ItemIdSchema,
});

export const PageDataSourcesAddActionPayloadSchema = z.object({
	id: ItemIdSchema.optional().default(uuid()),
	parent: z.literal('page'),
	pageId: ItemIdSchema,
	draft: z.boolean().optional().default(false),
	data: z
		.object({
			type: z.string().trim().nonempty(),
		})
		.passthrough(),
});

export const CardDataSourcesAddActionPayloadSchema = z.object({
	id: ItemIdSchema.optional().default(uuid()),
	parent: z.literal('card'),
	pageId: ItemIdSchema,
	cardId: ItemIdSchema,
	draft: z.boolean().optional().default(false),
	data: z
		.object({
			type: z.string().trim().nonempty(),
		})
		.passthrough(),
});

export const TileDataSourcesAddActionPayloadSchema = z.object({
	id: ItemIdSchema.optional().default(uuid()),
	parent: z.literal('tile'),
	pageId: ItemIdSchema,
	cardId: ItemIdSchema.optional(),
	tileId: ItemIdSchema,
	draft: z.boolean().optional().default(false),
	data: z
		.object({
			type: z.string().trim().nonempty(),
		})
		.passthrough(),
});

export const PageDataSourcesEditActionPayloadSchema = z.object({
	id: ItemIdSchema,
	parent: z.literal('page'),
	pageId: ItemIdSchema,
	data: z
		.object({
			type: z.string().trim().optional(),
		})
		.passthrough(),
});

export const CardDataSourcesEditActionPayloadSchema = z.object({
	id: ItemIdSchema,
	parent: z.literal('card'),
	pageId: ItemIdSchema,
	cardId: ItemIdSchema,
	data: z
		.object({
			type: z.string().trim().optional(),
		})
		.passthrough(),
});

export const TileDataSourcesEditActionPayloadSchema = z.object({
	id: ItemIdSchema,
	parent: z.literal('tile'),
	pageId: ItemIdSchema,
	cardId: ItemIdSchema.optional(),
	tileId: ItemIdSchema,
	data: z
		.object({
			type: z.string().trim().optional(),
		})
		.passthrough(),
});

export const PageDataSourcesSaveActionPayloadSchema = z.object({
	id: ItemIdSchema,
	parent: z.literal('page'),
	pageId: ItemIdSchema,
});

export const CardDataSourcesSaveActionPayloadSchema = z.object({
	id: ItemIdSchema,
	parent: z.literal('card'),
	pageId: ItemIdSchema,
	cardId: ItemIdSchema,
});

export const TileDataSourcesSaveActionPayloadSchema = z.object({
	id: ItemIdSchema,
	parent: z.literal('tile'),
	pageId: ItemIdSchema,
	cardId: ItemIdSchema.optional(),
	tileId: ItemIdSchema,
});

export const PageDataSourcesRemoveActionPayloadSchema = z.object({
	id: ItemIdSchema,
	parent: z.literal('page'),
	pageId: ItemIdSchema,
});

export const CardDataSourcesRemoveActionPayloadSchema = z.object({
	id: ItemIdSchema,
	parent: z.literal('card'),
	pageId: ItemIdSchema,
	cardId: ItemIdSchema,
});

export const TileDataSourcesRemoveActionPayloadSchema = z.object({
	id: ItemIdSchema,
	parent: z.literal('tile'),
	pageId: ItemIdSchema,
	cardId: ItemIdSchema.optional(),
	tileId: ItemIdSchema,
});

// BACKEND API
// ===========

export const DataSourceCreateBaseReqSchema: ZodType<ApiCreateDataSourceBase> = z.object({
	id: z.string().uuid().optional(),
	type: z.string().trim().nonempty(),
});

export const DeviceChannelDataSourceCreateReqSchema: ZodType<ApiCreateDeviceChannelDataSource> = DataSourceCreateBaseReqSchema.and(
	z.object({
		type: z.nativeEnum(DashboardDeviceChannelDataSourceType),
		device: z.string().uuid(),
		channel: z.string().uuid(),
		property: z.string().uuid(),
		icon: z
			.string()
			.trim()
			.transform((val) => (val === '' ? null : val))
			.nullable()
			.optional(),
	})
);

export const DataSourceUpdateBaseReqSchema: ZodType<ApiUpdateDataSourceBase> = z.object({
	type: z.string().trim().nonempty(),
});

export const DeviceChannelDataSourceUpdateReqSchema: ZodType<ApiUpdateDeviceChannelDataSource> = DataSourceUpdateBaseReqSchema.and(
	z.object({
		type: z.nativeEnum(DashboardDeviceChannelDataSourceType),
		device: z.string().uuid().optional(),
		channel: z.string().uuid().optional(),
		property: z.string().uuid().optional(),
		icon: z
			.string()
			.trim()
			.transform((val) => (val === '' ? null : val))
			.nullable()
			.optional(),
	})
);

export const DataSourceResSchema: ZodType<ApiDataSourceBase> = z.object({
	id: z.string().uuid(),
	type: z.string().trim().nonempty(),
	created_at: z.string(),
	updated_at: z.string().nullable(),
});

export const DeviceChannelDataSourceResSchema: ZodType<ApiDeviceChannelDataSource> = DataSourceResSchema.and(
	z.object({
		type: z.nativeEnum(DashboardDeviceChannelDataSourceType),
		device: z.string().uuid(),
		channel: z.string().uuid(),
		property: z.string().uuid(),
		icon: z.string().nullable(),
	})
);

export const PageDeviceChannelDataSourceResSchema: ZodType<ApiPageDeviceChannelDataSource> = DeviceChannelDataSourceResSchema.and(
	z.object({
		page: z.string().uuid(),
	})
);

export const CardDeviceChannelDataSourceResSchema: ZodType<ApiCardDeviceChannelDataSource> = DeviceChannelDataSourceResSchema.and(
	z.object({
		card: z.string().uuid(),
	})
);

export const TileDeviceChannelDataSourceResSchema: ZodType<ApiTileDeviceChannelDataSource> = DeviceChannelDataSourceResSchema.and(
	z.object({
		tile: z.string().uuid(),
	})
);

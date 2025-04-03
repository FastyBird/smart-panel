import type { Ref } from 'vue';

import type { Store } from 'pinia';

import { v4 as uuid } from 'uuid';
import { type ZodType, z } from 'zod';

import { DashboardDeviceChannelDataSourceType, type components } from '../../../openapi';

import type { ICard } from './cards.store.types';
import type { IPage } from './pages.store.types';
import type { ITile } from './tiles.store.types';
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
export type IDataSourceBase = z.infer<typeof DataSourceBaseSchema>;

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
export type IDeviceChannelDataSource = z.infer<typeof DeviceChannelDataSourceSchema>;

export const PageDeviceChannelDataSourceSchema = DeviceChannelDataSourceSchema.extend({
	page: ItemIdSchema,
});
export type IPageDeviceChannelDataSource = z.infer<typeof PageDeviceChannelDataSourceSchema>;

export const CardDeviceChannelDataSourceSchema = DeviceChannelDataSourceSchema.extend({
	card: ItemIdSchema,
});
export type ICardDeviceChannelDataSource = z.infer<typeof CardDeviceChannelDataSourceSchema>;

export const TileDeviceChannelDataSourceSchema = DeviceChannelDataSourceSchema.extend({
	tile: ItemIdSchema,
});
export type ITileDeviceChannelDataSource = z.infer<typeof TileDeviceChannelDataSourceSchema>;

export const DataSourcesStateSemaphoreSchema = z.object({
	fetching: z.object({
		items: z.array(ItemIdSchema).default([]),
		item: z.array(ItemIdSchema),
	}),
	creating: z.array(ItemIdSchema),
	updating: z.array(ItemIdSchema),
	deleting: z.array(ItemIdSchema),
});
export type IDataSourcesStateSemaphore = z.infer<typeof DataSourcesStateSemaphoreSchema>;

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
export type IPageDataSourcesSetActionPayload = z.infer<typeof PageDataSourcesSetActionPayloadSchema>;

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
export type ICardDataSourcesSetActionPayload = z.infer<typeof CardDataSourcesSetActionPayloadSchema>;

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
export type ITileDataSourcesSetActionPayload = z.infer<typeof TileDataSourcesSetActionPayloadSchema>;

export type IDataSourcesSetActionPayload = IPageDataSourcesSetActionPayload | ICardDataSourcesSetActionPayload | ITileDataSourcesSetActionPayload;

export const PageDataSourcesUnsetActionPayloadSchema = z.object({
	id: ItemIdSchema.optional(),
	parent: z.literal('page'),
	pageId: ItemIdSchema,
});
export type IPageDataSourcesUnsetActionPayload = z.infer<typeof PageDataSourcesUnsetActionPayloadSchema>;

export const CardDataSourcesUnsetActionPayloadSchema = z.object({
	id: ItemIdSchema.optional(),
	parent: z.literal('card'),
	pageId: ItemIdSchema,
	cardId: ItemIdSchema,
});
export type ICardDataSourcesUnsetActionPayload = z.infer<typeof CardDataSourcesUnsetActionPayloadSchema>;

export const TileDataSourcesUnsetActionPayloadSchema = z.object({
	id: ItemIdSchema.optional(),
	parent: z.literal('tile'),
	pageId: ItemIdSchema,
	cardId: ItemIdSchema.optional(),
	tileId: ItemIdSchema,
});
export type ITileDataSourcesUnsetActionPayload = z.infer<typeof TileDataSourcesUnsetActionPayloadSchema>;

export type IDataSourcesUnsetActionPayload =
	| IPageDataSourcesUnsetActionPayload
	| ICardDataSourcesUnsetActionPayload
	| ITileDataSourcesUnsetActionPayload;

export const PageDataSourcesGetActionPayloadSchema = z.object({
	id: ItemIdSchema,
	parent: z.literal('page'),
	pageId: ItemIdSchema,
});
export type IPageDataSourcesGetActionPayload = z.infer<typeof PageDataSourcesGetActionPayloadSchema>;

export const CardDataSourcesGetActionPayloadSchema = z.object({
	id: ItemIdSchema,
	parent: z.literal('card'),
	pageId: ItemIdSchema,
	cardId: ItemIdSchema,
});
export type ICardDataSourcesGetActionPayload = z.infer<typeof CardDataSourcesGetActionPayloadSchema>;

export const TileDataSourcesGetActionPayloadSchema = z.object({
	id: ItemIdSchema,
	parent: z.literal('tile'),
	pageId: ItemIdSchema,
	cardId: ItemIdSchema.optional(),
	tileId: ItemIdSchema,
});
export type ITileDataSourcesGetActionPayload = z.infer<typeof TileDataSourcesGetActionPayloadSchema>;

export type IDataSourcesGetActionPayload = IPageDataSourcesGetActionPayload | ICardDataSourcesGetActionPayload | ITileDataSourcesGetActionPayload;

export const PageDataSourcesFetchActionPayloadSchema = z.object({
	parent: z.literal('page'),
	pageId: ItemIdSchema,
});
export type IPageDataSourcesFetchActionPayload = z.infer<typeof PageDataSourcesFetchActionPayloadSchema>;

export const CardDataSourcesFetchActionPayloadSchema = z.object({
	parent: z.literal('card'),
	pageId: ItemIdSchema,
	cardId: ItemIdSchema,
});
export type ICardDataSourcesFetchActionPayload = z.infer<typeof CardDataSourcesFetchActionPayloadSchema>;

export const TileDataSourcesFetchActionPayloadSchema = z.object({
	parent: z.literal('tile'),
	pageId: ItemIdSchema,
	cardId: ItemIdSchema.optional(),
	tileId: ItemIdSchema,
});
export type ITileDataSourcesFetchActionPayload = z.infer<typeof TileDataSourcesFetchActionPayloadSchema>;

export type IDataSourcesFetchActionPayload =
	| IPageDataSourcesFetchActionPayload
	| ICardDataSourcesFetchActionPayload
	| ITileDataSourcesFetchActionPayload;

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
export type IPageDataSourcesAddActionPayload = z.infer<typeof PageDataSourcesAddActionPayloadSchema>;

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
export type ICardDataSourcesAddActionPayload = z.infer<typeof CardDataSourcesAddActionPayloadSchema>;

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
export type ITileDataSourcesAddActionPayload = z.infer<typeof TileDataSourcesAddActionPayloadSchema>;

export type IDataSourcesAddActionPayload = IPageDataSourcesAddActionPayload | ICardDataSourcesAddActionPayload | ITileDataSourcesAddActionPayload;

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
export type IPageDataSourcesEditActionPayload = z.infer<typeof PageDataSourcesEditActionPayloadSchema>;

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
export type ICardDataSourcesEditActionPayload = z.infer<typeof CardDataSourcesEditActionPayloadSchema>;

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
export type ITileDataSourcesEditActionPayload = z.infer<typeof TileDataSourcesEditActionPayloadSchema>;

export type IDataSourcesEditActionPayload = IPageDataSourcesEditActionPayload | ICardDataSourcesEditActionPayload | ITileDataSourcesEditActionPayload;

export const PageDataSourcesSaveActionPayloadSchema = z.object({
	id: ItemIdSchema,
	parent: z.literal('page'),
	pageId: ItemIdSchema,
});
export type IPageDataSourcesSaveActionPayload = z.infer<typeof PageDataSourcesSaveActionPayloadSchema>;

export const CardDataSourcesSaveActionPayloadSchema = z.object({
	id: ItemIdSchema,
	parent: z.literal('card'),
	pageId: ItemIdSchema,
	cardId: ItemIdSchema,
});
export type ICardDataSourcesSaveActionPayload = z.infer<typeof CardDataSourcesSaveActionPayloadSchema>;

export const TileDataSourcesSaveActionPayloadSchema = z.object({
	id: ItemIdSchema,
	parent: z.literal('tile'),
	pageId: ItemIdSchema,
	cardId: ItemIdSchema.optional(),
	tileId: ItemIdSchema,
});
export type ITileDataSourcesSaveActionPayload = z.infer<typeof TileDataSourcesSaveActionPayloadSchema>;

export type IDataSourcesSaveActionPayload = IPageDataSourcesSaveActionPayload | ICardDataSourcesSaveActionPayload | ITileDataSourcesSaveActionPayload;

export const PageDataSourcesRemoveActionPayloadSchema = z.object({
	id: ItemIdSchema,
	parent: z.literal('page'),
	pageId: ItemIdSchema,
});
export type IPageDataSourcesRemoveActionPayload = z.infer<typeof PageDataSourcesRemoveActionPayloadSchema>;

export const CardDataSourcesRemoveActionPayloadSchema = z.object({
	id: ItemIdSchema,
	parent: z.literal('card'),
	pageId: ItemIdSchema,
	cardId: ItemIdSchema,
});
export type ICardDataSourcesRemoveActionPayload = z.infer<typeof CardDataSourcesRemoveActionPayloadSchema>;

export const TileDataSourcesRemoveActionPayloadSchema = z.object({
	id: ItemIdSchema,
	parent: z.literal('tile'),
	pageId: ItemIdSchema,
	cardId: ItemIdSchema.optional(),
	tileId: ItemIdSchema,
});
export type ITileDataSourcesRemoveActionPayload = z.infer<typeof TileDataSourcesRemoveActionPayloadSchema>;

export type IDataSourcesRemoveActionPayload =
	| IPageDataSourcesRemoveActionPayload
	| ICardDataSourcesRemoveActionPayload
	| ITileDataSourcesRemoveActionPayload;

// STORE
// =====

export interface IDataSourcesStoreState {
	data: Ref<{ [key: IDataSourceBase['id']]: IDataSourceBase }>;
	semaphore: Ref<IDataSourcesStateSemaphore>;
	firstLoad: Ref<(IPage['id'] | ICard['id'] | ITile['id'])[]>;
}

export interface IDataSourcesStoreActions {
	// Getters
	firstLoadFinished: (parentId: IPage['id'] | ICard['id'] | ITile['id']) => boolean;
	getting: (id: IDataSourceBase['id']) => boolean;
	fetching: (parentId: IPage['id'] | ICard['id'] | ITile['id']) => boolean;
	findById: (parent: DataSourceParentType, id: IDataSourceBase['id']) => IDataSourceBase | null;
	findForParent: (parent: DataSourceParentType, parentId: IPage['id'] | ICard['id'] | ITile['id']) => IDataSourceBase[];
	findAll: (parent: DataSourceParentType) => IDataSourceBase[];
	// Actions
	set: (payload: IDataSourcesSetActionPayload) => IDataSourceBase;
	unset: (payload: IDataSourcesUnsetActionPayload) => void;
	get: (payload: IDataSourcesGetActionPayload) => Promise<IDataSourceBase>;
	fetch: (payload: IDataSourcesFetchActionPayload) => Promise<IDataSourceBase[]>;
	add: (payload: IDataSourcesAddActionPayload) => Promise<IDataSourceBase>;
	edit: (payload: IDataSourcesEditActionPayload) => Promise<IDataSourceBase>;
	save: (payload: IDataSourcesSaveActionPayload) => Promise<IDataSourceBase>;
	remove: (payload: IDataSourcesRemoveActionPayload) => Promise<boolean>;
}

export type DataSourcesStoreSetup = IDataSourcesStoreState & IDataSourcesStoreActions;

// BACKEND API
// ===========

export const DataSourceCreateBaseReqSchema: ZodType<ApiCreateDataSourceBase> = z.object({
	id: z.string().uuid().optional(),
	type: z.string().trim().nonempty(),
});
export type IDataSourceCreateBaseReq = z.infer<typeof DataSourceCreateBaseReqSchema>;

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
export type IDeviceChannelDataSourceCreateReq = z.infer<typeof DeviceChannelDataSourceCreateReqSchema>;

export type IDataSourceCreateReq = IDeviceChannelDataSourceCreateReq;

export const DataSourceUpdateBaseReqSchema: ZodType<ApiUpdateDataSourceBase> = z.object({
	type: z.string().trim().nonempty(),
});
export type IDataSourceUpdateBaseReq = z.infer<typeof DataSourceUpdateBaseReqSchema>;

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
export type IDeviceChannelDataSourceUpdateReq = z.infer<typeof DeviceChannelDataSourceUpdateReqSchema>;

export type IDataSourceUpdateReq = IDeviceChannelDataSourceUpdateReq;

export const DataSourceResSchema: ZodType<ApiDataSourceBase> = z.object({
	id: z.string().uuid(),
	type: z.string().trim().nonempty(),
	created_at: z.string(),
	updated_at: z.string().nullable(),
});
export type IDataSourceRes = z.infer<typeof DataSourceResSchema>;

export const DeviceChannelDataSourceResSchema: ZodType<ApiDeviceChannelDataSource> = DataSourceResSchema.and(
	z.object({
		type: z.nativeEnum(DashboardDeviceChannelDataSourceType),
		device: z.string().uuid(),
		channel: z.string().uuid(),
		property: z.string().uuid(),
		icon: z.string().nullable(),
	})
);
export type IDeviceChannelDataSourceRes = z.infer<typeof DeviceChannelDataSourceResSchema>;

export const PageDeviceChannelDataSourceResSchema: ZodType<ApiPageDeviceChannelDataSource> = DeviceChannelDataSourceResSchema.and(
	z.object({
		page: z.string().uuid(),
	})
);
export type IPageDeviceChannelDataSourceRes = z.infer<typeof PageDeviceChannelDataSourceResSchema>;

export const CardDeviceChannelDataSourceResSchema: ZodType<ApiCardDeviceChannelDataSource> = DeviceChannelDataSourceResSchema.and(
	z.object({
		card: z.string().uuid(),
	})
);
export type ICardDeviceChannelDataSourceRes = z.infer<typeof CardDeviceChannelDataSourceResSchema>;

export const TileDeviceChannelDataSourceResSchema: ZodType<ApiTileDeviceChannelDataSource> = DeviceChannelDataSourceResSchema.and(
	z.object({
		tile: z.string().uuid(),
	})
);
export type ITileDeviceChannelDataSourceRes = z.infer<typeof TileDeviceChannelDataSourceResSchema>;

// STORE
export type DataSourcesStore = Store<string, IDataSourcesStoreState, object, IDataSourcesStoreActions>;

// MISC
export type DataSourceParentType = 'page' | 'card' | 'tile';

export type DataSourceParentTypeMap = {
	page: IPageDeviceChannelDataSource;
	card: ICardDeviceChannelDataSource;
	tile: ITileDeviceChannelDataSource;
};

export type IDataSourcesEntitiesSchemas = {
	dataSource: typeof DataSourceBaseSchema;
	createDataSourceReq: typeof DataSourceCreateBaseReqSchema;
	updateDataSourceReq: typeof DataSourceUpdateBaseReqSchema;
};

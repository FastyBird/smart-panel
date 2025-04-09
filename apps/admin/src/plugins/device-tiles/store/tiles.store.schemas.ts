import { type ZodType, z } from 'zod';

import { ItemIdSchema, TileCreateReqSchema, TileResSchema, TileSchema, TileUpdateReqSchema } from '../../../modules/dashboard';
import { DashboardDevicePreviewTileType, type components } from '../../../openapi';

type ApiCreateDevicePreviewTile = components['schemas']['DashboardCreateDevicePreviewTile'];
type ApiUpdateDevicePreviewTile = components['schemas']['DashboardUpdateDevicePreviewTile'];
type ApiDevicePreviewTile = components['schemas']['DashboardDevicePreviewTile'];

// STORE STATE
// ===========

export const DevicePreviewTileSchema = TileSchema.extend({
	device: ItemIdSchema,
	icon: z.string().trim().nullable().default(null),
});

// BACKEND API
// ===========

export const DevicePreviewTileCreateReqSchema: ZodType<ApiCreateDevicePreviewTile> = TileCreateReqSchema.and(
	z.object({
		type: z.nativeEnum(DashboardDevicePreviewTileType),
		device: z.string().uuid(),
		icon: z.string().trim().nullable(),
	})
);

export const DevicePreviewTileUpdateReqSchema: ZodType<ApiUpdateDevicePreviewTile> = TileUpdateReqSchema.and(
	z.object({
		type: z.nativeEnum(DashboardDevicePreviewTileType),
		device: z.string().uuid().optional(),
		icon: z.string().trim().nullable().optional(),
	})
);

export const DevicePreviewTileResSchema: ZodType<ApiDevicePreviewTile> = TileResSchema.and(
	z.object({
		type: z.nativeEnum(DashboardDevicePreviewTileType),
		device: z.string().uuid(),
		icon: z.string().trim().nullable(),
	})
);

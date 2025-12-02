import { type ZodType, z } from 'zod';

import { ItemIdSchema, TileCreateReqSchema, TileResSchema, TileSchema, TileUpdateReqSchema } from '../../../modules/dashboard';
import { type components } from '../../../openapi.constants';
import { TILES_DEVICE_PREVIEW_TYPE } from '../tiles-device-preview.constants';

type ApiCreateDevicePreviewTile = components['schemas']['TilesDevicePreviewPluginCreateDevicePreviewTile'];
type ApiUpdateDevicePreviewTile = components['schemas']['TilesDevicePreviewPluginUpdateDevicePreviewTile'];
type ApiDevicePreviewTile = components['schemas']['TilesDevicePreviewPluginDataDevicePreviewTile'];

// STORE STATE
// ===========

export const DevicePreviewTileSchema = TileSchema.extend({
	device: ItemIdSchema,
	icon: z.string().trim().nullable().default(null),
});

// BACKEND API
// ===========

export const DevicePreviewTileCreateReqSchema: ZodType<ApiCreateDevicePreviewTile & { parent: { type: string; id: string } }> =
	TileCreateReqSchema.and(
		z.object({
			type: z.literal(TILES_DEVICE_PREVIEW_TYPE),
			device: z.string().uuid(),
			icon: z.string().trim().nullable(),
		})
	);

export const DevicePreviewTileUpdateReqSchema: ZodType<ApiUpdateDevicePreviewTile & { parent: { type: string; id: string } }> =
	TileUpdateReqSchema.and(
		z.object({
			type: z.literal(TILES_DEVICE_PREVIEW_TYPE),
			device: z.string().uuid().optional(),
			icon: z.string().trim().nullable().optional(),
		})
	);

export const DevicePreviewTileResSchema: ZodType<ApiDevicePreviewTile> = TileResSchema.and(
	z.object({
		type: z.literal(TILES_DEVICE_PREVIEW_TYPE),
		device: z.string().uuid(),
		icon: z.string().trim().nullable(),
	})
);

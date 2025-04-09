import { z } from 'zod';

import {
	DevicePreviewTileCreateReqSchema,
	DevicePreviewTileResSchema,
	DevicePreviewTileSchema,
	DevicePreviewTileUpdateReqSchema,
} from './tiles.store.schemas';

// STORE STATE
// ===========

export type IDevicePreviewTile = z.infer<typeof DevicePreviewTileSchema>;

// BACKEND API
// ===========

export type IDevicePreviewTileCreateReq = z.infer<typeof DevicePreviewTileCreateReqSchema>;

export type IDevicePreviewTileUpdateReq = z.infer<typeof DevicePreviewTileUpdateReqSchema>;

export type IDevicePreviewTileRes = z.infer<typeof DevicePreviewTileResSchema>;

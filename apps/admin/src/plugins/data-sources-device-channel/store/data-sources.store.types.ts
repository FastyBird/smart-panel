import { z } from 'zod';

import {
	DeviceChannelDataSourceCreateReqSchema,
	DeviceChannelDataSourceResSchema,
	DeviceChannelDataSourceSchema,
	DeviceChannelDataSourceUpdateReqSchema,
} from './data-sources.store.schemas';

// STORE STATE
// ===========

export type IDeviceChannelDataSource = z.infer<typeof DeviceChannelDataSourceSchema>;

// BACKEND API
// ===========

export type IDeviceChannelDataSourceCreateReq = z.infer<typeof DeviceChannelDataSourceCreateReqSchema>;

export type IDeviceChannelDataSourceUpdateReq = z.infer<typeof DeviceChannelDataSourceUpdateReqSchema>;

export type IDeviceChannelDataSourceRes = z.infer<typeof DeviceChannelDataSourceResSchema>;

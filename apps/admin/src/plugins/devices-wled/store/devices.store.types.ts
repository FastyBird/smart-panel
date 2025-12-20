import { z } from 'zod';

import {
	WledDeviceCreateReqSchema,
	WledDeviceResSchema,
	type WledDeviceSchema,
	WledDeviceUpdateReqSchema,
} from './devices.store.schemas';

export type IWledDevice = z.infer<typeof WledDeviceSchema>;

// BACKEND API
// ===========

export type IWledDeviceCreateReq = z.infer<typeof WledDeviceCreateReqSchema>;

export type IWledDeviceUpdateReq = z.infer<typeof WledDeviceUpdateReqSchema>;

export type IWledDeviceRes = z.infer<typeof WledDeviceResSchema>;

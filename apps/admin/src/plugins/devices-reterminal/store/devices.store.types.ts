import { z } from 'zod';

import {
	ReTerminalDeviceCreateReqSchema,
	ReTerminalDeviceResSchema,
	type ReTerminalDeviceSchema,
	ReTerminalDeviceUpdateReqSchema,
} from './devices.store.schemas';

export type IReTerminalDevice = z.infer<typeof ReTerminalDeviceSchema>;

// BACKEND API
// ===========

export type IReTerminalDeviceCreateReq = z.infer<typeof ReTerminalDeviceCreateReqSchema>;

export type IReTerminalDeviceUpdateReq = z.infer<typeof ReTerminalDeviceUpdateReqSchema>;

export type IReTerminalDeviceRes = z.infer<typeof ReTerminalDeviceResSchema>;

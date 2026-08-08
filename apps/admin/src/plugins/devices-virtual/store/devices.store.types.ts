import { z } from 'zod';

import type { VirtualDeviceSchema } from './devices.store.schemas';
import { VirtualDeviceCreateReqSchema, VirtualDeviceResSchema, VirtualDeviceUpdateReqSchema } from './devices.store.schemas';

export type IVirtualDevice = z.infer<typeof VirtualDeviceSchema>;

// BACKEND API
// ===========

export type IVirtualDeviceCreateReq = z.infer<typeof VirtualDeviceCreateReqSchema>;

export type IVirtualDeviceUpdateReq = z.infer<typeof VirtualDeviceUpdateReqSchema>;

export type IVirtualDeviceRes = z.infer<typeof VirtualDeviceResSchema>;

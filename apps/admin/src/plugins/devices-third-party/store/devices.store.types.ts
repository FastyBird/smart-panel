import { z } from 'zod';

import type { ThirdPartyDeviceSchema } from './devices.store.schemas';
import { ThirdPartyDeviceCreateReqSchema, ThirdPartyDeviceResSchema, ThirdPartyDeviceUpdateReqSchema } from './devices.store.schemas';

export type IThirdPartyDevice = z.infer<typeof ThirdPartyDeviceSchema>;

// BACKEND API
// ===========

export type IThirdPartyDeviceCreateReq = z.infer<typeof ThirdPartyDeviceCreateReqSchema>;

export type IThirdPartyDeviceUpdateReq = z.infer<typeof ThirdPartyDeviceUpdateReqSchema>;

export type IThirdPartyDeviceRes = z.infer<typeof ThirdPartyDeviceResSchema>;

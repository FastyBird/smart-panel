import { z } from 'zod';

import {
	ShellyNgDeviceCreateReqSchema,
	ShellyNgDeviceResSchema,
	type ShellyNgDeviceSchema,
	ShellyNgDeviceUpdateReqSchema,
} from './devices.store.schemas';

export type IShellyNgDevice = z.infer<typeof ShellyNgDeviceSchema>;

// BACKEND API
// ===========

export type IShellyNgDeviceCreateReq = z.infer<typeof ShellyNgDeviceCreateReqSchema>;

export type IShellyNgDeviceUpdateReq = z.infer<typeof ShellyNgDeviceUpdateReqSchema>;

export type IShellyNgDeviceRes = z.infer<typeof ShellyNgDeviceResSchema>;

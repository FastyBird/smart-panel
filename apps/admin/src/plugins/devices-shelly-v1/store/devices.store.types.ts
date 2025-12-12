import { z } from 'zod';

import {
	ShellyV1DeviceCreateReqSchema,
	ShellyV1DeviceResSchema,
	type ShellyV1DeviceSchema,
	ShellyV1DeviceUpdateReqSchema,
} from './devices.store.schemas';

export type IShellyV1Device = z.infer<typeof ShellyV1DeviceSchema>;

// BACKEND API
// ===========

export type IShellyV1DeviceCreateReq = z.infer<typeof ShellyV1DeviceCreateReqSchema>;

export type IShellyV1DeviceUpdateReq = z.infer<typeof ShellyV1DeviceUpdateReqSchema>;

export type IShellyV1DeviceRes = z.infer<typeof ShellyV1DeviceResSchema>;

import { z } from 'zod';

import {
	HomeAssistantDeviceCreateReqSchema,
	HomeAssistantDeviceResSchema,
	type HomeAssistantDeviceSchema,
	HomeAssistantDeviceUpdateReqSchema,
} from './devices.store.schemas';

export type IHomeAssistantDevice = z.infer<typeof HomeAssistantDeviceSchema>;

// BACKEND API
// ===========

export type IHomeAssistantDeviceCreateReq = z.infer<typeof HomeAssistantDeviceCreateReqSchema>;

export type IHomeAssistantDeviceUpdateReq = z.infer<typeof HomeAssistantDeviceUpdateReqSchema>;

export type IHomeAssistantDeviceRes = z.infer<typeof HomeAssistantDeviceResSchema>;

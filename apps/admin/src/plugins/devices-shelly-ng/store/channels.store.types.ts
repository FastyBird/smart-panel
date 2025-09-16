import { z } from 'zod';

import {
	ShellyNgChannelCreateReqSchema,
	ShellyNgChannelResSchema,
	type ShellyNgChannelSchema,
	ShellyNgChannelUpdateReqSchema,
} from './channels.store.schemas';

export type IShellyNgChannel = z.infer<typeof ShellyNgChannelSchema>;

// BACKEND API
// ===========

export type IShellyNgChannelCreateReq = z.infer<typeof ShellyNgChannelCreateReqSchema>;

export type IShellyNgChannelUpdateReq = z.infer<typeof ShellyNgChannelUpdateReqSchema>;

export type IShellyNgChannelRes = z.infer<typeof ShellyNgChannelResSchema>;

import { z } from 'zod';

import {
	ShellyV1ChannelCreateReqSchema,
	ShellyV1ChannelResSchema,
	type ShellyV1ChannelSchema,
	ShellyV1ChannelUpdateReqSchema,
} from './channels.store.schemas';

export type IShellyV1Channel = z.infer<typeof ShellyV1ChannelSchema>;

// BACKEND API
// ===========

export type IShellyV1ChannelCreateReq = z.infer<typeof ShellyV1ChannelCreateReqSchema>;

export type IShellyV1ChannelUpdateReq = z.infer<typeof ShellyV1ChannelUpdateReqSchema>;

export type IShellyV1ChannelRes = z.infer<typeof ShellyV1ChannelResSchema>;

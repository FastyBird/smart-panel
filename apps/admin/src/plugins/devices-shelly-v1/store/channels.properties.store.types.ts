import { z } from 'zod';

import {
	ShellyV1ChannelPropertyCreateReqSchema,
	ShellyV1ChannelPropertyResSchema,
	type ShellyV1ChannelPropertySchema,
	ShellyV1ChannelPropertyUpdateReqSchema,
} from './channels.properties.store.schemas';

export type IShellyV1ChannelProperty = z.infer<typeof ShellyV1ChannelPropertySchema>;

// BACKEND API
// ===========

export type IShellyV1ChannelPropertyCreateReq = z.infer<typeof ShellyV1ChannelPropertyCreateReqSchema>;

export type IShellyV1ChannelPropertyUpdateReq = z.infer<typeof ShellyV1ChannelPropertyUpdateReqSchema>;

export type IShellyV1ChannelPropertyRes = z.infer<typeof ShellyV1ChannelPropertyResSchema>;

import { z } from 'zod';

import {
	ShellyNgChannelPropertyCreateReqSchema,
	ShellyNgChannelPropertyResSchema,
	type ShellyNgChannelPropertySchema,
	ShellyNgChannelPropertyUpdateReqSchema,
} from './channels.properties.store.schemas';

export type IShellyNgChannelProperty = z.infer<typeof ShellyNgChannelPropertySchema>;

// BACKEND API
// ===========

export type IShellyNgChannelPropertyCreateReq = z.infer<typeof ShellyNgChannelPropertyCreateReqSchema>;

export type IShellyNgChannelPropertyUpdateReq = z.infer<typeof ShellyNgChannelPropertyUpdateReqSchema>;

export type IShellyNgChannelPropertyRes = z.infer<typeof ShellyNgChannelPropertyResSchema>;

import { z } from 'zod';

import {
	VirtualChannelPropertyCreateReqSchema,
	VirtualChannelPropertyResSchema,
	type VirtualChannelPropertySchema,
	VirtualChannelPropertyUpdateReqSchema,
} from './channels.properties.store.schemas';

export type IVirtualChannelProperty = z.infer<typeof VirtualChannelPropertySchema>;

// BACKEND API
// ===========

export type IVirtualChannelPropertyCreateReq = z.infer<typeof VirtualChannelPropertyCreateReqSchema>;

export type IVirtualChannelPropertyUpdateReq = z.infer<typeof VirtualChannelPropertyUpdateReqSchema>;

export type IVirtualChannelPropertyRes = z.infer<typeof VirtualChannelPropertyResSchema>;

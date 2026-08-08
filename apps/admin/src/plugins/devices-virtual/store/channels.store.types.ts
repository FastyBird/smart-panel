import { z } from 'zod';

import {
	VirtualChannelCreateReqSchema,
	VirtualChannelResSchema,
	type VirtualChannelSchema,
	VirtualChannelUpdateReqSchema,
} from './channels.store.schemas';

export type IVirtualChannel = z.infer<typeof VirtualChannelSchema>;

// BACKEND API
// ===========

export type IVirtualChannelCreateReq = z.infer<typeof VirtualChannelCreateReqSchema>;

export type IVirtualChannelUpdateReq = z.infer<typeof VirtualChannelUpdateReqSchema>;

export type IVirtualChannelRes = z.infer<typeof VirtualChannelResSchema>;

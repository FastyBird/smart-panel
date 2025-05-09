import { z } from 'zod';

import {
	ThirdPartyChannelCreateReqSchema,
	ThirdPartyChannelResSchema,
	type ThirdPartyChannelSchema,
	ThirdPartyChannelUpdateReqSchema,
} from './channels.store.schemas';

export type IThirdPartyChannel = z.infer<typeof ThirdPartyChannelSchema>;

// BACKEND API
// ===========

export type IThirdPartyChannelCreateReq = z.infer<typeof ThirdPartyChannelCreateReqSchema>;

export type IThirdPartyChannelUpdateReq = z.infer<typeof ThirdPartyChannelUpdateReqSchema>;

export type IThirdPartyChannelRes = z.infer<typeof ThirdPartyChannelResSchema>;

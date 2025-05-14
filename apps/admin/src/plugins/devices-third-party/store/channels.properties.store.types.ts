import { z } from 'zod';

import {
	ThirdPartyChannelPropertyCreateReqSchema,
	ThirdPartyChannelPropertyResSchema,
	type ThirdPartyChannelPropertySchema,
	ThirdPartyChannelPropertyUpdateReqSchema,
} from './channels.properties.store.schemas';

export type IThirdPartyChannelProperty = z.infer<typeof ThirdPartyChannelPropertySchema>;

// BACKEND API
// ===========

export type IThirdPartyChannelPropertyCreateReq = z.infer<typeof ThirdPartyChannelPropertyCreateReqSchema>;

export type IThirdPartyChannelPropertyUpdateReq = z.infer<typeof ThirdPartyChannelPropertyUpdateReqSchema>;

export type IThirdPartyChannelPropertyRes = z.infer<typeof ThirdPartyChannelPropertyResSchema>;

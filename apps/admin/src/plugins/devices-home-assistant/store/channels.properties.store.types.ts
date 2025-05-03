import { z } from 'zod';

import {
	HomeAssistantChannelPropertyCreateReqSchema,
	HomeAssistantChannelPropertyResSchema,
	type HomeAssistantChannelPropertySchema,
	HomeAssistantChannelPropertyUpdateReqSchema,
} from './channels.properties.store.schemas';

export type IHomeAssistantChannelProperty = z.infer<typeof HomeAssistantChannelPropertySchema>;

// BACKEND API
// ===========

export type IHomeAssistantChannelPropertyCreateReq = z.infer<typeof HomeAssistantChannelPropertyCreateReqSchema>;

export type IHomeAssistantChannelPropertyUpdateReq = z.infer<typeof HomeAssistantChannelPropertyUpdateReqSchema>;

export type IHomeAssistantChannelPropertyRes = z.infer<typeof HomeAssistantChannelPropertyResSchema>;

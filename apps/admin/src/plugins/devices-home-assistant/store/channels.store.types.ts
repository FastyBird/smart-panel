import { z } from 'zod';

import {
	HomeAssistantChannelCreateReqSchema,
	HomeAssistantChannelResSchema,
	type HomeAssistantChannelSchema,
	HomeAssistantChannelUpdateReqSchema,
} from './channels.store.schemas';

export type IHomeAssistantChannel = z.infer<typeof HomeAssistantChannelSchema>;

// BACKEND API
// ===========

export type IHomeAssistantChannelCreateReq = z.infer<typeof HomeAssistantChannelCreateReqSchema>;

export type IHomeAssistantChannelUpdateReq = z.infer<typeof HomeAssistantChannelUpdateReqSchema>;

export type IHomeAssistantChannelRes = z.infer<typeof HomeAssistantChannelResSchema>;

import { type ZodType, z } from 'zod';

import { ChannelCreateReqSchema, ChannelResSchema, ChannelSchema, ChannelUpdateReqSchema } from '../../../modules/devices';
import type {
	DevicesHomeAssistantPluginCreateChannelSchema,
	DevicesHomeAssistantPluginUpdateChannelSchema,
	DevicesHomeAssistantPluginChannelSchema,
} from '../../../openapi.constants';
import { DEVICES_HOME_ASSISTANT_TYPE } from '../devices-home-assistant.constants';

type ApiCreateChannel = DevicesHomeAssistantPluginCreateChannelSchema;
type ApiUpdateChannel = DevicesHomeAssistantPluginUpdateChannelSchema;
type ApiChannel = DevicesHomeAssistantPluginChannelSchema;

export const HomeAssistantChannelSchema = ChannelSchema;

// BACKEND API
// ===========

export const HomeAssistantChannelCreateReqSchema: ZodType<ApiCreateChannel> = ChannelCreateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_HOME_ASSISTANT_TYPE),
	})
);

export const HomeAssistantChannelUpdateReqSchema: ZodType<ApiUpdateChannel> = ChannelUpdateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_HOME_ASSISTANT_TYPE),
	})
);

export const HomeAssistantChannelResSchema: ZodType<ApiChannel> = ChannelResSchema.and(
	z.object({
		type: z.literal(DEVICES_HOME_ASSISTANT_TYPE),
	})
);

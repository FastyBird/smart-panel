import { type ZodType, z } from 'zod';

import { ChannelCreateReqSchema, ChannelResSchema, ChannelSchema, ChannelUpdateReqSchema } from '../../../modules/devices';
import { type components } from '../../../openapi';
import { DEVICES_HOME_ASSISTANT_TYPE } from '../devices-home-assistant.constants';

type ApiCreateChannel = components['schemas']['DevicesHomeAssistantPluginCreateChannel'];
type ApiUpdateChannel = components['schemas']['DevicesHomeAssistantPluginUpdateChannel'];
type ApiChannel = components['schemas']['DevicesHomeAssistantPluginDataChannel'];

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

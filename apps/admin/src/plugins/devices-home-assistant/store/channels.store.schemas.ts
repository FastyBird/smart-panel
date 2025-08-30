import { type ZodType, z } from 'zod';

import { ChannelCreateReqSchema, ChannelResSchema, ChannelSchema, ChannelUpdateReqSchema } from '../../../modules/devices';
import { type components } from '../../../openapi';
import { DEVICES_HOME_ASSISTANT_TYPE } from '../devices-home-assistant.constants';

type ApiCreateChannel = components['schemas']['DevicesHomeAssistantPluginCreateHomeAssistantChannel'];
type ApiUpdateChannel = components['schemas']['DevicesHomeAssistantPluginUpdateHomeAssistantChannel'];
type ApiChannel = components['schemas']['DevicesHomeAssistantPluginHomeAssistantChannel'];

export const HomeAssistantChannelSchema = ChannelSchema;

// BACKEND API
// ===========

export const HomeAssistantChannelCreateReqSchema: ZodType<ApiCreateChannel> = ChannelCreateReqSchema.and(
	z.object({
		type: z.string().trim().nonempty().default(DEVICES_HOME_ASSISTANT_TYPE),
	})
);

export const HomeAssistantChannelUpdateReqSchema: ZodType<ApiUpdateChannel> = ChannelUpdateReqSchema.and(
	z.object({
		type: z.string().trim().nonempty().default(DEVICES_HOME_ASSISTANT_TYPE),
	})
);

export const HomeAssistantChannelResSchema: ZodType<ApiChannel> = ChannelResSchema.and(
	z.object({
		type: z.string().trim().nonempty().default(DEVICES_HOME_ASSISTANT_TYPE),
	})
);

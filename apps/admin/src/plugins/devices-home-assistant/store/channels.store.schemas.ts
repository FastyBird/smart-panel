import { type ZodType, z } from 'zod';

import { ChannelCreateReqSchema, ChannelResSchema, ChannelSchema, ChannelUpdateReqSchema } from '../../../modules/devices';
import { type components } from '../../../openapi';
import { DEVICES_HOME_ASSISTANT_PLUGIN_TYPE } from '../devices-home-assistant.constants';

type ApiCreateChannel = components['schemas']['DevicesHomeAssistantPluginCreateHomeAssistantChannel'];
type ApiUpdateChannel = components['schemas']['DevicesHomeAssistantPluginUpdateHomeAssistantChannel'];
type ApiChannel = components['schemas']['DevicesHomeAssistantPluginHomeAssistantChannel'];

export const HomeAssistantChannelSchema = ChannelSchema.extend({
	haEntityId: z.string().trim().nonempty(),
});

// BACKEND API
// ===========

export const HomeAssistantChannelCreateReqSchema: ZodType<ApiCreateChannel> = ChannelCreateReqSchema.and(
	z.object({
		type: z.string().trim().nonempty().default(DEVICES_HOME_ASSISTANT_PLUGIN_TYPE),
		ha_entity_id: z.string().trim().nonempty(),
	})
);

export const HomeAssistantChannelUpdateReqSchema: ZodType<ApiUpdateChannel> = ChannelUpdateReqSchema.and(
	z.object({
		type: z.string().trim().nonempty().default(DEVICES_HOME_ASSISTANT_PLUGIN_TYPE),
	})
);

export const HomeAssistantChannelResSchema: ZodType<ApiChannel> = ChannelResSchema.and(
	z.object({
		type: z.string().trim().nonempty().default(DEVICES_HOME_ASSISTANT_PLUGIN_TYPE),
		ha_entity_id: z.string().trim().nonempty(),
	})
);

import { type ZodType, z } from 'zod';

import {
	ChannelPropertyCreateReqSchema,
	ChannelPropertyResSchema,
	ChannelPropertySchema,
	ChannelPropertyUpdateReqSchema,
} from '../../../modules/devices';
import { type components } from '../../../openapi';
import { DEVICES_HOME_ASSISTANT_PLUGIN_TYPE } from '../devices-home-assistant.constants';

type ApiCreateChannelProperty = components['schemas']['DevicesHomeAssistantPluginCreateHomeAssistantChannelProperty'];
type ApiUpdateChannelProperty = components['schemas']['DevicesHomeAssistantPluginUpdateHomeAssistantChannelProperty'];
type ApiChannelProperty = components['schemas']['DevicesHomeAssistantPluginHomeAssistantChannelProperty'];

export const HomeAssistantChannelPropertySchema = ChannelPropertySchema.extend({
	haEntityId: z.string().trim().nonempty(),
	haAttribute: z.string().trim().nonempty(),
});

// BACKEND API
// ===========

export const HomeAssistantChannelPropertyCreateReqSchema: ZodType<ApiCreateChannelProperty> = ChannelPropertyCreateReqSchema.and(
	z.object({
		type: z.string().trim().nonempty().default(DEVICES_HOME_ASSISTANT_PLUGIN_TYPE),
		ha_entity_id: z.string().trim().nonempty(),
		ha_attribute: z.string().trim().nonempty(),
	})
);

export const HomeAssistantChannelPropertyUpdateReqSchema: ZodType<ApiUpdateChannelProperty> = ChannelPropertyUpdateReqSchema.and(
	z.object({
		type: z.string().trim().nonempty().default(DEVICES_HOME_ASSISTANT_PLUGIN_TYPE),
	})
);

export const HomeAssistantChannelPropertyResSchema: ZodType<ApiChannelProperty> = ChannelPropertyResSchema.and(
	z.object({
		type: z.string().trim().nonempty().default(DEVICES_HOME_ASSISTANT_PLUGIN_TYPE),
		ha_entity_id: z.string().trim().nonempty(),
		ha_attribute: z.string().trim().nonempty(),
	})
);

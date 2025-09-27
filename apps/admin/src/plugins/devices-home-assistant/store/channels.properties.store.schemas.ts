import { type ZodType, z } from 'zod';

import {
	ChannelPropertyCreateReqSchema,
	ChannelPropertyResSchema,
	ChannelPropertySchema,
	ChannelPropertyUpdateReqSchema,
} from '../../../modules/devices';
import { DevicesHomeAssistantPluginHomeAssistantDeviceType, type components } from '../../../openapi';
import { DEVICE_NO_ENTITY, ENTITY_NO_ATTRIBUTE } from '../devices-home-assistant.constants';

type ApiCreateChannelProperty = components['schemas']['DevicesHomeAssistantPluginCreateHomeAssistantChannelProperty'];
type ApiUpdateChannelProperty = components['schemas']['DevicesHomeAssistantPluginUpdateHomeAssistantChannelProperty'];
type ApiChannelProperty = components['schemas']['DevicesHomeAssistantPluginHomeAssistantChannelProperty'];

export const HomeAssistantChannelPropertySchema = ChannelPropertySchema.extend({
	haEntityId: z
		.string()
		.trim()
		.nonempty()
		.nullable()
		.transform((val) => (val === null ? DEVICE_NO_ENTITY : val)),
	haAttribute: z
		.string()
		.trim()
		.nonempty()
		.nullable()
		.transform((val) => (val === null ? ENTITY_NO_ATTRIBUTE : val)),
});

// BACKEND API
// ===========

export const HomeAssistantChannelPropertyCreateReqSchema: ZodType<ApiCreateChannelProperty> = ChannelPropertyCreateReqSchema.and(
	z.object({
		type: z.nativeEnum(DevicesHomeAssistantPluginHomeAssistantDeviceType),
		ha_entity_id: z
			.string()
			.trim()
			.nonempty()
			.nullable()
			.transform((val) => (val === DEVICE_NO_ENTITY ? null : val)),
		ha_attribute: z
			.string()
			.trim()
			.nonempty()
			.nullable()
			.transform((val) => (val === ENTITY_NO_ATTRIBUTE ? null : val)),
	})
);

export const HomeAssistantChannelPropertyUpdateReqSchema: ZodType<ApiUpdateChannelProperty> = ChannelPropertyUpdateReqSchema.and(
	z.object({
		type: z.nativeEnum(DevicesHomeAssistantPluginHomeAssistantDeviceType),
		ha_entity_id: z
			.string()
			.trim()
			.nonempty()
			.nullable()
			.transform((val) => (val === DEVICE_NO_ENTITY ? null : val))
			.optional(),
		ha_attribute: z
			.string()
			.trim()
			.nonempty()
			.nullable()
			.transform((val) => (val === ENTITY_NO_ATTRIBUTE ? null : val))
			.optional(),
	})
);

export const HomeAssistantChannelPropertyResSchema: ZodType<ApiChannelProperty> = ChannelPropertyResSchema.and(
	z.object({
		type: z.nativeEnum(DevicesHomeAssistantPluginHomeAssistantDeviceType),
		ha_entity_id: z.string().trim().nonempty().nullable(),
		ha_attribute: z.string().trim().nonempty().nullable(),
	})
);

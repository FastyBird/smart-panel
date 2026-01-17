import { type ZodType, z } from 'zod';

import { ChannelControlCreateReqSchema, ChannelControlResSchema, ChannelSchema, ChannelUpdateReqSchema } from '../../../modules/devices';
import type {
	DevicesHomeAssistantPluginChannelSchema,
	DevicesHomeAssistantPluginCreateChannelSchema,
	DevicesHomeAssistantPluginUpdateChannelSchema,
} from '../../../openapi.constants';
import { DevicesModuleChannelCategory } from '../../../openapi.constants';
import { DEVICES_HOME_ASSISTANT_TYPE } from '../devices-home-assistant.constants';

import { HomeAssistantChannelPropertyCreateReqSchema, HomeAssistantChannelPropertyResSchema } from './channels.properties.store.schemas';

type ApiCreateChannel = DevicesHomeAssistantPluginCreateChannelSchema;
type ApiUpdateChannel = DevicesHomeAssistantPluginUpdateChannelSchema;
type ApiChannel = DevicesHomeAssistantPluginChannelSchema;

export const HomeAssistantChannelSchema = ChannelSchema;

// BACKEND API
// ===========

// Create a new schema with HA-specific property types instead of using .and()
// because the properties array needs to use HomeAssistantChannelPropertyCreateReqSchema
export const HomeAssistantChannelCreateReqSchema: ZodType<ApiCreateChannel> = z.object({
	id: z.string().uuid().optional(),
	type: z.literal(DEVICES_HOME_ASSISTANT_TYPE),
	device: z.string().uuid(),
	category: z.nativeEnum(DevicesModuleChannelCategory),
	identifier: z.string().trim().nonempty().nullable().optional(),
	name: z.string().trim().nonempty(),
	description: z
		.string()
		.trim()
		.transform((val) => (val === '' ? null : val))
		.nullable()
		.optional(),
	parent: z.string().uuid().nullable().optional(),
	controls: z.array(ChannelControlCreateReqSchema).optional(),
	properties: z.array(HomeAssistantChannelPropertyCreateReqSchema).optional(),
});

export const HomeAssistantChannelUpdateReqSchema: ZodType<ApiUpdateChannel> = ChannelUpdateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_HOME_ASSISTANT_TYPE),
	})
);

// Create a new schema with HA-specific property types
export const HomeAssistantChannelResSchema: ZodType<ApiChannel> = z.object({
	id: z.string().uuid(),
	type: z.literal(DEVICES_HOME_ASSISTANT_TYPE),
	device: z.string().uuid(),
	category: z.nativeEnum(DevicesModuleChannelCategory),
	identifier: z.string().trim().nonempty().nullable(),
	name: z.string().trim().nonempty(),
	description: z.string().trim().nullable(),
	parent: z.string().uuid().nullable().optional(),
	created_at: z.string().date(),
	updated_at: z.string().date().nullable(),
	controls: z.array(ChannelControlResSchema),
	properties: z.array(HomeAssistantChannelPropertyResSchema),
});

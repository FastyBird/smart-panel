import { type ZodType, z } from 'zod';

import { ChannelCreateReqSchema, ChannelResSchema, ChannelSchema, ChannelUpdateReqSchema } from '../../../modules/devices';
import { DevicesHomeAssistantPluginHomeAssistantDeviceType, type components } from '../../../openapi';

type ApiCreateChannel = components['schemas']['DevicesHomeAssistantPluginDataChannel'];
type ApiUpdateChannel = components['schemas']['DevicesHomeAssistantPluginDataChannel'];
type ApiChannel = components['schemas']['DevicesHomeAssistantPluginDataChannel'];

export const HomeAssistantChannelSchema = ChannelSchema;

// BACKEND API
// ===========

export const HomeAssistantChannelCreateReqSchema: ZodType<ApiCreateChannel> = ChannelCreateReqSchema.and(
	z.object({
		type: z.nativeEnum(DevicesHomeAssistantPluginHomeAssistantDeviceType),
	})
);

export const HomeAssistantChannelUpdateReqSchema: ZodType<ApiUpdateChannel> = ChannelUpdateReqSchema.and(
	z.object({
		type: z.nativeEnum(DevicesHomeAssistantPluginHomeAssistantDeviceType),
	})
);

export const HomeAssistantChannelResSchema: ZodType<ApiChannel> = ChannelResSchema.and(
	z.object({
		type: z.nativeEnum(DevicesHomeAssistantPluginHomeAssistantDeviceType),
	})
);

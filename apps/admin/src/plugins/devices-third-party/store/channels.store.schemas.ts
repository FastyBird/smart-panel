import { type ZodType, z } from 'zod';

import { ChannelCreateReqSchema, ChannelResSchema, ChannelSchema, ChannelUpdateReqSchema } from '../../../modules/devices';
import { DevicesThirdPartyPluginThirdPartyDeviceType, type components } from '../../../openapi';

type ApiCreateChannel = components['schemas']['DevicesThirdPartyPluginDataChannel'];
type ApiUpdateChannel = components['schemas']['DevicesThirdPartyPluginDataChannel'];
type ApiChannel = components['schemas']['DevicesThirdPartyPluginDataChannel'];

export const ThirdPartyChannelSchema = ChannelSchema;

// BACKEND API
// ===========

export const ThirdPartyChannelCreateReqSchema: ZodType<ApiCreateChannel> = ChannelCreateReqSchema.and(
	z.object({
		type: z.nativeEnum(DevicesThirdPartyPluginThirdPartyDeviceType),
	})
);

export const ThirdPartyChannelUpdateReqSchema: ZodType<ApiUpdateChannel> = ChannelUpdateReqSchema.and(
	z.object({
		type: z.nativeEnum(DevicesThirdPartyPluginThirdPartyDeviceType),
	})
);

export const ThirdPartyChannelResSchema: ZodType<ApiChannel> = ChannelResSchema.and(
	z.object({
		type: z.nativeEnum(DevicesThirdPartyPluginThirdPartyDeviceType),
	})
);

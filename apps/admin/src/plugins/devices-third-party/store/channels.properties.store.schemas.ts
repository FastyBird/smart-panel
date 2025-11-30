import { type ZodType, z } from 'zod';

import {
	ChannelPropertyCreateReqSchema,
	ChannelPropertyResSchema,
	ChannelPropertySchema,
	ChannelPropertyUpdateReqSchema,
} from '../../../modules/devices';
import { DevicesThirdPartyPluginThirdPartyDeviceType, type components } from '../../../openapi';

type ApiCreateChannelProperty = components['schemas']['DevicesThirdPartyPluginDataChannelProperty'];
type ApiUpdateChannelProperty = components['schemas']['DevicesThirdPartyPluginDataChannelProperty'];
type ApiChannelProperty = components['schemas']['DevicesThirdPartyPluginDataChannelProperty'];

export const ThirdPartyChannelPropertySchema = ChannelPropertySchema;

// BACKEND API
// ===========

export const ThirdPartyChannelPropertyCreateReqSchema: ZodType<ApiCreateChannelProperty> = ChannelPropertyCreateReqSchema.and(
	z.object({
		type: z.nativeEnum(DevicesThirdPartyPluginThirdPartyDeviceType),
	})
);

export const ThirdPartyChannelPropertyUpdateReqSchema: ZodType<ApiUpdateChannelProperty> = ChannelPropertyUpdateReqSchema.and(
	z.object({
		type: z.nativeEnum(DevicesThirdPartyPluginThirdPartyDeviceType),
	})
);

export const ThirdPartyChannelPropertyResSchema: ZodType<ApiChannelProperty> = ChannelPropertyResSchema.and(
	z.object({
		type: z.nativeEnum(DevicesThirdPartyPluginThirdPartyDeviceType),
	})
);

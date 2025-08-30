import { type ZodType, z } from 'zod';

import { ChannelCreateReqSchema, ChannelResSchema, ChannelSchema, ChannelUpdateReqSchema } from '../../../modules/devices';
import { type components } from '../../../openapi';
import { DEVICES_THIRD_PARTY_TYPE } from '../devices-third-party.constants';

type ApiCreateChannel = components['schemas']['DevicesThirdPartyPluginCreateThirdPartyChannel'];
type ApiUpdateChannel = components['schemas']['DevicesThirdPartyPluginUpdateThirdPartyChannel'];
type ApiChannel = components['schemas']['DevicesThirdPartyPluginThirdPartyChannel'];

export const ThirdPartyChannelSchema = ChannelSchema;

// BACKEND API
// ===========

export const ThirdPartyChannelCreateReqSchema: ZodType<ApiCreateChannel> = ChannelCreateReqSchema.and(
	z.object({
		type: z.string().trim().nonempty().default(DEVICES_THIRD_PARTY_TYPE),
	})
);

export const ThirdPartyChannelUpdateReqSchema: ZodType<ApiUpdateChannel> = ChannelUpdateReqSchema.and(
	z.object({
		type: z.string().trim().nonempty().default(DEVICES_THIRD_PARTY_TYPE),
	})
);

export const ThirdPartyChannelResSchema: ZodType<ApiChannel> = ChannelResSchema.and(
	z.object({
		type: z.string().trim().nonempty().default(DEVICES_THIRD_PARTY_TYPE),
	})
);

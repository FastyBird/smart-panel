import { type ZodType, z } from 'zod';

import {
	ChannelPropertyCreateReqSchema,
	ChannelPropertyResSchema,
	ChannelPropertySchema,
	ChannelPropertyUpdateReqSchema,
} from '../../../modules/devices';
import { type components } from '../../../openapi';
import { DEVICES_THIRD_PARTY_TYPE } from '../devices-third-party.constants';

type ApiCreateChannelProperty = components['schemas']['DevicesThirdPartyPluginCreateThirdPartyChannelProperty'];
type ApiUpdateChannelProperty = components['schemas']['DevicesThirdPartyPluginUpdateThirdPartyChannelProperty'];
type ApiChannelProperty = components['schemas']['DevicesThirdPartyPluginThirdPartyChannelProperty'];

export const ThirdPartyChannelPropertySchema = ChannelPropertySchema;

// BACKEND API
// ===========

export const ThirdPartyChannelPropertyCreateReqSchema: ZodType<ApiCreateChannelProperty> = ChannelPropertyCreateReqSchema.and(
	z.object({
		type: z.string().trim().nonempty().default(DEVICES_THIRD_PARTY_TYPE),
	})
);

export const ThirdPartyChannelPropertyUpdateReqSchema: ZodType<ApiUpdateChannelProperty> = ChannelPropertyUpdateReqSchema.and(
	z.object({
		type: z.string().trim().nonempty().default(DEVICES_THIRD_PARTY_TYPE),
	})
);

export const ThirdPartyChannelPropertyResSchema: ZodType<ApiChannelProperty> = ChannelPropertyResSchema.and(
	z.object({
		type: z.string().trim().nonempty().default(DEVICES_THIRD_PARTY_TYPE),
	})
);

import { type ZodType, z } from 'zod';

import {
	ChannelPropertyCreateReqSchema,
	ChannelPropertyResSchema,
	ChannelPropertySchema,
	ChannelPropertyUpdateReqSchema,
} from '../../../modules/devices';
import type {
	DevicesThirdPartyPluginCreateChannelPropertySchema,
	DevicesThirdPartyPluginUpdateChannelPropertySchema,
	DevicesThirdPartyPluginChannelPropertySchema,
} from '../../../openapi.constants';
import { DEVICES_THIRD_PARTY_TYPE } from '../devices-third-party.constants';

type ApiCreateChannelProperty = DevicesThirdPartyPluginCreateChannelPropertySchema;
type ApiUpdateChannelProperty = DevicesThirdPartyPluginUpdateChannelPropertySchema;
type ApiChannelProperty = DevicesThirdPartyPluginChannelPropertySchema;

export const ThirdPartyChannelPropertySchema = ChannelPropertySchema;

// BACKEND API
// ===========

export const ThirdPartyChannelPropertyCreateReqSchema: ZodType<ApiCreateChannelProperty> = ChannelPropertyCreateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_THIRD_PARTY_TYPE),
	})
);

export const ThirdPartyChannelPropertyUpdateReqSchema: ZodType<ApiUpdateChannelProperty> = ChannelPropertyUpdateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_THIRD_PARTY_TYPE),
	})
);

export const ThirdPartyChannelPropertyResSchema: ZodType<ApiChannelProperty> = ChannelPropertyResSchema.and(
	z.object({
		type: z.literal(DEVICES_THIRD_PARTY_TYPE),
	})
);

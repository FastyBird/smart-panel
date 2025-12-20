import { type ZodType, z } from 'zod';

import {
	ChannelPropertyCreateReqSchema,
	ChannelPropertyResSchema,
	ChannelPropertySchema,
	ChannelPropertyUpdateReqSchema,
} from '../../../modules/devices';
import type {
	DevicesWledPluginCreateChannelPropertySchema,
	DevicesWledPluginUpdateChannelPropertySchema,
	DevicesWledPluginChannelPropertySchema,
} from '../../../openapi.constants';
import { DEVICES_WLED_TYPE } from '../devices-wled.constants';

type ApiCreateChannelProperty = DevicesWledPluginCreateChannelPropertySchema;
type ApiUpdateChannelProperty = DevicesWledPluginUpdateChannelPropertySchema;
type ApiChannelProperty = DevicesWledPluginChannelPropertySchema;

export const WledChannelPropertySchema = ChannelPropertySchema;

// BACKEND API
// ===========

export const WledChannelPropertyCreateReqSchema: ZodType<ApiCreateChannelProperty> = ChannelPropertyCreateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_WLED_TYPE),
	})
);

export const WledChannelPropertyUpdateReqSchema: ZodType<ApiUpdateChannelProperty> = ChannelPropertyUpdateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_WLED_TYPE),
	})
);

export const WledChannelPropertyResSchema: ZodType<ApiChannelProperty> = ChannelPropertyResSchema.and(
	z.object({
		type: z.literal(DEVICES_WLED_TYPE),
	})
);

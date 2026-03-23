import { type ZodType, z } from 'zod';

import {
	ChannelPropertyCreateReqSchema,
	ChannelPropertyResSchema,
	ChannelPropertySchema,
	ChannelPropertyUpdateReqSchema,
} from '../../../modules/devices';
import type {
	DevicesReTerminalPluginChannelPropertySchema,
	DevicesReTerminalPluginCreateChannelPropertySchema,
	DevicesReTerminalPluginUpdateChannelPropertySchema,
} from '../../../openapi.constants';
import { DEVICES_RETERMINAL_TYPE } from '../devices-reterminal.constants';

type ApiCreateChannelProperty = DevicesReTerminalPluginCreateChannelPropertySchema;
type ApiUpdateChannelProperty = DevicesReTerminalPluginUpdateChannelPropertySchema;
type ApiChannelProperty = DevicesReTerminalPluginChannelPropertySchema;

export const ReTerminalChannelPropertySchema = ChannelPropertySchema;

// BACKEND API
// ===========

export const ReTerminalChannelPropertyCreateReqSchema: ZodType<ApiCreateChannelProperty> = ChannelPropertyCreateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_RETERMINAL_TYPE),
	})
);

export const ReTerminalChannelPropertyUpdateReqSchema: ZodType<ApiUpdateChannelProperty> = ChannelPropertyUpdateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_RETERMINAL_TYPE),
	})
);

export const ReTerminalChannelPropertyResSchema: ZodType<ApiChannelProperty> = ChannelPropertyResSchema.and(
	z.object({
		type: z.literal(DEVICES_RETERMINAL_TYPE),
	})
);

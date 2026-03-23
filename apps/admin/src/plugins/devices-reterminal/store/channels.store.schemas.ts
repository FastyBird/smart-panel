import { type ZodType, z } from 'zod';

import { ChannelCreateReqSchema, ChannelResSchema, ChannelSchema, ChannelUpdateReqSchema } from '../../../modules/devices';
import type {
	DevicesReTerminalPluginChannelSchema,
	DevicesReTerminalPluginCreateChannelSchema,
	DevicesReTerminalPluginUpdateChannelSchema,
} from '../../../openapi.constants';
import { DEVICES_RETERMINAL_TYPE } from '../devices-reterminal.constants';

type ApiCreateChannel = DevicesReTerminalPluginCreateChannelSchema;
type ApiUpdateChannel = DevicesReTerminalPluginUpdateChannelSchema;
type ApiChannel = DevicesReTerminalPluginChannelSchema;

export const ReTerminalChannelSchema = ChannelSchema;

// BACKEND API
// ===========

export const ReTerminalChannelCreateReqSchema: ZodType<ApiCreateChannel> = ChannelCreateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_RETERMINAL_TYPE),
	})
);

export const ReTerminalChannelUpdateReqSchema: ZodType<ApiUpdateChannel> = ChannelUpdateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_RETERMINAL_TYPE),
	})
);

export const ReTerminalChannelResSchema: ZodType<ApiChannel> = ChannelResSchema.and(
	z.object({
		type: z.literal(DEVICES_RETERMINAL_TYPE),
	})
);

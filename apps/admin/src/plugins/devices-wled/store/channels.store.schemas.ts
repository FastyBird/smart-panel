import { type ZodType, z } from 'zod';

import { ChannelCreateReqSchema, ChannelResSchema, ChannelSchema, ChannelUpdateReqSchema } from '../../../modules/devices';
import type {
	DevicesWledPluginCreateChannelSchema,
	DevicesWledPluginUpdateChannelSchema,
	DevicesWledPluginChannelSchema,
} from '../../../openapi.constants';
import { DEVICES_WLED_TYPE } from '../devices-wled.constants';

type ApiCreateChannel = DevicesWledPluginCreateChannelSchema;
type ApiUpdateChannel = DevicesWledPluginUpdateChannelSchema;
type ApiChannel = DevicesWledPluginChannelSchema;

export const WledChannelSchema = ChannelSchema;

// BACKEND API
// ===========

export const WledChannelCreateReqSchema: ZodType<ApiCreateChannel> = ChannelCreateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_WLED_TYPE),
	})
);

export const WledChannelUpdateReqSchema: ZodType<ApiUpdateChannel> = ChannelUpdateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_WLED_TYPE),
	})
);

export const WledChannelResSchema: ZodType<ApiChannel> = ChannelResSchema.and(
	z.object({
		type: z.literal(DEVICES_WLED_TYPE),
	})
);

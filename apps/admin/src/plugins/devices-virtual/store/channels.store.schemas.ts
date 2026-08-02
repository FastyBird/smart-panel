import { type ZodType, z } from 'zod';

import { ChannelCreateReqSchema, ChannelResSchema, ChannelSchema, ChannelUpdateReqSchema } from '../../../modules/devices';
import type {
	DevicesVirtualPluginChannelSchema,
	DevicesVirtualPluginCreateChannelSchema,
	DevicesVirtualPluginUpdateChannelSchema,
} from '../../../openapi.constants';
import { DEVICES_VIRTUAL_TYPE } from '../devices-virtual.constants';

type ApiCreateChannel = DevicesVirtualPluginCreateChannelSchema;
type ApiUpdateChannel = DevicesVirtualPluginUpdateChannelSchema;
type ApiChannel = DevicesVirtualPluginChannelSchema;

export const VirtualChannelSchema = ChannelSchema;

// BACKEND API
// ===========

export const VirtualChannelCreateReqSchema: ZodType<ApiCreateChannel> = ChannelCreateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_VIRTUAL_TYPE),
	})
);

export const VirtualChannelUpdateReqSchema: ZodType<ApiUpdateChannel> = ChannelUpdateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_VIRTUAL_TYPE),
	})
);

export const VirtualChannelResSchema: ZodType<ApiChannel> = ChannelResSchema.and(
	z.object({
		type: z.literal(DEVICES_VIRTUAL_TYPE),
	})
);

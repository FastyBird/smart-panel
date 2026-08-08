import { type ZodType, z } from 'zod';

import {
	ChannelPropertyCreateReqSchema,
	ChannelPropertyResSchema,
	ChannelPropertySchema,
	ChannelPropertyUpdateReqSchema,
} from '../../../modules/devices';
import type {
	DevicesVirtualPluginChannelPropertySchema,
	DevicesVirtualPluginCreateChannelPropertySchema,
	DevicesVirtualPluginUpdateChannelPropertySchema,
} from '../../../openapi.constants';
import { DevicesVirtualPluginValueOrigin } from '../../../openapi.constants';
import { DEVICES_VIRTUAL_TYPE } from '../devices-virtual.constants';

type ApiCreateChannelProperty = DevicesVirtualPluginCreateChannelPropertySchema;
type ApiUpdateChannelProperty = DevicesVirtualPluginUpdateChannelPropertySchema;
type ApiChannelProperty = DevicesVirtualPluginChannelPropertySchema;

// STORE STATE
// ===========

// Virtual channel properties add value_origin (does this property store its own value, or project
// one from another property) and source_property (which property it projects, when linked).
export const VirtualChannelPropertySchema = ChannelPropertySchema.extend({
	valueOrigin: z.nativeEnum(DevicesVirtualPluginValueOrigin).default(DevicesVirtualPluginValueOrigin.source),
	sourceProperty: z.string().uuid().nullable().default(null),
});

// BACKEND API
// ===========

export const VirtualChannelPropertyCreateReqSchema: ZodType<ApiCreateChannelProperty> = ChannelPropertyCreateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_VIRTUAL_TYPE),
		value_origin: z.nativeEnum(DevicesVirtualPluginValueOrigin).optional(),
		source_property: z.string().uuid().nullable().optional(),
	})
);

export const VirtualChannelPropertyUpdateReqSchema: ZodType<ApiUpdateChannelProperty> = ChannelPropertyUpdateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_VIRTUAL_TYPE),
		value_origin: z.nativeEnum(DevicesVirtualPluginValueOrigin).optional(),
		source_property: z.string().uuid().nullable().optional(),
	})
);

export const VirtualChannelPropertyResSchema: ZodType<ApiChannelProperty> = ChannelPropertyResSchema.and(
	z.object({
		type: z.literal(DEVICES_VIRTUAL_TYPE),
		value_origin: z.nativeEnum(DevicesVirtualPluginValueOrigin),
		source_property: z.string().uuid().nullable().optional(),
	})
);

import { type ZodType, z } from 'zod';

import {
	ChannelPropertyCreateReqSchema,
	ChannelPropertyResSchema,
	ChannelPropertySchema,
	ChannelPropertyUpdateReqSchema,
} from '../../../modules/devices';
import type {
	DevicesUnifiProtectPluginChannelPropertySchema,
	DevicesUnifiProtectPluginCreateChannelPropertySchema,
} from '../../../openapi.constants';
import { DEVICES_UNIFI_PROTECT_TYPE } from '../devices-unifi-protect.constants';

export const ProtectChannelPropertySchema = ChannelPropertySchema.extend({
	protectMappingName: z.string().nullable().optional(),
});

export const ProtectChannelPropertyCreateReqSchema: ZodType<DevicesUnifiProtectPluginCreateChannelPropertySchema> =
	ChannelPropertyCreateReqSchema.and(z.object({ type: z.literal(DEVICES_UNIFI_PROTECT_TYPE) }));

export const ProtectChannelPropertyUpdateReqSchema = ChannelPropertyUpdateReqSchema.and(z.object({ type: z.literal(DEVICES_UNIFI_PROTECT_TYPE) }));

export const ProtectChannelPropertyResSchema: ZodType<DevicesUnifiProtectPluginChannelPropertySchema> = ChannelPropertyResSchema.and(
	z.object({
		type: z.literal(DEVICES_UNIFI_PROTECT_TYPE),
		protect_mapping_name: z.string().nullable().optional(),
	})
);

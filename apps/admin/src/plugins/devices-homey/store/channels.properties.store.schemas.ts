import { type ZodType, z } from 'zod';

import {
	ChannelPropertyCreateReqSchema,
	ChannelPropertyResSchema,
	ChannelPropertySchema,
	ChannelPropertyUpdateReqSchema,
} from '../../../modules/devices';
import type { DevicesHomeyPluginChannelPropertySchema, DevicesHomeyPluginCreateChannelPropertySchema } from '../../../openapi.constants';
import { DEVICES_HOMEY_TYPE } from '../devices-homey.constants';

export const HomeyChannelPropertySchema = ChannelPropertySchema.extend({
	homeyCapabilityId: z.string().nullable().optional(),
	homeyMappingName: z.string().nullable().optional(),
});

export const HomeyChannelPropertyCreateReqSchema: ZodType<DevicesHomeyPluginCreateChannelPropertySchema> = ChannelPropertyCreateReqSchema.and(
	z.object({ type: z.literal(DEVICES_HOMEY_TYPE) })
);

export const HomeyChannelPropertyUpdateReqSchema = ChannelPropertyUpdateReqSchema.and(z.object({ type: z.literal(DEVICES_HOMEY_TYPE) }));

export const HomeyChannelPropertyResSchema: ZodType<DevicesHomeyPluginChannelPropertySchema> = ChannelPropertyResSchema.and(
	z.object({
		type: z.literal(DEVICES_HOMEY_TYPE),
		homey_capability_id: z.string().nullable().optional(),
		homey_mapping_name: z.string().nullable().optional(),
	})
);

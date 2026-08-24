import { type ZodType, z } from 'zod';

import { ChannelControlCreateReqSchema, ChannelResSchema, ChannelSchema, ChannelUpdateReqSchema } from '../../../modules/devices';
import type { DevicesHomeyPluginChannelSchema } from '../../../openapi.constants';
import { DevicesModuleChannelCategory } from '../../../openapi.constants';
import { DEVICES_HOMEY_TYPE } from '../devices-homey.constants';

import { HomeyChannelPropertyCreateReqSchema } from './channels.properties.store.schemas';

export const HomeyChannelSchema = ChannelSchema;

export const HomeyChannelCreateReqSchema = z.object({
	id: z.string().uuid().optional(),
	type: z.literal(DEVICES_HOMEY_TYPE),
	device: z.string().uuid(),
	category: z.nativeEnum(DevicesModuleChannelCategory),
	identifier: z.string().trim().nonempty().nullable().optional(),
	name: z.string().trim().nonempty(),
	description: z.string().trim().nullable().optional(),
	parent: z.string().uuid().nullable().optional(),
	controls: z.array(ChannelControlCreateReqSchema).optional(),
	properties: z.array(HomeyChannelPropertyCreateReqSchema).optional(),
});

export const HomeyChannelUpdateReqSchema = ChannelUpdateReqSchema.and(z.object({ type: z.literal(DEVICES_HOMEY_TYPE) }));

export const HomeyChannelResSchema: ZodType<DevicesHomeyPluginChannelSchema> = ChannelResSchema.and(
	z.object({ type: z.literal(DEVICES_HOMEY_TYPE) })
);

import { type ZodType, z } from 'zod';

import { ChannelControlCreateReqSchema, ChannelResSchema, ChannelSchema, ChannelUpdateReqSchema } from '../../../modules/devices';
import type { DevicesUnifiProtectPluginChannelSchema } from '../../../openapi.constants';
import { DevicesModuleChannelCategory } from '../../../openapi.constants';
import { DEVICES_UNIFI_PROTECT_TYPE } from '../devices-unifi-protect.constants';

import { ProtectChannelPropertyCreateReqSchema } from './channels.properties.store.schemas';

export const ProtectChannelSchema = ChannelSchema;

export const ProtectChannelCreateReqSchema = z.object({
	id: z.string().uuid().optional(),
	type: z.literal(DEVICES_UNIFI_PROTECT_TYPE),
	device: z.string().uuid(),
	category: z.nativeEnum(DevicesModuleChannelCategory),
	identifier: z.string().trim().nonempty().nullable().optional(),
	name: z.string().trim().nonempty(),
	description: z.string().trim().nullable().optional(),
	parent: z.string().uuid().nullable().optional(),
	controls: z.array(ChannelControlCreateReqSchema).optional(),
	properties: z.array(ProtectChannelPropertyCreateReqSchema).optional(),
});

export const ProtectChannelUpdateReqSchema = ChannelUpdateReqSchema.and(z.object({ type: z.literal(DEVICES_UNIFI_PROTECT_TYPE) }));

export const ProtectChannelResSchema: ZodType<DevicesUnifiProtectPluginChannelSchema> = ChannelResSchema.and(
	z.object({ type: z.literal(DEVICES_UNIFI_PROTECT_TYPE) })
);

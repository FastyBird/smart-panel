import { type ZodType, z } from 'zod';

import {
	ChannelCreateReqSchema,
	ChannelResSchema,
	DeviceControlCreateReqSchema,
	DeviceControlResSchema,
	DeviceSchema,
} from '../../../modules/devices';
import { DevicesDeviceCategory, type components } from '../../../openapi';

type ApiCreateDevice = components['schemas']['DevicesCreateDevice'];
type ApiUpdateDevice = components['schemas']['DevicesUpdateDevice'];
type ApiDevice = components['schemas']['DevicesDevice'];

export const ThirdPartyDeviceSchema = DeviceSchema.extend({
	serviceAddress: z.string().trim().url(),
});

// BACKEND API
// ===========

export const ThirdPartyDeviceCreateReqSchema: ZodType<ApiCreateDevice & { service_address: string }> = z.object({
	id: z.string().uuid().optional(),
	type: z.string().trim().nonempty(),
	category: z.nativeEnum(DevicesDeviceCategory),
	name: z.string().trim().nonempty(),
	description: z
		.string()
		.trim()
		.transform((val) => (val === '' ? null : val))
		.nullable()
		.optional(),
	controls: z.array(DeviceControlCreateReqSchema).optional(),
	channels: z.array(ChannelCreateReqSchema).optional(),
	service_address: z.string().trim().url(),
});

export const ThirdPartyDeviceUpdateReqSchema: ZodType<ApiUpdateDevice & { service_address?: string }> = z.object({
	type: z.string().trim().nonempty(),
	name: z.string().trim().nonempty().optional(),
	description: z
		.string()
		.trim()
		.transform((val) => (val === '' ? null : val))
		.nullable()
		.optional(),
	service_address: z.string().trim().url().optional(),
});

export const ThirdPartyDeviceResSchema: ZodType<ApiDevice & { service_address: string }> = z.object({
	id: z.string().uuid(),
	type: z.string(),
	category: z.nativeEnum(DevicesDeviceCategory),
	name: z.string().trim().nonempty(),
	description: z.string().trim().nullable(),
	created_at: z.string().date(),
	updated_at: z.string().date().nullable(),
	controls: z.array(DeviceControlResSchema),
	channels: z.array(ChannelResSchema),
	service_address: z.string().trim().url(),
});

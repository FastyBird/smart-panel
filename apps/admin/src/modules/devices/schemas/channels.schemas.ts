import { z } from 'zod';

import { DevicesModuleChannelCategory } from '../../../openapi';

export const ChannelAddFormSchema = z.object({
	id: z.string().uuid().optional(),
	type: z.string().trim().nonempty(),
	device: z.string().uuid().optional(),
	category: z.nativeEnum(DevicesModuleChannelCategory).default(DevicesModuleChannelCategory.generic),
	identifier: z.string().trim().nonempty().nullable().optional(),
	name: z.string().trim().nonempty(),
	description: z
		.string()
		.trim()
		.transform((val) => (val === '' ? null : val))
		.nullable()
		.optional(),
});

export const ChannelEditFormSchema = z.object({
	id: z.string().uuid(),
	type: z.string().trim().nonempty(),
	device: z.string().uuid(),
	category: z.nativeEnum(DevicesModuleChannelCategory).default(DevicesModuleChannelCategory.generic),
	identifier: z.string().trim().nonempty().nullable().optional(),
	name: z.string().trim().nonempty().optional(),
	description: z
		.string()
		.trim()
		.transform((val) => (val === '' ? null : val))
		.nullable()
		.optional(),
});

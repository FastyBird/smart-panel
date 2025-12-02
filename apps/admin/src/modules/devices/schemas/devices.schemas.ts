import { z } from 'zod';

import { DevicesModuleDeviceCategory } from '../../../openapi.constants';

export const DeviceAddFormSchema = z.object({
	id: z.string().uuid().optional(),
	type: z.string().trim().nonempty(),
	category: z.nativeEnum(DevicesModuleDeviceCategory).default(DevicesModuleDeviceCategory.generic),
	identifier: z.string().trim().nonempty().nullable().optional(),
	name: z.string().trim().nonempty(),
	description: z
		.string()
		.trim()
		.transform((val) => (val === '' ? null : val))
		.nullable()
		.optional(),
	enabled: z.boolean().default(true).optional(),
});

export const DeviceEditFormSchema = z.object({
	id: z.string().uuid(),
	type: z.string().trim().nonempty(),
	category: z.nativeEnum(DevicesModuleDeviceCategory).default(DevicesModuleDeviceCategory.generic),
	identifier: z.string().trim().nonempty().nullable().optional(),
	name: z.string().trim().nonempty().optional(),
	description: z
		.string()
		.trim()
		.transform((val) => (val === '' ? null : val))
		.nullable()
		.optional(),
	enabled: z.boolean().optional(),
});

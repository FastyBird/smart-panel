import { z } from 'zod';

import {
	DevicesModuleChannelPropertyCategory,
	DevicesModuleChannelPropertyData_type,
	DevicesModuleChannelPropertyPermissions,
} from '../../../openapi';

export const ChannelPropertyAddFormSchema = z.object({
	id: z.string().uuid().optional(),
	type: z.string().trim().nonempty(),
	channel: z.string().uuid().optional(),
	category: z.nativeEnum(DevicesModuleChannelPropertyCategory).default(DevicesModuleChannelPropertyCategory.generic),
	name: z.string().trim().nonempty().nullable(),
	permissions: z.array(z.nativeEnum(DevicesModuleChannelPropertyPermissions)),
	dataType: z.nativeEnum(DevicesModuleChannelPropertyData_type),
	unit: z.string().nullable(),
	format: z.array(z.union([z.string(), z.union([z.number(), z.null()])])).nullable(),
	invalid: z.union([z.string(), z.number(), z.boolean(), z.null()]),
	step: z.number().nullable(),
	value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
	enumValues: z.array(z.string()),
	minValue: z.number().optional(),
	maxValue: z.number().optional(),
});

export const ChannelPropertyEditFormSchema = z.object({
	id: z.string().uuid(),
	type: z.string().trim().nonempty(),
	channel: z.string().uuid(),
	category: z.nativeEnum(DevicesModuleChannelPropertyCategory).default(DevicesModuleChannelPropertyCategory.generic),
	name: z.string().trim().nonempty().nullable().optional(),
	permissions: z.array(z.nativeEnum(DevicesModuleChannelPropertyPermissions)),
	dataType: z.nativeEnum(DevicesModuleChannelPropertyData_type),
	unit: z.string().nullable().optional(),
	format: z
		.array(z.union([z.string(), z.union([z.number(), z.null()])]))
		.nullable()
		.optional(),
	invalid: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
	step: z.number().nullable().optional(),
	value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
	enumValues: z.array(z.string()),
	minValue: z.number().optional(),
	maxValue: z.number().optional(),
});

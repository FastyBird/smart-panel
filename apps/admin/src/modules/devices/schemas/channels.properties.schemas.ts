import { z } from 'zod';

import {
	DevicesModuleChannelPropertyCategory,
	DevicesModuleChannelPropertyDataType,
	DevicesModuleChannelPropertyPermissions,
} from '../../../openapi.constants';

export const ChannelPropertyAddFormSchema = z.object({
	id: z.string().uuid().optional(),
	type: z.string().trim().nonempty(),
	channel: z.string().uuid().optional(),
	category: z.nativeEnum(DevicesModuleChannelPropertyCategory).default(DevicesModuleChannelPropertyCategory.generic),
	identifier: z.string().trim().nonempty().nullable().optional(),
	name: z.string().trim().nonempty().nullable(),
	permissions: z.array(z.nativeEnum(DevicesModuleChannelPropertyPermissions)),
	dataType: z.nativeEnum(DevicesModuleChannelPropertyDataType),
	unit: z.string().nullable(),
	format: z.array(z.union([z.string(), z.union([z.number(), z.null()])])).nullable(),
	invalid: z.union([z.string(), z.number(), z.boolean(), z.null()]),
	step: z
		.union([z.string(), z.number()])
		.transform((val) => (val === '' ? null : Number(val)))
		.nullable(),
	enterValue: z.boolean().default(false),
	value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
	enumValues: z.array(z.string()),
	minValue: z
		.union([z.string(), z.number()])
		.transform((val) => (val === '' ? undefined : Number(val)))
		.optional(),
	maxValue: z
		.union([z.string(), z.number()])
		.transform((val) => (val === '' ? undefined : Number(val)))
		.optional(),
});

export const ChannelPropertyEditFormSchema = z.object({
	id: z.string().uuid(),
	type: z.string().trim().nonempty(),
	channel: z.string().uuid(),
	category: z.nativeEnum(DevicesModuleChannelPropertyCategory).default(DevicesModuleChannelPropertyCategory.generic),
	identifier: z.string().trim().nonempty().nullable().optional(),
	name: z.string().trim().nonempty().nullable().optional(),
	permissions: z.array(z.nativeEnum(DevicesModuleChannelPropertyPermissions)),
	dataType: z.nativeEnum(DevicesModuleChannelPropertyDataType),
	unit: z.string().nullable(),
	format: z.array(z.union([z.string(), z.union([z.number(), z.null()])])).nullable(),
	invalid: z.union([z.string(), z.number(), z.boolean(), z.null()]),
	step: z
		.union([z.string(), z.number()])
		.transform((val) => (val === '' ? null : Number(val)))
		.nullable(),
	enterValue: z.boolean().default(false),
	value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
	enumValues: z.array(z.string()),
	minValue: z
		.union([z.string(), z.number()])
		.transform((val) => (val === '' ? undefined : Number(val)))
		.optional(),
	maxValue: z
		.union([z.string(), z.number()])
		.transform((val) => (val === '' ? undefined : Number(val)))
		.optional(),
});

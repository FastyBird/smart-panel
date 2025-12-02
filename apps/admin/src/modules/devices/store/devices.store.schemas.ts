import { v4 as uuid } from 'uuid';
import { type ZodType, z } from 'zod';

import { type components } from '../../../openapi.constants';
import { DevicesModuleDeviceCategory, DevicesModuleDeviceConnectionStatus } from '../../../openapi.constants';

import { ChannelCreateReqSchema, ChannelResSchema } from './channels.store.schemas';
import { DeviceControlCreateReqSchema, DeviceControlResSchema } from './devices.controls.store.schemas';
import { ItemIdSchema } from './types';

type ApiCreateDevice = components['schemas']['DevicesModuleCreateDevice'];
type ApiUpdateDevice = components['schemas']['DevicesModuleUpdateDevice'];
type ApiDevice = components['schemas']['DevicesModuleDataDevice'];

// STORE STATE
// ===========

export const DeviceSchema = z.object({
	id: ItemIdSchema,
	draft: z.boolean().default(false),
	type: z.string().trim().nonempty(),
	category: z.nativeEnum(DevicesModuleDeviceCategory).default(DevicesModuleDeviceCategory.generic),
	identifier: z.string().trim().nonempty().nullable().default(null),
	name: z.string().trim().nonempty(),
	description: z.string().trim().nullable().default(null),
	enabled: z.boolean().default(true),
	status: z.object({
		online: z.boolean().default(false),
		status: z.nativeEnum(DevicesModuleDeviceConnectionStatus).default(DevicesModuleDeviceConnectionStatus.unknown),
	}),
	createdAt: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
	updatedAt: z
		.union([z.string().datetime({ offset: true }), z.date()])
		.transform((date) => (date instanceof Date ? date : new Date(date)))
		.optional()
		.nullable()
		.default(null),
});

export const DevicesStateSemaphoreSchema = z.object({
	fetching: z.object({
		items: z.boolean().default(false),
		item: z.array(ItemIdSchema),
	}),
	creating: z.array(ItemIdSchema),
	updating: z.array(ItemIdSchema),
	deleting: z.array(ItemIdSchema),
});

// STORE ACTIONS
// =============

export const DevicesOnEventActionPayloadSchema = z.object({
	id: ItemIdSchema,
	type: z.string().trim().nonempty(),
	data: z.object({}),
});

export const DevicesSetActionPayloadSchema = z.object({
	id: ItemIdSchema,
	data: z
		.object({
			type: z.string().trim().nonempty(),
			category: z.nativeEnum(DevicesModuleDeviceCategory).default(DevicesModuleDeviceCategory.generic),
			identifier: z.string().trim().nonempty().nullable(),
			name: z.string().trim().nonempty(),
			description: z
				.string()
				.trim()
				.transform((val) => (val === '' ? null : val))
				.nullable()
				.optional(),
			enabled: z.boolean(),
			status: z.object({
				online: z.boolean(),
				status: z.nativeEnum(DevicesModuleDeviceConnectionStatus),
			}),
		})
		.passthrough(),
});

export const DevicesUnsetActionPayloadSchema = z.object({
	id: ItemIdSchema,
});

export const DevicesGetActionPayloadSchema = z.object({
	id: ItemIdSchema,
});

export const DevicesAddActionPayloadSchema = z.object({
	id: ItemIdSchema.optional().default(uuid()),
	draft: z.boolean().optional().default(false),
	data: z
		.object({
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
			enabled: z.boolean().optional(),
		})
		.passthrough(),
});

export const DevicesEditActionPayloadSchema = z.object({
	id: ItemIdSchema,
	data: z
		.object({
			type: z.string().trim().nonempty(),
			identifier: z.string().trim().nonempty().nullable().optional(),
			name: z.string().trim().optional(),
			description: z
				.string()
				.trim()
				.transform((val) => (val === '' ? null : val))
				.nullable()
				.optional(),
			enabled: z.boolean().optional(),
		})
		.passthrough(),
});

export const DevicesSaveActionPayloadSchema = z.object({
	id: ItemIdSchema,
});

export const DevicesRemoveActionPayloadSchema = z.object({
	id: ItemIdSchema,
});

// BACKEND API
// ===========

export const DeviceCreateReqSchema: ZodType<ApiCreateDevice> = z.object({
	id: z.string().uuid().optional(),
	type: z.string().trim().nonempty(),
	category: z.nativeEnum(DevicesModuleDeviceCategory),
	identifier: z.string().trim().nonempty().nullable().optional(),
	name: z.string().trim().nonempty(),
	description: z
		.string()
		.trim()
		.transform((val) => (val === '' ? null : val))
		.nullable()
		.optional(),
	enabled: z.boolean().optional(),
	controls: z.array(DeviceControlCreateReqSchema).optional(),
	channels: z.array(ChannelCreateReqSchema).optional(),
});

export const DeviceUpdateReqSchema: ZodType<ApiUpdateDevice> = z.object({
	type: z.string().trim().nonempty(),
	category: z.nativeEnum(DevicesModuleDeviceCategory).optional(),
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

export const DeviceResSchema: ZodType<ApiDevice> = z.object({
	id: z.string().uuid(),
	type: z.string(),
	category: z.nativeEnum(DevicesModuleDeviceCategory),
	identifier: z.string().trim().nonempty().nullable(),
	name: z.string().trim().nonempty(),
	description: z.string().trim().nullable(),
	enabled: z.boolean(),
	status: z.object({
		online: z.boolean(),
		status: z.nativeEnum(DevicesModuleDeviceConnectionStatus),
	}),
	created_at: z.string().date(),
	updated_at: z.string().date().nullable(),
	controls: z.array(DeviceControlResSchema),
	channels: z.array(ChannelResSchema),
});

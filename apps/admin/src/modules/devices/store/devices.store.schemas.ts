import { v4 as uuid } from 'uuid';
import { type ZodType, z } from 'zod';

import type { DevicesModuleCreateDeviceSchema, DevicesModuleDeviceSchema, DevicesModuleUpdateDeviceSchema } from '../../../openapi.constants';
import {
	DevicesModuleDeviceCategory,
	DevicesModuleDeviceConnectionStatus,
	DevicesModuleDeviceHiddenBy,
	DevicesModuleDevicesHiddenFilter,
} from '../../../openapi.constants';

import { ChannelCreateReqSchema, ChannelResSchema } from './channels.store.schemas';
import { DeviceControlCreateReqSchema, DeviceControlResSchema } from './devices.controls.store.schemas';
import { ItemIdSchema } from './types';

type ApiCreateDevice = DevicesModuleCreateDeviceSchema;
type ApiUpdateDevice = DevicesModuleUpdateDeviceSchema;
type ApiDevice = DevicesModuleDeviceSchema;

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
	hidden: z.boolean().default(false),
	hiddenBy: z.nativeEnum(DevicesModuleDeviceHiddenBy).nullable().default(null),
	roomId: z.string().uuid().nullable().default(null),
	zoneIds: z.array(z.string().uuid()).default([]),
	status: z
		.object({
			online: z.boolean().default(false),
			status: z.nativeEnum(DevicesModuleDeviceConnectionStatus).default(DevicesModuleDeviceConnectionStatus.unknown),
			lastChanged: z
				.union([z.string().datetime({ offset: true }), z.date()])
				.transform((date) => (date instanceof Date ? date : new Date(date)))
				.nullable()
				.default(null),
		})
		.default({ online: false, status: DevicesModuleDeviceConnectionStatus.unknown, lastChanged: null }),
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
	data: z.looseObject({}),
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
			roomId: z.string().uuid().nullable().optional(),
			status: z.object({
				online: z.boolean(),
				status: z.nativeEnum(DevicesModuleDeviceConnectionStatus),
				lastChanged: z
					.union([z.string().datetime({ offset: true }), z.date()])
					.transform((date) => (date instanceof Date ? date : new Date(date)))
					.nullable()
					.optional(),
			}),
		})
		.catchall(z.unknown()),
});

export const DevicesUnsetActionPayloadSchema = z.object({
	id: ItemIdSchema,
});

export const DevicesGetActionPayloadSchema = z.object({
	id: ItemIdSchema,
});

export const DevicesFetchActionPayloadSchema = z.object({
	hidden: z.nativeEnum(DevicesModuleDevicesHiddenFilter).optional(),
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
			roomId: z.string().uuid().nullable().optional(),
		})
		.catchall(z.unknown()),
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
			roomId: z.string().uuid().nullable().optional(),
		})
		.catchall(z.unknown()),
});

export const DevicesSaveActionPayloadSchema = z.object({
	id: ItemIdSchema,
});

export const DevicesRemoveActionPayloadSchema = z.object({
	id: ItemIdSchema,
});

export const DevicesAddZoneActionPayloadSchema = z.object({
	id: ItemIdSchema,
	zoneId: z.string().uuid(),
});

export const DevicesRemoveZoneActionPayloadSchema = z.object({
	id: ItemIdSchema,
	zoneId: z.string().uuid(),
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
	room_id: z.string().uuid().nullable().optional(),
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
	// Without these two, `transformDeviceUpdateRequest` silently drops them: `.safeParse()` strips any
	// key a Zod object schema does not declare, so a caller sending `{ hidden: true, hidden_by: 'system' }`
	// (e.g. the virtual device wizard's review step hiding a source device) would see the request
	// "succeed" while the outgoing PATCH body carried neither field, and the device would stay visible.
	hidden: z.boolean().optional(),
	hidden_by: z.nativeEnum(DevicesModuleDeviceHiddenBy).optional(),
	room_id: z.string().uuid().nullable().optional(),
});

export const DeviceResSchema: ZodType<ApiDevice> = z.object({
	id: z.string().uuid(),
	type: z.string(),
	category: z.nativeEnum(DevicesModuleDeviceCategory),
	identifier: z.string().trim().nonempty().nullable(),
	name: z.string().trim().nonempty(),
	description: z.string().trim().nullable(),
	enabled: z.boolean(),
	hidden: z.boolean(),
	// `.optional()`, not `.nullable()`: the generated `ApiDevice.hidden_by` type loses the `| null`
	// that the OpenAPI spec declares (nullable enum) because openapi-typescript does not append it
	// to enum-referencing properties (see the `variant` field on the reTerminal plugin's device
	// schema for the same quirk). Matching that exact shape keeps this assignable to `ZodType<ApiDevice>`
	// in both directions; the internal `DeviceSchema.hiddenBy` below is unconstrained and stays nullable.
	hidden_by: z.nativeEnum(DevicesModuleDeviceHiddenBy).optional(),
	room_id: z.string().uuid().nullable(),
	zone_ids: z.array(z.string().uuid()),
	status: z.object({
		online: z.boolean(),
		status: z.nativeEnum(DevicesModuleDeviceConnectionStatus),
		last_changed: z.string().datetime({ offset: true }).nullable().optional(),
	}),
	created_at: z.string().date(),
	updated_at: z.string().date().nullable(),
	controls: z.array(DeviceControlResSchema),
	channels: z.array(ChannelResSchema),
});

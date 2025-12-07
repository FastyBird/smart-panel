import { v4 as uuid } from 'uuid';
import { z } from 'zod';

// Note: Display instances have been consolidated into the DisplaysModule
// These types are kept for backward compatibility but now map to the unified Display entity

export const DisplayIdSchema = z.string().uuid();

// STORE STATE
// ===========

export const DisplayInstanceSchema = z.object({
	id: DisplayIdSchema,
	draft: z.boolean().default(false),
	uid: z.string().uuid(),
	mac: z.string().trim().nonempty(),
	version: z.string().trim().nonempty(),
	build: z.string().trim(),
	// Note: user is no longer tied to display in DisplaysModule, allow empty string
	user: z.string(),
	displayProfile: z.string().uuid().nullable().default(null),
	createdAt: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
	updatedAt: z
		.union([z.string().datetime({ offset: true }), z.date()])
		.transform((date) => (date instanceof Date ? date : new Date(date)))
		.optional()
		.nullable()
		.default(null),
});

export const DisplaysInstancesStateSemaphoreSchema = z.object({
	fetching: z.object({
		items: z.boolean().default(false),
		item: z.array(DisplayIdSchema),
	}),
	creating: z.array(DisplayIdSchema),
	updating: z.array(DisplayIdSchema),
	deleting: z.array(DisplayIdSchema),
});

// STORE ACTIONS
// =============

export const DisplaysInstancesOnEventActionPayloadSchema = z.object({
	id: DisplayIdSchema,
	data: z.object({}),
});

export const DisplaysInstancesSetActionPayloadSchema = z.object({
	id: DisplayIdSchema,
	data: z.object({
		uid: z.string().uuid(),
		mac: z.string().trim().nonempty(),
		version: z.string().trim().nonempty(),
		build: z.string().trim().nonempty(),
		user: z.string().uuid(),
		displayProfile: z.string().uuid().nullable().default(null),
	}),
});

export const DisplaysInstancesUnsetActionPayloadSchema = z.object({
	id: DisplayIdSchema,
});

export const DisplaysInstancesGetActionPayloadSchema = z.object({
	id: DisplayIdSchema,
});

export const DisplaysInstancesAddActionPayloadSchema = z.object({
	id: DisplayIdSchema.optional().default(uuid()),
	draft: z.boolean().optional().default(false),
	data: z.object({
		uid: z.string().uuid(),
		mac: z.string().trim().nonempty(),
		version: z.string().trim().nonempty(),
		build: z.string().trim().nonempty(),
		user: z.string().uuid(),
	}),
});

export const DisplaysInstancesEditActionPayloadSchema = z.object({
	id: DisplayIdSchema,
	data: z.object({
		version: z.string().trim().nonempty().optional(),
		build: z.string().trim().nonempty().optional(),
		displayProfile: z.string().uuid().nullable().optional(),
	}),
});

export const DisplaysInstancesSaveActionPayloadSchema = z.object({
	id: DisplayIdSchema,
});

export const DisplaysInstancesRemoveActionPayloadSchema = z.object({
	id: DisplayIdSchema,
});

// BACKEND API
// ===========
// Note: These now map to the DisplaysModule API types

export const DisplayInstanceCreateReqSchema = z.object({
	mac_address: z.string().trim().nonempty(),
	version: z.string().trim().nonempty(),
	build: z.string().trim().nonempty().optional(),
	screen_width: z.number().optional(),
	screen_height: z.number().optional(),
	pixel_ratio: z.number().optional(),
	unit_size: z.number().optional(),
	rows: z.number().optional(),
	cols: z.number().optional(),
});

export const DisplayInstanceUpdateReqSchema = z.object({
	name: z.string().trim().optional(),
	dark_mode: z.boolean().optional(),
	brightness: z.number().min(0).max(100).optional(),
	screen_lock_duration: z.number().optional(),
	screen_saver: z.boolean().optional(),
	version: z.string().trim().nonempty().optional(),
	build: z.string().trim().nonempty().optional(),
});

export const DisplayInstanceResSchema = z.object({
	id: z.string().uuid(),
	mac_address: z.string().trim().nonempty(),
	name: z.string().nullable().optional().default(null),
	version: z.string().trim().nonempty(),
	build: z.string().trim().nonempty().nullable().optional().default(null),
	screen_width: z.number(),
	screen_height: z.number(),
	pixel_ratio: z.number(),
	unit_size: z.number(),
	rows: z.number(),
	cols: z.number(),
	dark_mode: z.boolean(),
	brightness: z.number(),
	screen_lock_duration: z.number(),
	screen_saver: z.boolean(),
	created_at: z.string(),
	updated_at: z.string().nullable().optional().default(null),
});

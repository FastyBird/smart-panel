import { v4 as uuid } from 'uuid';
import { z } from 'zod';

// Note: Display profiles have been consolidated into the DisplaysModule
// These types are kept for backward compatibility but now map to the unified Display entity

export const DisplayProfileIdSchema = z.string().uuid();

// STORE STATE
// ===========

export const DisplayProfileSchema = z.object({
	id: DisplayProfileIdSchema,
	uid: z.string().uuid(),
	screenWidth: z.number(),
	screenHeight: z.number(),
	pixelRatio: z.number(),
	unitSize: z.number(),
	rows: z.number(),
	cols: z.number(),
	primary: z.boolean(),
	createdAt: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
	updatedAt: z
		.union([z.string().datetime({ offset: true }), z.date()])
		.transform((date) => (date instanceof Date ? date : new Date(date)))
		.optional()
		.nullable()
		.default(null),
});

export const DisplaysProfilesStateSemaphoreSchema = z.object({
	fetching: z.object({
		items: z.boolean().default(false),
		item: z.array(DisplayProfileIdSchema),
	}),
	creating: z.array(DisplayProfileIdSchema),
	updating: z.array(DisplayProfileIdSchema),
	deleting: z.array(DisplayProfileIdSchema),
});

// STORE ACTIONS
// =============

export const DisplaysProfilesOnEventActionPayloadSchema = z.object({
	id: DisplayProfileIdSchema,
	data: z.object({}),
});

export const DisplaysProfilesSetActionPayloadSchema = z.object({
	id: DisplayProfileIdSchema,
	data: z.object({
		uid: z.string().uuid(),
		screenWidth: z.number(),
		screenHeight: z.number(),
		pixelRatio: z.number(),
		unitSize: z.number(),
		rows: z.number(),
		cols: z.number(),
		primary: z.boolean(),
	}),
});

export const DisplaysProfilesUnsetActionPayloadSchema = z.object({
	id: DisplayProfileIdSchema,
});

export const DisplaysProfilesGetActionPayloadSchema = z.object({
	id: DisplayProfileIdSchema,
});

export const DisplaysProfilesAddActionPayloadSchema = z.object({
	id: DisplayProfileIdSchema.optional().default(uuid()),
	data: z.object({
		uid: z.string().uuid(),
		screenWidth: z.number(),
		screenHeight: z.number(),
		pixelRatio: z.number(),
		unitSize: z.number(),
		rows: z.number().optional(),
		cols: z.number().optional(),
		primary: z.boolean().optional(),
	}),
});

export const DisplaysProfilesEditActionPayloadSchema = z.object({
	id: DisplayProfileIdSchema,
	data: z.object({
		unitSize: z.number().optional(),
		rows: z.number().optional(),
		cols: z.number().optional(),
		primary: z.boolean().optional(),
	}),
});

export const DisplaysProfilesSaveActionPayloadSchema = z.object({
	id: DisplayProfileIdSchema,
});

export const DisplaysProfilesRemoveActionPayloadSchema = z.object({
	id: DisplayProfileIdSchema,
});

// BACKEND API
// ===========
// Note: These now map to the DisplaysModule API types

export const DisplayProfileCreateReqSchema = z.object({
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

export const DisplayProfileUpdateReqSchema = z.object({
	name: z.string().trim().optional(),
	dark_mode: z.boolean().optional(),
	brightness: z.number().min(0).max(100).optional(),
	screen_lock_duration: z.number().optional(),
	screen_saver: z.boolean().optional(),
	unit_size: z.number().optional(),
	rows: z.number().optional(),
	cols: z.number().optional(),
});

export const DisplayProfileResSchema = z.object({
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

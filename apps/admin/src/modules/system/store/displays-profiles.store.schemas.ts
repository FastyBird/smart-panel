import { v4 as uuid } from 'uuid';
import { type ZodType, z } from 'zod';

import { type components } from '../../../openapi';

type ApiCreateDisplay = components['schemas']['SystemModuleCreateDisplayProfile'];
type ApiUpdateDisplay = components['schemas']['SystemModuleUpdateDisplayProfile'];
type ApiDisplay = components['schemas']['SystemModuleDisplayProfile'];

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

export const DisplayProfileCreateReqSchema: ZodType<ApiCreateDisplay> = z.object({
	id: z.string().uuid().optional(),
	uid: z.string().uuid(),
	screen_width: z.number(),
	screen_height: z.number(),
	pixel_ratio: z.number(),
	unit_size: z.number(),
	rows: z.number(),
	cols: z.number(),
	primary: z.boolean().optional(),
});

export const DisplayProfileUpdateReqSchema: ZodType<ApiUpdateDisplay> = z.object({
	unit_size: z.number().optional(),
	rows: z.number().optional(),
	cols: z.number().optional(),
	primary: z.boolean().optional(),
});

export const DisplayProfileResSchema: ZodType<ApiDisplay> = z.object({
	id: z.string().uuid(),
	uid: z.string().uuid(),
	screen_width: z.number(),
	screen_height: z.number(),
	pixel_ratio: z.number(),
	unit_size: z.number(),
	rows: z.number(),
	cols: z.number(),
	primary: z.boolean(),
	created_at: z.string().date(),
	updated_at: z.string().date().nullable(),
});

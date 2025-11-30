import { v4 as uuid } from 'uuid';
import { type ZodType, z } from 'zod';

import { type components } from '../../../openapi';

type ApiCreateDisplayInstance = components['schemas']['UsersModuleCreateDisplayInstance'];
type ApiUpdateDisplayInstance = components['schemas']['UsersModuleUpdateDisplayInstance'];
type ApiDisplayInstance = components['schemas']['UsersModuleDataDisplayInstance'];

export const DisplayIdSchema = z.string().uuid();

// STORE STATE
// ===========

export const DisplayInstanceSchema = z.object({
	id: DisplayIdSchema,
	draft: z.boolean().default(false),
	uid: z.string().uuid(),
	mac: z.string().trim().nonempty(),
	version: z.string().trim().nonempty(),
	build: z.string().trim().nonempty(),
	user: z.string().uuid(),
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

export const DisplayInstanceCreateReqSchema: ZodType<ApiCreateDisplayInstance> = z.object({
	id: z.string().uuid().optional(),
	uid: z.string().uuid(),
	mac: z.string().trim().nonempty(),
	version: z.string().trim().nonempty(),
	build: z.string().trim().nonempty(),
	user: z.string().uuid(),
	display_profile: z.string().uuid().nullable().optional(),
});

export const DisplayInstanceUpdateReqSchema: ZodType<ApiUpdateDisplayInstance> = z.object({
	version: z.string().trim().nonempty().optional(),
	build: z.string().trim().nonempty().optional(),
});

export const DisplayInstanceResSchema: ZodType<ApiDisplayInstance> = z.object({
	id: z.string().uuid(),
	uid: z.string().uuid(),
	mac: z.string().trim().nonempty(),
	version: z.string().trim().nonempty(),
	build: z.string().trim().nonempty(),
	user: z.string().uuid(),
	displayProfile: z.string().uuid().nullable(),
	created_at: z.string().date(),
	updated_at: z.string().date().nullable(),
});

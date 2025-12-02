import { v4 as uuid } from 'uuid';
import { type ZodType, z } from 'zod';

import type {
	UsersModuleCreateUserSchema,
	UsersModuleUpdateUserSchema,
	UsersModuleUserSchema,
} from '../../../openapi.constants';
import { UsersModuleUserRole } from '../../../openapi.constants';

type ApiCreateUser = UsersModuleCreateUserSchema;
type ApiUpdateUser = UsersModuleUpdateUserSchema;
type ApiUser = UsersModuleUserSchema;

export const UserIdSchema = z.string().uuid();

// STORE STATE
// ===========

export const UserSchema = z.object({
	id: UserIdSchema,
	draft: z.boolean().default(false),
	isHidden: z.boolean().default(false),
	username: z.string().trim().nonempty(),
	password: z.string().trim().optional(),
	email: z.string().email().nullable().default(null),
	firstName: z.string().nullable().default(null),
	lastName: z.string().nullable().default(null),
	role: z.nativeEnum(UsersModuleUserRole).default(UsersModuleUserRole.user),
	createdAt: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
	updatedAt: z
		.union([z.string().datetime({ offset: true }), z.date()])
		.transform((date) => (date instanceof Date ? date : new Date(date)))
		.optional()
		.nullable()
		.default(null),
});

export const UsersStateSemaphoreSchema = z.object({
	fetching: z.object({
		items: z.boolean().default(false),
		item: z.array(UserIdSchema),
	}),
	creating: z.array(UserIdSchema),
	updating: z.array(UserIdSchema),
	deleting: z.array(UserIdSchema),
});

// STORE ACTIONS
// =============

export const UsersOnEventActionPayloadSchema = z.object({
	id: UserIdSchema,
	data: z.object({}),
});

export const UsersSetActionPayloadSchema = z.object({
	id: UserIdSchema,
	data: z.object({
		username: z.string().trim().nonempty(),
		email: z
			.string()
			.email()
			.trim()
			.transform((val) => (val === '' ? null : val))
			.nullable(),
		firstName: z
			.string()
			.trim()
			.transform((val) => (val === '' ? null : val))
			.nullable(),
		lastName: z
			.string()
			.trim()
			.transform((val) => (val === '' ? null : val))
			.nullable(),
		role: z.nativeEnum(UsersModuleUserRole).default(UsersModuleUserRole.user),
	}),
});

export const UsersUnsetActionPayloadSchema = z.object({
	id: UserIdSchema,
});

export const UsersGetActionPayloadSchema = z.object({
	id: UserIdSchema,
});

export const UsersAddActionPayloadSchema = z.object({
	id: UserIdSchema.optional().default(uuid()),
	draft: z.boolean().optional().default(false),
	data: z.object({
		username: z.string().trim().nonempty(),
		password: z.string().trim().nonempty(),
		email: z
			.string()
			.email()
			.trim()
			.transform((val) => (val === '' ? null : val))
			.nullable()
			.optional(),
		firstName: z
			.string()
			.trim()
			.transform((val) => (val === '' ? null : val))
			.nullable()
			.optional(),
		lastName: z
			.string()
			.trim()
			.transform((val) => (val === '' ? null : val))
			.nullable()
			.optional(),
		role: z.nativeEnum(UsersModuleUserRole).default(UsersModuleUserRole.user),
	}),
});

export const UsersEditActionPayloadSchema = z.object({
	id: UserIdSchema,
	data: z.object({
		username: z.string().trim().optional(),
		password: z.string().trim().optional(),
		email: z
			.string()
			.email()
			.trim()
			.transform((val) => (val === '' ? null : val))
			.nullable()
			.optional(),
		firstName: z
			.string()
			.trim()
			.transform((val) => (val === '' ? null : val))
			.nullable()
			.optional(),
		lastName: z
			.string()
			.trim()
			.transform((val) => (val === '' ? null : val))
			.nullable()
			.optional(),
		role: z.nativeEnum(UsersModuleUserRole).optional(),
	}),
});

export const UsersSaveActionPayloadSchema = z.object({
	id: UserIdSchema,
});

export const UsersRemoveActionPayloadSchema = z.object({
	id: UserIdSchema,
});

// BACKEND API
// ===========

export const UserCreateReqSchema: ZodType<ApiCreateUser> = z.object({
	id: z.string().uuid().optional(),
	username: z.string().trim().nonempty(),
	password: z.string().trim().nonempty(),
	email: z
		.string()
		.email()
		.trim()
		.transform((val) => (val === '' ? null : val))
		.nullable()
		.optional(),
	first_name: z
		.string()
		.trim()
		.transform((val) => (val === '' ? null : val))
		.nullable()
		.optional(),
	last_name: z
		.string()
		.trim()
		.transform((val) => (val === '' ? null : val))
		.nullable()
		.optional(),
	role: z.nativeEnum(UsersModuleUserRole).optional(),
});

export const UserUpdateReqSchema: ZodType<ApiUpdateUser> = z.object({
	username: z.string().trim().nonempty().optional(),
	password: z.string().trim().nonempty().optional(),
	email: z
		.string()
		.email()
		.trim()
		.transform((val) => (val === '' ? null : val))
		.nullable()
		.optional(),
	first_name: z
		.string()
		.trim()
		.transform((val) => (val === '' ? null : val))
		.nullable()
		.optional(),
	last_name: z
		.string()
		.trim()
		.transform((val) => (val === '' ? null : val))
		.nullable()
		.optional(),
	role: z.nativeEnum(UsersModuleUserRole).optional(),
});

export const UserResSchema: ZodType<ApiUser> = z.object({
	id: z.string().uuid(),
	username: z.string().trim().nonempty(),
	email: z.string().email().trim().nullable(),
	first_name: z.string().trim().nullable(),
	last_name: z.string().trim().nullable(),
	is_hidden: z.boolean(),
	role: z.nativeEnum(UsersModuleUserRole),
	created_at: z.string().date(),
	updated_at: z.string().date().nullable(),
});

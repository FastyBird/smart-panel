import type { Ref } from 'vue';

import type { Store } from 'pinia';

import { v4 as uuid } from 'uuid';
import { type ZodType, z } from 'zod';

import { UsersUserRole, type components } from '../../../openapi';

type ApiCreateUser = components['schemas']['UsersCreateUser'];
type ApiUpdateUser = components['schemas']['UsersUpdateUser'];
type ApiUser = components['schemas']['UsersUser'];

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
	role: z.nativeEnum(UsersUserRole).default(UsersUserRole.user),
	createdAt: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
	updatedAt: z
		.union([z.string().datetime({ offset: true }), z.date()])
		.transform((date) => (date instanceof Date ? date : new Date(date)))
		.optional()
		.nullable()
		.default(null),
});
export type IUser = z.infer<typeof UserSchema>;

export const UsersStateSemaphoreSchema = z.object({
	fetching: z.object({
		items: z.boolean().default(false),
		item: z.array(UserIdSchema),
	}),
	creating: z.array(UserIdSchema),
	updating: z.array(UserIdSchema),
	deleting: z.array(UserIdSchema),
});
export type IUsersStateSemaphore = z.infer<typeof UsersStateSemaphoreSchema>;

// STORE ACTIONS
// =============

export const UsersGetActionPayloadSchema = z.object({
	id: UserIdSchema,
});
export type IUsersGetActionPayload = z.infer<typeof UsersGetActionPayloadSchema>;

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
		role: z.nativeEnum(UsersUserRole).default(UsersUserRole.user),
	}),
});
export type IUsersAddActionPayload = z.infer<typeof UsersAddActionPayloadSchema>;

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
		role: z.nativeEnum(UsersUserRole).optional(),
	}),
});
export type IUsersEditActionPayload = z.infer<typeof UsersEditActionPayloadSchema>;

export const UsersSaveActionPayloadSchema = z.object({
	id: UserIdSchema,
});
export type IUsersSaveActionPayload = z.infer<typeof UsersSaveActionPayloadSchema>;

export const UsersRemoveActionPayloadSchema = z.object({
	id: UserIdSchema,
});
export type IUsersRemoveActionPayload = z.infer<typeof UsersRemoveActionPayloadSchema>;

// STORE
// =====

export interface IUsersStoreState {
	data: Ref<{ [key: IUser['id']]: IUser }>;
	semaphore: Ref<IUsersStateSemaphore>;
	firstLoad: Ref<boolean>;
}

export interface IUsersStoreActions {
	// Getters
	firstLoadFinished: () => boolean;
	getting: (id: IUser['id']) => boolean;
	fetching: () => boolean;
	findById: (id: IUser['id']) => IUser | null;
	findAll: () => IUser[];
	// Actions
	get: (payload: IUsersGetActionPayload) => Promise<IUser>;
	fetch: () => Promise<IUser[]>;
	add: (payload: IUsersAddActionPayload) => Promise<IUser>;
	edit: (payload: IUsersEditActionPayload) => Promise<IUser>;
	save: (payload: IUsersSaveActionPayload) => Promise<IUser>;
	remove: (payload: IUsersRemoveActionPayload) => Promise<boolean>;
}

export type UsersStoreSetup = IUsersStoreState & IUsersStoreActions;

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
	role: z.nativeEnum(UsersUserRole).optional(),
});
export type IUserCreateReq = z.infer<typeof UserCreateReqSchema>;

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
	role: z.nativeEnum(UsersUserRole).optional(),
});
export type IUserUpdateReq = z.infer<typeof UserUpdateReqSchema>;

export const UserResSchema: ZodType<ApiUser> = z.object({
	id: z.string().uuid(),
	username: z.string().trim().nonempty(),
	email: z.string().email().trim().nullable(),
	first_name: z.string().trim().nullable(),
	last_name: z.string().trim().nullable(),
	is_hidden: z.boolean(),
	role: z.nativeEnum(UsersUserRole),
	created_at: z.string().date(),
	updated_at: z.string().date().nullable(),
});
export type IUserRes = z.infer<typeof UserResSchema>;

// STORE
export type UsersStore = Store<string, IUsersStoreState, object, IUsersStoreActions>;

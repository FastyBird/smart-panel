import type { Ref } from 'vue';

import type { Store } from 'pinia';

import { z } from 'zod';

import {
	UserCreateReqSchema,
	UserResSchema,
	UserSchema,
	UserUpdateReqSchema,
	UsersAddActionPayloadSchema,
	UsersEditActionPayloadSchema,
	UsersGetActionPayloadSchema,
	UsersRemoveActionPayloadSchema,
	UsersSaveActionPayloadSchema,
	UsersStateSemaphoreSchema,
} from './users.store.schemas';

export const UserIdSchema = z.string().uuid();

// STORE STATE
// ===========

export type IUser = z.infer<typeof UserSchema>;

export type IUsersStateSemaphore = z.infer<typeof UsersStateSemaphoreSchema>;

// STORE ACTIONS
// =============

export type IUsersGetActionPayload = z.infer<typeof UsersGetActionPayloadSchema>;

export type IUsersAddActionPayload = z.infer<typeof UsersAddActionPayloadSchema>;

export type IUsersEditActionPayload = z.infer<typeof UsersEditActionPayloadSchema>;

export type IUsersSaveActionPayload = z.infer<typeof UsersSaveActionPayloadSchema>;

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

export type IUserCreateReq = z.infer<typeof UserCreateReqSchema>;

export type IUserUpdateReq = z.infer<typeof UserUpdateReqSchema>;

export type IUserRes = z.infer<typeof UserResSchema>;

// STORE
export type UsersStore = Store<string, IUsersStoreState, object, IUsersStoreActions>;

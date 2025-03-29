import type { Ref } from 'vue';

import type { Store } from 'pinia';

import { type ZodType, z } from 'zod';

import { UsersUserRole, type components } from '../../../openapi';
import { type IUser } from '../../users';
import { AccessTokenType } from '../auth.constants';

type ApiLogin = components['schemas']['AuthLogin'];
type ApiTokenPair = components['schemas']['AuthTokenPair'];

export const TokenPayloadSchema = z.object({
	sub: z.string().uuid(),
	role: z.nativeEnum(UsersUserRole),
	exp: z.number(),
	iat: z.number(),
	jti: z.string().uuid(),
});
export type ITokenPayload = z.infer<typeof TokenPayloadSchema>;

// STORE STATE
// ===========

export const TokenPairSchema = z.object({
	accessToken: z.string().trim().min(1),
	refreshToken: z.string().trim().min(1),
	expiration: z.union([z.string(), z.number(), z.date(), z.null()]).transform((val) => (val ? new Date(val) : null)),
	type: z.nativeEnum(AccessTokenType),
});
export type ITokenPair = z.infer<typeof TokenPairSchema>;

export const SessionStateSemaphoreSchema = z.object({
	fetching: z.boolean().default(false),
	creating: z.boolean().default(false),
	updating: z.boolean().default(false),
});
export type ISessionStateSemaphore = z.infer<typeof SessionStateSemaphoreSchema>;

// STORE ACTIONS
// =============

export const SessionCreateActionPayloadSchema = z.object({
	data: z.object({
		username: z.string().trim().min(1),
		password: z.string().trim().min(1),
	}),
});
export type ISessionCreateActionPayload = z.infer<typeof SessionCreateActionPayloadSchema>;

export const SessionEditActionPayloadSchema = z.object({
	id: z.string().uuid(),
	data: z.object({
		firstName: z.string().nullable().optional(),
		lastName: z.string().nullable().optional(),
		email: z.string().nullable().optional(),
		password: z
			.object({
				current: z.string().trim().min(1),
				new: z.string().trim().min(1),
			})
			.optional(),
	}),
});
export type ISessionEditActionPayload = z.infer<typeof SessionEditActionPayloadSchema>;

export const SessionRegisterActionPayloadSchema = z.object({
	id: z.string().uuid().optional(),
	data: z.object({
		username: z.string().trim().min(1),
		password: z.string().trim().min(1),
		firstName: z.string().nullable().optional(),
		lastName: z.string().nullable().optional(),
		email: z.string().nullable().optional(),
	}),
});
export type ISessionRegisterActionPayload = z.infer<typeof SessionRegisterActionPayloadSchema>;

// STORE
// =====

export interface ISessionStoreState {
	profile: Ref<IUser | null>;
	tokenPair: Ref<ITokenPair | null>;
	semaphore: Ref<ISessionStateSemaphore>;
}

export interface ISessionStoreActions {
	// Getters
	accessToken: () => string | null;
	refreshToken: () => string | null;
	isSignedIn: () => boolean;
	isExpired: () => boolean;
	// Actions
	initialize: () => Promise<boolean>;
	get: () => Promise<IUser>;
	create: (payload: ISessionCreateActionPayload) => Promise<IUser>;
	edit: (payload: ISessionEditActionPayload) => Promise<boolean>;
	register: (payload: ISessionRegisterActionPayload) => Promise<boolean>;
	refresh: () => Promise<boolean>;
	clear: () => void;
}

export type SessionStoreSetup = ISessionStoreState & ISessionStoreActions;

// BACKEND API
// ===========

export const SessionLoginReqSchema: ZodType<ApiLogin> = z.object({
	username: z.string().trim().min(1),
	password: z.string().trim().min(1),
});
export type ISessionLoginReq = z.infer<typeof SessionLoginReqSchema>;

export const AuthTokenPairResSchema: ZodType<ApiTokenPair> = z.object({
	access_token: z.string().trim().min(1),
	refresh_token: z.string().trim().min(1),
	type: z.nativeEnum(AccessTokenType),
	expiration: z.string().date(),
});
export type IAuthTokenPairRes = z.infer<typeof AuthTokenPairResSchema>;

// STORE
export type SessionStore = Store<string, ISessionStoreState, object, ISessionStoreActions>;

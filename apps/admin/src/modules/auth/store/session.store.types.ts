import type { Ref } from 'vue';

import type { Store } from 'pinia';

import { z } from 'zod';

import { type IUser } from '../../users';

import {
	AuthTokenPairResSchema,
	SessionCreateActionPayloadSchema,
	SessionEditActionPayloadSchema,
	SessionLoginReqSchema,
	SessionRegisterActionPayloadSchema,
	SessionStateSemaphoreSchema,
	TokenPairSchema,
	TokenPayloadSchema,
} from './session.store.schemas';

export type ITokenPayload = z.infer<typeof TokenPayloadSchema>;

// STORE STATE
// ===========

export type ITokenPair = z.infer<typeof TokenPairSchema>;

export type ISessionStateSemaphore = z.infer<typeof SessionStateSemaphoreSchema>;

// STORE ACTIONS
// =============

export type ISessionCreateActionPayload = z.infer<typeof SessionCreateActionPayloadSchema>;

export type ISessionEditActionPayload = z.infer<typeof SessionEditActionPayloadSchema>;

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

export type ISessionLoginReq = z.infer<typeof SessionLoginReqSchema>;

export type IAuthTokenPairRes = z.infer<typeof AuthTokenPairResSchema>;

// STORE
export type SessionStore = Store<string, ISessionStoreState, object, ISessionStoreActions>;

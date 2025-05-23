import { type ZodType, z } from 'zod';

import { UsersModuleUserRole, type components } from '../../../openapi';
import { AccessTokenType } from '../auth.constants';

type ApiLogin = components['schemas']['AuthModuleLogin'];
type ApiTokenPair = components['schemas']['AuthModuleTokenPair'];

export const TokenPayloadSchema = z.object({
	sub: z.string().uuid(),
	role: z.nativeEnum(UsersModuleUserRole),
	exp: z.number(),
	iat: z.number(),
	jti: z.string().uuid(),
});

// STORE STATE
// ===========

export const TokenPairSchema = z.object({
	accessToken: z.string().trim().min(1),
	refreshToken: z.string().trim().min(1),
	expiration: z.union([z.string(), z.number(), z.date(), z.null()]).transform((val) => (val ? new Date(val) : null)),
	type: z.nativeEnum(AccessTokenType),
});

export const SessionStateSemaphoreSchema = z.object({
	fetching: z.boolean().default(false),
	creating: z.boolean().default(false),
	updating: z.boolean().default(false),
});

// STORE ACTIONS
// =============

export const SessionCreateActionPayloadSchema = z.object({
	data: z.object({
		username: z.string().trim().min(1),
		password: z.string().trim().min(1),
	}),
});

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

// BACKEND API
// ===========

export const SessionLoginReqSchema: ZodType<ApiLogin> = z.object({
	username: z.string().trim().min(1),
	password: z.string().trim().min(1),
});

export const AuthTokenPairResSchema: ZodType<ApiTokenPair> = z.object({
	access_token: z.string().trim().min(1),
	refresh_token: z.string().trim().min(1),
	type: z.nativeEnum(AccessTokenType),
	expiration: z.string().date(),
});

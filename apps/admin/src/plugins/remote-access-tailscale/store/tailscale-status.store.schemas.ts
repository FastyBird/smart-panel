import { type ZodType, z } from 'zod';

import {
	RemoteAccessAdvisoryResSchema,
	RemoteAccessAdvisorySchema,
	RemoteAccessEndpointResSchema,
	RemoteAccessEndpointSchema,
} from '../../../modules/remote-access';
import {
	RemoteAccessModuleProviderState,
	type RemoteAccessTailscalePluginInstallSchema,
	type RemoteAccessTailscalePluginLoginRequestSchema,
	type RemoteAccessTailscalePluginLoginSchema,
	RemoteAccessTailscalePluginRequirementCode,
	type RemoteAccessTailscalePluginRequirementSchema,
	type RemoteAccessTailscalePluginStatusSchema,
} from '../../../openapi.constants';

// STORE STATE
// ===========

export const TailscaleRequirementSchema = z.object({
	code: z.nativeEnum(RemoteAccessTailscalePluginRequirementCode),
	satisfied: z.boolean(),
	message: z.string(),
});

export const TailscaleStatusSchema = z.object({
	type: z.string(),
	state: z.nativeEnum(RemoteAccessModuleProviderState),
	endpoints: z.array(RemoteAccessEndpointSchema),
	message: z.string().nullable().optional(),
	details: z.record(z.string(), z.unknown()),
	proxyAddresses: z.array(z.string()),
	advisories: z.array(RemoteAccessAdvisorySchema),
	updatedAt: z.string(),
	requirements: z.array(TailscaleRequirementSchema),
	// Present only while `state` is `pending-auth` - a capability URL, never persisted anywhere
	// beyond this in-memory store (no localStorage, no request log). Cleared by
	// `applyTailscaleProviderStatusEvent` as soon as the node leaves `pending-auth`.
	authUrl: z.string().optional(),
	qr: z.string().optional(),
});

export const TailscaleLoginResultSchema = z.object({
	state: z.nativeEnum(RemoteAccessModuleProviderState),
	authUrl: z.string().optional(),
	qr: z.string().optional(),
});

export const TailscaleInstallResultSchema = z.object({
	job: z.string(),
});

// `PrivilegedJobStatus['state']` on the backend - never `'timeout'` from this event (that value
// is reserved for the worker's own hard-timeout, which does not tick a progress event).
export const TailscaleSetupProgressSchema = z.object({
	type: z.string(),
	job: z.string(),
	step: z.string().optional(),
	state: z.enum(['running', 'complete', 'failed', 'timeout']),
	message: z.string().optional(),
});

export const TailscaleStatusStateSemaphoreSchema = z.object({
	getting: z.boolean(),
	installing: z.boolean(),
	loggingIn: z.boolean(),
	loggingOut: z.boolean(),
	resettingPreferences: z.boolean(),
});

// STORE ACTIONS
// =============

export const TailscaleStatusOnEventActionPayloadSchema = z.object({
	event: z.string(),
	data: z.looseObject({}),
});

// BACKEND API
// ===========
//
// `GET /status` documents and returns the full envelope correctly
// (`RemoteAccessTailscalePluginResStatus`), so `TailscaleStatusResSchema` below both types and
// validates its `data.data` payload.
//
// `POST /install`, `/login`, `/logout` and `/reset-preferences` do not: their controller
// (`apps/backend/src/plugins/remote-access-tailscale/controllers/setup.controller.ts`) passes the
// bare `*Model` class to `@ApiSuccessResponse`/`@ApiAcceptedSuccessResponse` instead of the
// `*ResponseModel` envelope class it actually returns at runtime - unlike `StatusController`,
// which does this correctly. `openapi-typescript` therefore documents and types these four
// responses as the bare `Data*` shape, while the server actually sends the same standard
// enveloped response as every other endpoint. The store transformers for those four unwrap the
// real envelope by hand (see `tailscale-status.transformers.ts`) instead of trusting the
// generated operation type, so the `Res*` schemas below are typed against the bare `Data*`
// schema on purpose - that is genuinely what is validated once the real envelope has already
// been unwrapped one level up.

export const TailscaleRequirementResSchema: ZodType<RemoteAccessTailscalePluginRequirementSchema> = z.object({
	code: z.nativeEnum(RemoteAccessTailscalePluginRequirementCode),
	satisfied: z.boolean(),
	message: z.string(),
});

export const TailscaleStatusResSchema: ZodType<RemoteAccessTailscalePluginStatusSchema> = z.object({
	type: z.string(),
	state: z.nativeEnum(RemoteAccessModuleProviderState),
	endpoints: z.array(RemoteAccessEndpointResSchema),
	message: z.string().nullable().optional(),
	details: z.record(z.string(), z.unknown()),
	proxy_addresses: z.array(z.string()),
	advisories: z.array(RemoteAccessAdvisoryResSchema),
	updated_at: z.string(),
	requirements: z.array(TailscaleRequirementResSchema),
	auth_url: z.string().optional(),
	qr: z.string().optional(),
});

export const TailscaleLoginResultResSchema: ZodType<RemoteAccessTailscalePluginLoginSchema> = z.object({
	state: z.nativeEnum(RemoteAccessModuleProviderState),
	auth_url: z.string().optional(),
	qr: z.string().optional(),
});

export const TailscaleInstallResultResSchema: ZodType<RemoteAccessTailscalePluginInstallSchema> = z.object({
	job: z.string(),
});

// The request sent to `POST /login`. `auth_key` is a one-shot value forwarded straight through
// by `useTailscaleLogin.login()` - it is never assigned to a ref or store field, so there is
// nothing here for a persisted-secret field to be.
export const TailscaleLoginRequestSchema: ZodType<RemoteAccessTailscalePluginLoginRequestSchema> = z.object({
	auth_key: z.string().optional(),
});

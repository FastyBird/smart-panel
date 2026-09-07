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
	type RemoteAccessTailscalePluginPrivilegedSetupSchema,
	RemoteAccessTailscalePluginRequirementCode,
	type RemoteAccessTailscalePluginRequirementRemedySchema,
	type RemoteAccessTailscalePluginRequirementSchema,
	type RemoteAccessTailscalePluginSetupJobSchema,
	RemoteAccessTailscalePluginSetupJobState,
	type RemoteAccessTailscalePluginStatusSchema,
} from '../../../openapi.constants';

// STORE STATE
// ===========

// D12's manual remedy contract - exact console commands (or a documentation link) that satisfy
// one unsatisfied requirement. `commands` is empty and `note` carries a link/explanation instead
// when no exact command applies. `null` once the requirement is satisfied.
export const TailscaleRequirementRemedySchema = z.object({
	commands: z.array(z.string()),
	note: z.string().nullable().optional(),
});

export const TailscaleRequirementSchema = z.object({
	code: z.nativeEnum(RemoteAccessTailscalePluginRequirementCode),
	satisfied: z.boolean(),
	message: z.string(),
	remedy: TailscaleRequirementRemedySchema.nullable().optional(),
});

export const TailscaleSetupJobSchema = z.object({
	jobId: z.string(),
	state: z.nativeEnum(RemoteAccessTailscalePluginSetupJobState),
	step: z.string().nullable(),
	message: z.string().nullable(),
	updatedAt: z.string(),
});

export const TailscalePrivilegedSetupSchema = z.object({
	available: z.boolean(),
	reason: z.string().nullable(),
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
	// Last known privileged setup job (RA-20/D6, RA-22) - lets the setup wizard poll `GET /status`
	// as a fallback to the `Setup.Progress` websocket event, and resume its progress view purely
	// from this field after a page reload. The backend model types this `T | null` and
	// unconditionally assigns it (`null` once no job has run yet in this process) - `snakeToCamel`
	// preserves that literal `null`, so this MUST be `.nullable()` here, even though the generated
	// wire type (`setup?: T`, no null member - see the note on `TailscaleStatusResSchema.setup`
	// below) would let `.optional()` alone type-check. Getting this wrong makes `.safeParse()`
	// reject every `GET /status` response from a node that has never run a setup job.
	setup: TailscaleSetupJobSchema.nullable().optional(),
	privilegedSetup: TailscalePrivilegedSetupSchema,
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
// All five endpoints (`GET /status`, `POST /install`, `/login`, `/logout`,
// `/reset-preferences`) correctly document and return the full envelope
// (`RemoteAccessTailscalePluginRes*`), so `apiResponse.data.data` in the store is already typed
// as the shape below - no manual envelope unwrapping needed. The `Res*` schemas here are
// `ZodType<GeneratedWireType>` compile-time anchors only, never `.safeParse()`d themselves (see
// the note above STORE STATE); the store transformers parse the camelCase `TailscaleStatusSchema`
// and friends instead, fed by `snakeToCamel()` on the real `.data` payload.

export const TailscaleRequirementRemedyResSchema: ZodType<RemoteAccessTailscalePluginRequirementRemedySchema> = z.object({
	commands: z.array(z.string()),
	note: z.string().nullable().optional(),
});

export const TailscaleRequirementResSchema: ZodType<RemoteAccessTailscalePluginRequirementSchema> = z.object({
	code: z.nativeEnum(RemoteAccessTailscalePluginRequirementCode),
	satisfied: z.boolean(),
	message: z.string(),
	// `.optional()` only, matching the generated (non-nullable) wire type - same reasoning as
	// `TailscaleStatusResSchema.setup` below. This schema is a compile-time anchor only, never
	// `.safeParse()`d (see the note above STORE STATE), so it never hits the runtime-null bug the
	// camelCase `TailscaleRequirementSchema.remedy` above has to guard against.
	remedy: TailscaleRequirementRemedyResSchema.optional(),
});

export const TailscaleSetupJobResSchema: ZodType<RemoteAccessTailscalePluginSetupJobSchema> = z.object({
	job_id: z.string(),
	state: z.nativeEnum(RemoteAccessTailscalePluginSetupJobState),
	step: z.string().nullable(),
	message: z.string().nullable(),
	updated_at: z.string(),
});

export const TailscalePrivilegedSetupResSchema: ZodType<RemoteAccessTailscalePluginPrivilegedSetupSchema> = z.object({
	available: z.boolean(),
	reason: z.string().nullable(),
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
	// See the note on `TailscaleStatusSchema.setup` above - `.optional()` only, matching the
	// generated (non-nullable) wire type.
	setup: TailscaleSetupJobResSchema.optional(),
	privileged_setup: TailscalePrivilegedSetupResSchema,
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

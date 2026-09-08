import { type ZodType, z } from 'zod';

import {
	RemoteAccessAdvisoryResSchema,
	RemoteAccessAdvisorySchema,
	RemoteAccessEndpointResSchema,
	RemoteAccessEndpointSchema,
} from '../../../modules/remote-access';
import {
	type RemoteAccessCloudflareTunnelPluginInstallSchema,
	type RemoteAccessCloudflareTunnelPluginPrivilegedSetupSchema,
	RemoteAccessCloudflareTunnelPluginRequirementCode,
	type RemoteAccessCloudflareTunnelPluginRequirementRemedySchema,
	type RemoteAccessCloudflareTunnelPluginRequirementSchema,
	type RemoteAccessCloudflareTunnelPluginSetupJobSchema,
	// `--dedupe-enums` merged the setup-job `state` enum into the Tailscale plugin's own generated
	// enum, since the two are structurally identical (`running` | `complete` | `failed` |
	// `timeout`) - see the comment above this alias in `openapi.constants.ts`. Reused here rather
	// than a second, redundant one.
	RemoteAccessTailscalePluginSetupJobState as RemoteAccessCloudflareTunnelPluginSetupJobState,
	type RemoteAccessCloudflareTunnelPluginStatusSchema,
	RemoteAccessModuleProviderState,
} from '../../../openapi.constants';

// STORE STATE
// ===========

// D12's manual remedy contract - exact console commands (or a documentation link) that satisfy
// one unsatisfied requirement. `commands` is empty and `note` carries a link/explanation instead
// when no exact command applies. `null` once the requirement is satisfied - mirrors
// `TailscaleRequirementRemedySchema` exactly.
export const CloudflareTunnelRequirementRemedySchema = z.object({
	commands: z.array(z.string()),
	note: z.string().nullable().optional(),
});

export const CloudflareTunnelRequirementSchema = z.object({
	code: z.nativeEnum(RemoteAccessCloudflareTunnelPluginRequirementCode),
	satisfied: z.boolean(),
	message: z.string(),
	remedy: CloudflareTunnelRequirementRemedySchema.nullable().optional(),
});

export const CloudflareTunnelSetupJobSchema = z.object({
	jobId: z.string(),
	state: z.nativeEnum(RemoteAccessCloudflareTunnelPluginSetupJobState),
	step: z.string().nullable(),
	message: z.string().nullable(),
	updatedAt: z.string(),
});

export const CloudflareTunnelPrivilegedSetupSchema = z.object({
	available: z.boolean(),
	reason: z.string().nullable(),
});

export const CloudflareTunnelStatusSchema = z.object({
	type: z.string(),
	state: z.nativeEnum(RemoteAccessModuleProviderState),
	endpoints: z.array(RemoteAccessEndpointSchema),
	message: z.string().nullable().optional(),
	details: z.record(z.string(), z.unknown()),
	proxyAddresses: z.array(z.string()),
	advisories: z.array(RemoteAccessAdvisorySchema),
	updatedAt: z.string(),
	requirements: z.array(CloudflareTunnelRequirementSchema),
	// Present only once a privileged setup job has run at least once in this backend process - the
	// backend model types this `T | null` and unconditionally assigns it (`null` when no job has
	// run yet), and `snakeToCamel` preserves that literal `null`. This MUST be `.nullable()` here,
	// even though the generated wire type (`setup?: T`, no null member - see the note on
	// `CloudflareTunnelStatusResSchema.setup` below) would let `.optional()` alone type-check.
	// Getting this wrong is the exact shipped bug `tailscale-status.store.schemas.ts` had (a fresh
	// node's `GET /status` failing `.safeParse()` silently) - guarded against here deliberately.
	setup: CloudflareTunnelSetupJobSchema.nullable().optional(),
	// `privileged_setup` is always present (never optional) on the backend model
	// (`RemoteAccessCloudflareTunnelPluginStatusModel.privilegedSetup` is a plain `@ApiProperty`,
	// not `@ApiPropertyOptional`) - required here too.
	privilegedSetup: CloudflareTunnelPrivilegedSetupSchema,
});

export const CloudflareTunnelInstallResultSchema = z.object({
	job: z.string(),
});

// `PrivilegedJobStatus['state']` on the backend - never `'timeout'` from this event (that value
// is reserved for the worker's own hard-timeout, which does not tick a progress event). Mirrors
// `TailscaleSetupProgressSchema`.
export const CloudflareTunnelSetupProgressSchema = z.object({
	type: z.string(),
	job: z.string(),
	step: z.string().optional(),
	state: z.enum(['running', 'complete', 'failed', 'timeout']),
	message: z.string().optional(),
});

export const CloudflareTunnelStatusStateSemaphoreSchema = z.object({
	getting: z.boolean(),
	installing: z.boolean(),
	resetting: z.boolean(),
});

// STORE ACTIONS
// =============

export const CloudflareTunnelStatusOnEventActionPayloadSchema = z.object({
	event: z.string(),
	data: z.looseObject({}),
});

// BACKEND API
// ===========
//
// All three endpoints (`GET /status`, `POST /install`, `POST /reset`) correctly document and
// return the full envelope (`RemoteAccessCloudflareTunnelPluginRes*`), so `apiResponse.data.data`
// in the store is already typed as the shape below - no manual envelope unwrapping needed. The
// `Res*` schemas here are `ZodType<GeneratedWireType>` compile-time anchors only, never
// `.safeParse()`d themselves (see the note above STORE STATE); the store transformers parse the
// camelCase `CloudflareTunnelStatusSchema` and friends instead, fed by `snakeToCamel()` on the
// real `.data` payload. Mirrors the Tailscale plugin's own "BACKEND API" section.

export const CloudflareTunnelRequirementRemedyResSchema: ZodType<RemoteAccessCloudflareTunnelPluginRequirementRemedySchema> = z.object({
	commands: z.array(z.string()),
	note: z.string().nullable().optional(),
});

export const CloudflareTunnelRequirementResSchema: ZodType<RemoteAccessCloudflareTunnelPluginRequirementSchema> = z.object({
	code: z.nativeEnum(RemoteAccessCloudflareTunnelPluginRequirementCode),
	satisfied: z.boolean(),
	message: z.string(),
	// `.optional()` only, matching the generated (non-nullable) wire type - same reasoning as
	// `CloudflareTunnelStatusResSchema.setup` below. This schema is a compile-time anchor only,
	// never `.safeParse()`d (see the note above STORE STATE), so it never hits the runtime-null
	// bug the camelCase `CloudflareTunnelRequirementSchema.remedy` above has to guard against.
	remedy: CloudflareTunnelRequirementRemedyResSchema.optional(),
});

export const CloudflareTunnelSetupJobResSchema: ZodType<RemoteAccessCloudflareTunnelPluginSetupJobSchema> = z.object({
	job_id: z.string(),
	state: z.nativeEnum(RemoteAccessCloudflareTunnelPluginSetupJobState),
	step: z.string().nullable(),
	message: z.string().nullable(),
	updated_at: z.string(),
});

export const CloudflareTunnelPrivilegedSetupResSchema: ZodType<RemoteAccessCloudflareTunnelPluginPrivilegedSetupSchema> = z.object({
	available: z.boolean(),
	reason: z.string().nullable(),
});

export const CloudflareTunnelStatusResSchema: ZodType<RemoteAccessCloudflareTunnelPluginStatusSchema> = z.object({
	type: z.string(),
	state: z.nativeEnum(RemoteAccessModuleProviderState),
	endpoints: z.array(RemoteAccessEndpointResSchema),
	message: z.string().nullable().optional(),
	details: z.record(z.string(), z.unknown()),
	proxy_addresses: z.array(z.string()),
	advisories: z.array(RemoteAccessAdvisoryResSchema),
	updated_at: z.string(),
	requirements: z.array(CloudflareTunnelRequirementResSchema),
	// See the note on `CloudflareTunnelStatusSchema.setup` above - `.optional()` only, matching
	// the generated (non-nullable) wire type.
	setup: CloudflareTunnelSetupJobResSchema.optional(),
	privileged_setup: CloudflareTunnelPrivilegedSetupResSchema,
});

export const CloudflareTunnelInstallResultResSchema: ZodType<RemoteAccessCloudflareTunnelPluginInstallSchema> = z.object({
	job: z.string(),
});

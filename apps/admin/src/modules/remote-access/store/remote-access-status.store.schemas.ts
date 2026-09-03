import { type ZodType, z } from 'zod';

import {
	type RemoteAccessModuleAdvisorySchema,
	RemoteAccessModuleAdvisorySeverity,
	type RemoteAccessModuleEndpointSchema,
	RemoteAccessModuleEndpointScope,
	type RemoteAccessModuleProviderCapabilitiesSchema,
	RemoteAccessModuleProviderKind,
	type RemoteAccessModuleProviderSchema,
	RemoteAccessModuleProviderState,
	type RemoteAccessModuleStatusSchema,
	type RemoteAccessModuleUrlsSchema,
} from '../../../openapi.constants';

// STORE STATE
// ===========

export const RemoteAccessEndpointSchema = z.object({
	url: z.string(),
	scope: z.nativeEnum(RemoteAccessModuleEndpointScope),
	https: z.boolean(),
	label: z.string(),
});

export const RemoteAccessAdvisorySchema = z.object({
	code: z.string(),
	severity: z.nativeEnum(RemoteAccessModuleAdvisorySeverity),
	message: z.string(),
	provider: z.string().nullable().optional(),
});

export const RemoteAccessProviderCapabilitiesSchema = z.object({
	https: z.boolean(),
	publicUrl: z.boolean(),
	identityHeaders: z.boolean(),
	ssh: z.boolean(),
});

export const RemoteAccessProviderSchema = z.object({
	type: z.string(),
	kind: z.nativeEnum(RemoteAccessModuleProviderKind),
	capabilities: RemoteAccessProviderCapabilitiesSchema,
	state: z.nativeEnum(RemoteAccessModuleProviderState),
	endpoints: z.array(RemoteAccessEndpointSchema),
	message: z.string().nullable().optional(),
	details: z.record(z.string(), z.unknown()),
	proxyAddresses: z.array(z.string()),
	advisories: z.array(RemoteAccessAdvisorySchema),
	updatedAt: z.string(),
});

export const RemoteAccessUrlsSchema = z.object({
	internal: z.string(),
	candidates: z.array(z.string()),
	external: z.array(RemoteAccessEndpointSchema),
	primary: z.string().nullable().optional(),
});

export const RemoteAccessStatusSchema = z.object({
	enabled: z.boolean(),
	providers: z.array(RemoteAccessProviderSchema),
	urls: RemoteAccessUrlsSchema,
	advisories: z.array(RemoteAccessAdvisorySchema),
});

export const RemoteAccessStatusStateSemaphoreSchema = z.object({
	getting: z.boolean(),
});

// STORE ACTIONS
// =============

// Loose on purpose: the raw websocket payload is validated against the specific event schema
// below (inside the transformer), not at the action-payload boundary. Mirrors
// `SystemInfoOnEventActionPayloadSchema`.
export const RemoteAccessStatusOnEventActionPayloadSchema = z.object({
	event: z.string(),
	data: z.looseObject({}),
});

export const RemoteAccessStatusSetActionPayloadSchema = z.object({
	data: z.looseObject({}),
});

// The `RemoteAccessModule.Provider.Status` event payload: the full `RemoteAccessProviderStatus`
// interface (never the REST `RemoteAccessModuleDataProvider` shape - it carries neither `kind` nor
// `capabilities`, which only the module's own registry knows). Field names are already camelCase on
// the wire because the backend emits a plain object, not a class-transformer instance.
export const RemoteAccessProviderStatusEventSchema = z.object({
	type: z.string(),
	state: z.nativeEnum(RemoteAccessModuleProviderState),
	endpoints: z.array(RemoteAccessEndpointSchema),
	message: z.string().nullable().optional(),
	details: z.record(z.string(), z.unknown()),
	proxyAddresses: z.array(z.string()),
	advisories: z.array(RemoteAccessAdvisorySchema),
	updatedAt: z.string(),
});

// The `RemoteAccessModule.Urls.Changed` event payload - camelCase on the wire for the same reason,
// and a narrower shape than `RemoteAccessModuleDataUrls`: it never carries `candidates`.
export const RemoteAccessUrlsChangedEventSchema = z.object({
	internal: z.string(),
	external: z.array(RemoteAccessEndpointSchema),
	primaryExternalUrl: z.string().nullable(),
});

// BACKEND API
// ===========

export const RemoteAccessEndpointResSchema: ZodType<RemoteAccessModuleEndpointSchema> = z.object({
	url: z.string(),
	scope: z.nativeEnum(RemoteAccessModuleEndpointScope),
	https: z.boolean(),
	label: z.string(),
});

export const RemoteAccessAdvisoryResSchema: ZodType<RemoteAccessModuleAdvisorySchema> = z.object({
	code: z.string(),
	severity: z.nativeEnum(RemoteAccessModuleAdvisorySeverity),
	message: z.string(),
	provider: z.string().nullable().optional(),
});

export const RemoteAccessProviderCapabilitiesResSchema: ZodType<RemoteAccessModuleProviderCapabilitiesSchema> = z.object({
	https: z.boolean(),
	public_url: z.boolean(),
	identity_headers: z.boolean(),
	ssh: z.boolean(),
});

export const RemoteAccessProviderResSchema: ZodType<RemoteAccessModuleProviderSchema> = z.object({
	type: z.string(),
	kind: z.nativeEnum(RemoteAccessModuleProviderKind),
	capabilities: RemoteAccessProviderCapabilitiesResSchema,
	state: z.nativeEnum(RemoteAccessModuleProviderState),
	endpoints: z.array(RemoteAccessEndpointResSchema),
	message: z.string().nullable().optional(),
	details: z.record(z.string(), z.unknown()),
	proxy_addresses: z.array(z.string()),
	advisories: z.array(RemoteAccessAdvisoryResSchema),
	updated_at: z.string(),
});

export const RemoteAccessUrlsResSchema: ZodType<RemoteAccessModuleUrlsSchema> = z.object({
	internal: z.string(),
	candidates: z.array(z.string()),
	external: z.array(RemoteAccessEndpointResSchema),
	primary: z.string().nullable().optional(),
});

export const RemoteAccessStatusResSchema: ZodType<RemoteAccessModuleStatusSchema> = z.object({
	enabled: z.boolean(),
	providers: z.array(RemoteAccessProviderResSchema),
	urls: RemoteAccessUrlsResSchema,
	advisories: z.array(RemoteAccessAdvisoryResSchema),
});

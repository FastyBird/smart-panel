import { type ZodType, z } from 'zod';

import type {
	McpModuleOAuthAccessTokenSchema,
	McpModuleOAuthClientSchema,
	McpModuleOAuthGrantSchema,
	McpModuleOAuthRefreshFamilySchema,
} from '../../../openapi.constants';
import { McpOAuthScope } from '../mcp.constants';

type ApiOAuthClient = McpModuleOAuthClientSchema;
type ApiOAuthGrant = McpModuleOAuthGrantSchema;
type ApiOAuthAccessToken = McpModuleOAuthAccessTokenSchema;
type ApiOAuthRefreshFamily = McpModuleOAuthRefreshFamilySchema;

const dateSchema = z.string().datetime({ offset: true });
const nullableDateSchema = dateSchema.nullable().default(null);
const scopeSchema = z.nativeEnum(McpOAuthScope);

/**
 * The API sends the public identifier as `client_id`, which arrives here as
 * `clientId`. It is renamed on the way in rather than adopted: `clientId` means
 * the internal record id on the grant, access token and refresh family models,
 * so carrying that name here would give one field two meanings.
 */
export const McpOAuthClientSchema = z
	.object({
		id: z.string().uuid(),
		clientId: z.string().min(1),
		name: z.string().trim().min(1).max(100),
		redirectUris: z.array(z.string().url()).min(1),
		maximumScopes: z.array(scopeSchema),
		enabled: z.boolean(),
		createdAt: dateSchema,
		updatedAt: nullableDateSchema,
	})
	.transform(({ clientId, ...client }) => ({ ...client, clientIdentifier: clientId }));

export const McpOAuthGrantSchema = z.object({
	id: z.string().uuid(),
	clientId: z.string().uuid(),
	clientName: z.string().min(1),
	approvedById: z.string().uuid().nullable(),
	approvedScopes: z.array(scopeSchema),
	expiresAt: dateSchema,
	revokedAt: nullableDateSchema,
	active: z.boolean(),
	createdAt: dateSchema,
});

export const McpOAuthAccessTokenSchema = z.object({
	id: z.string().uuid(),
	clientId: z.string().uuid(),
	clientName: z.string().min(1),
	grantId: z.string().uuid(),
	refreshFamilyId: z.string().uuid().nullable(),
	scopes: z.array(scopeSchema),
	expiresAt: dateSchema,
});

export const McpOAuthRefreshFamilySchema = z.object({
	id: z.string().uuid(),
	clientId: z.string().uuid(),
	clientName: z.string().min(1),
	grantId: z.string().uuid(),
	expiresAt: dateSchema,
	activeTokenCount: z.number().int().min(0),
});

export const McpOAuthCreateClientSchema = z.object({
	name: z.string().trim().min(1).max(100),
	redirectUris: z.array(z.string().url()).min(1),
	maximumScopes: z.array(scopeSchema).min(1),
});

export const McpOAuthUpdateClientSchema = McpOAuthCreateClientSchema.partial();

export const McpOAuthUpdateGrantSchema = z.object({
	approvedScopes: z.array(scopeSchema).min(1),
});

/**
 * The wire shapes, bound to the types generated from the backend's OpenAPI
 * spec. These exist so a field the backend renames stops compiling here rather
 * than failing at runtime as an empty page — which is exactly how the public
 * client identifier drifted from `client_id` to `clientIdentifier` unnoticed.
 */
export const McpOAuthClientResSchema: ZodType<ApiOAuthClient> = z.object({
	id: z.string().uuid(),
	client_id: z.string().min(1),
	name: z.string(),
	redirect_uris: z.array(z.string()),
	maximum_scopes: z.array(scopeSchema),
	enabled: z.boolean(),
	created_at: z.string(),
	updated_at: z.string().nullable(),
});

export const McpOAuthGrantResSchema: ZodType<ApiOAuthGrant> = z.object({
	id: z.string().uuid(),
	client_id: z.string(),
	client_name: z.string(),
	approved_by_id: z.string().nullable(),
	approved_scopes: z.array(scopeSchema),
	expires_at: z.string(),
	revoked_at: z.string().nullable(),
	active: z.boolean(),
	created_at: z.string(),
});

export const McpOAuthAccessTokenResSchema: ZodType<ApiOAuthAccessToken> = z.object({
	id: z.string().uuid(),
	client_id: z.string(),
	client_name: z.string(),
	grant_id: z.string(),
	refresh_family_id: z.string().nullable(),
	scopes: z.array(scopeSchema),
	expires_at: z.string(),
});

export const McpOAuthRefreshFamilyResSchema: ZodType<ApiOAuthRefreshFamily> = z.object({
	id: z.string().uuid(),
	client_id: z.string(),
	client_name: z.string(),
	grant_id: z.string(),
	expires_at: z.string(),
	active_token_count: z.number(),
});

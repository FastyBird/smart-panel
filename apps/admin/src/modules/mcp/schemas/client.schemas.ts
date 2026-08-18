import { type ZodType, z } from 'zod';

import type { McpModuleClientSchema } from '../../../openapi.constants';
import { MCP_DEFAULT_TOKEN_EXPIRATION_DAYS, MCP_MAX_TOKEN_EXPIRATION_DAYS, McpCapability } from '../mcp.constants';

type ApiClient = McpModuleClientSchema;

const nullableDateSchema = z.string().datetime({ offset: true }).nullable().default(null);

export const McpClientSchema = z.object({
	id: z.string().uuid(),
	name: z.string().trim().min(1).max(100),
	description: z.string().max(500).nullable().default(null),
	enabled: z.boolean(),
	capabilities: z.array(z.nativeEnum(McpCapability)),
	createdById: z.string().uuid().nullable().optional(),
	tokenId: z.string().uuid().nullable().optional(),
	credentialExpiresAt: nullableDateSchema,
	credentialRevoked: z.boolean().default(true),
	lastUsedAt: nullableDateSchema,
	createdAt: z.string().datetime({ offset: true }),
	updatedAt: nullableDateSchema,
});

export const McpCreateClientSchema = z.object({
	name: z.string().trim().min(1).max(100),
	description: z.string().trim().max(500).nullable().default(null),
	capabilities: z.array(z.nativeEnum(McpCapability)),
	expiresInDays: z.number().int().min(1).max(MCP_MAX_TOKEN_EXPIRATION_DAYS).default(MCP_DEFAULT_TOKEN_EXPIRATION_DAYS),
});

export const McpUpdateClientSchema = z.object({
	name: z.string().trim().min(1).max(100),
	description: z.string().trim().max(500).nullable().default(null),
	enabled: z.boolean(),
	capabilities: z.array(z.nativeEnum(McpCapability)),
});

export const McpRotateClientSchema = z.object({
	expiresInDays: z.number().int().min(1).max(MCP_MAX_TOKEN_EXPIRATION_DAYS).default(MCP_DEFAULT_TOKEN_EXPIRATION_DAYS),
});

export const McpClientCredentialSchema = z.object({
	client: McpClientSchema,
	token: z.string().min(1),
});

/**
 * The wire shape, bound to the type generated from the backend's OpenAPI spec,
 * so a field the backend renames stops compiling here rather than emptying the
 * list at runtime.
 */
export const McpClientResSchema: ZodType<ApiClient> = z.object({
	id: z.string().uuid(),
	name: z.string(),
	description: z.string().nullable(),
	enabled: z.boolean(),
	capabilities: z.array(z.nativeEnum(McpCapability)),
	created_by_id: z.string().nullable(),
	token_id: z.string().nullable(),
	credential_expires_at: z.string().nullable(),
	credential_revoked: z.boolean(),
	last_used_at: z.string().nullable(),
	created_at: z.string(),
	updated_at: z.string().nullable(),
});

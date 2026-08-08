import { z } from 'zod';

import { MCP_DEFAULT_TOKEN_EXPIRATION_DAYS, MCP_MAX_TOKEN_EXPIRATION_DAYS, McpCapability } from '../mcp.constants';

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

import { z } from 'zod';

import { McpOAuthScope } from '../mcp.constants';

const dateSchema = z.string().datetime({ offset: true });
const nullableDateSchema = dateSchema.nullable().default(null);
const scopeSchema = z.nativeEnum(McpOAuthScope);

export const McpOAuthClientSchema = z.object({
	id: z.string().uuid(),
	clientIdentifier: z.string().min(1),
	name: z.string().trim().min(1).max(100),
	redirectUris: z.array(z.string().url()).min(1),
	maximumScopes: z.array(scopeSchema),
	enabled: z.boolean(),
	createdAt: dateSchema,
	updatedAt: nullableDateSchema,
});

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

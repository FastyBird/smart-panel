import { z } from 'zod';

import { McpOAuthScope } from '../mcp.constants';

export const McpOAuthInteractionSchema = z.object({
	action: z.enum(['consent', 'redirect']),
	redirectTo: z.string().optional(),
	installationName: z.string().optional(),
	installationId: z.string().uuid().optional(),
	clientIdentifier: z.string().optional(),
	clientName: z.string().optional(),
	redirectUri: z.string().url().optional(),
	requestedScopes: z.array(z.enum(Object.values(McpOAuthScope) as [McpOAuthScope, ...McpOAuthScope[]])).optional(),
	accessExpiresInSeconds: z.number().int().positive().optional(),
	maximumGrantExpiresInDays: z.number().int().positive().optional(),
	physicalDeviceWarning: z.boolean().optional(),
});

export const McpOAuthInteractionCompletionSchema = z.object({
	redirectTo: z.string().min(1),
});

export type IMcpOAuthInteraction = z.infer<typeof McpOAuthInteractionSchema>;
export type IMcpOAuthInteractionCompletion = z.infer<typeof McpOAuthInteractionCompletionSchema>;

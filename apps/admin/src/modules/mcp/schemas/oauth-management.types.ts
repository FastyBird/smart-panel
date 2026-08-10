import { z } from 'zod';

import type {
	McpOAuthAccessTokenSchema,
	McpOAuthClientSchema,
	McpOAuthCreateClientSchema,
	McpOAuthGrantSchema,
	McpOAuthRefreshFamilySchema,
	McpOAuthUpdateClientSchema,
	McpOAuthUpdateGrantSchema,
} from './oauth-management.schemas';

export type IMcpOAuthClient = z.infer<typeof McpOAuthClientSchema>;
export type IMcpOAuthGrant = z.infer<typeof McpOAuthGrantSchema>;
export type IMcpOAuthAccessToken = z.infer<typeof McpOAuthAccessTokenSchema>;
export type IMcpOAuthRefreshFamily = z.infer<typeof McpOAuthRefreshFamilySchema>;
export type IMcpOAuthCreateClient = z.input<typeof McpOAuthCreateClientSchema>;
export type IMcpOAuthUpdateClient = z.input<typeof McpOAuthUpdateClientSchema>;
export type IMcpOAuthUpdateGrant = z.input<typeof McpOAuthUpdateGrantSchema>;

import { z } from 'zod';

import { McpCapability } from '../mcp.constants';

export const McpClientsFilterSchema = z.object({
	search: z.string().optional(),
	status: z.enum(['all', 'active', 'revoked', 'expired']).default('all'),
	enabled: z.enum(['all', 'enabled', 'disabled']).default('all'),
	capabilities: z.array(z.nativeEnum(McpCapability)),
});

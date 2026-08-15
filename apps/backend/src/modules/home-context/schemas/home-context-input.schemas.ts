import { z } from 'zod';

import { HOME_CONTEXT_PROFILE_MCP_COMPATIBILITY } from '../home-context.constants';

export const homeSnapshotQuerySchema = z
	.object({
		spaceId: z.string().min(1).optional(),
		profile: z.literal(HOME_CONTEXT_PROFILE_MCP_COMPATIBILITY),
	})
	.strict();

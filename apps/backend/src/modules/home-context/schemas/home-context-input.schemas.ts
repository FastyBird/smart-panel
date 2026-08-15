import { z } from 'zod';

import { HOME_CONTEXT_PROFILE_MCP_COMPATIBILITY } from '../home-context.constants';

const paginationCursorSchema = z
	.string()
	.regex(/^(0|[1-9]\d*)$/)
	.refine((cursor) => Number.isSafeInteger(Number(cursor)));

export const homeSnapshotQuerySchema = z
	.object({
		spaceId: z.string().min(1).optional(),
		profile: z.literal(HOME_CONTEXT_PROFILE_MCP_COMPATIBILITY),
	})
	.strict();

export const homeContextSpacePageQuerySchema = z
	.object({
		cursor: paginationCursorSchema.optional(),
		profile: z.literal(HOME_CONTEXT_PROFILE_MCP_COMPATIBILITY),
	})
	.strict();

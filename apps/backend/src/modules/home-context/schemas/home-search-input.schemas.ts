import { z } from 'zod';

import {
	HOME_SEARCH_CANDIDATE_CAPABILITIES,
	HOME_SEARCH_ENTITY_KINDS,
	HOME_SEARCH_LIMIT_PROFILES,
	HOME_SEARCH_PROFILE_BUDDY_V1,
} from '../home-context.constants';

const limits = HOME_SEARCH_LIMIT_PROFILES[HOME_SEARCH_PROFILE_BUDDY_V1];

export const homeEntitySearchQuerySchema = z
	.object({
		profile: z.literal(HOME_SEARCH_PROFILE_BUDDY_V1),
		query: z.string().trim().min(1).max(limits.maxQueryCharacters),
		kinds: z
			.array(z.enum(HOME_SEARCH_ENTITY_KINDS))
			.min(1)
			.max(limits.maxKinds)
			.refine((kinds) => new Set(kinds).size === kinds.length, 'Search kinds must be unique')
			.optional(),
		spaceId: z.string().trim().min(1).max(128).optional(),
		categories: z
			.array(z.string().trim().min(1).max(64))
			.min(1)
			.max(limits.maxCategories)
			.refine((categories) => new Set(categories).size === categories.length, 'Search categories must be unique')
			.optional(),
		candidateCapability: z.enum(HOME_SEARCH_CANDIDATE_CAPABILITIES).optional(),
		limit: z.number().int().min(1).max(limits.maxResults).optional(),
		cursor: z.string().min(1).max(limits.maxCursorCharacters).optional(),
	})
	.strict();

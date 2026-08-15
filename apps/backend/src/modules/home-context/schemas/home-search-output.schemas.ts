import { z } from 'zod';

import {
	HOME_SEARCH_CANDIDATE_CAPABILITIES,
	HOME_SEARCH_ENTITY_KINDS,
	HOME_SEARCH_LIMIT_PROFILES,
	HOME_SEARCH_MATCH_REASONS,
	HOME_SEARCH_PROFILE_BUDDY_V1,
} from '../home-context.constants';

const limits = HOME_SEARCH_LIMIT_PROFILES[HOME_SEARCH_PROFILE_BUDDY_V1];
const reasonSchema = z.enum(HOME_SEARCH_MATCH_REASONS);
const baseFields = {
	id: z.string(),
	name: z.string(),
	score: z.number().int().nonnegative(),
	reasons: z.array(reasonSchema).min(1),
};

const entitySchema = z.discriminatedUnion('kind', [
	z
		.object({
			kind: z.literal(HOME_SEARCH_ENTITY_KINDS[0]),
			...baseFields,
			candidate_capabilities: z.array(z.never()).max(0),
			type: z.string(),
			category: z.string().nullable(),
			parent_id: z.string().nullable(),
		})
		.strict(),
	z
		.object({
			kind: z.literal(HOME_SEARCH_ENTITY_KINDS[1]),
			...baseFields,
			candidate_capabilities: z.array(z.never()).max(0),
			identifier: z.string().nullable(),
			category: z.string(),
			enabled: z.boolean(),
			room_id: z.string().nullable(),
		})
		.strict(),
	z
		.object({
			kind: z.literal(HOME_SEARCH_ENTITY_KINDS[2]),
			...baseFields,
			candidate_capabilities: z.array(z.enum(['read', 'write'])).max(2),
			property_name: z.string().nullable(),
			identifier: z.string().nullable(),
			category: z.string(),
			data_type: z.string(),
			permissions: z.array(z.string()),
			device: z.object({ id: z.string(), name: z.string(), enabled: z.boolean() }).strict(),
			channel: z.object({ id: z.string(), name: z.string(), category: z.string() }).strict(),
		})
		.strict(),
	z
		.object({
			kind: z.literal(HOME_SEARCH_ENTITY_KINDS[3]),
			...baseFields,
			candidate_capabilities: z.array(z.literal('trigger')).max(1),
			category: z.string(),
			enabled: z.boolean(),
			triggerable: z.boolean(),
			primary_space_id: z.string().nullable(),
		})
		.strict(),
]);

export const homeEntitySearchResponseSchema = z
	.object({
		query: z.string(),
		entities: z.array(entitySchema).max(limits.maxResults),
		observed_at: z.string().datetime(),
		total: z.number().int().nonnegative(),
		returned: z.number().int().nonnegative().max(limits.maxResults),
		totals_by_kind: z
			.object({
				space: z.number().int().nonnegative(),
				device: z.number().int().nonnegative(),
				property: z.number().int().nonnegative(),
				scene: z.number().int().nonnegative(),
			})
			.strict(),
		partial: z.literal(false),
		truncated: z.boolean(),
		refine_required: z.boolean(),
		candidate_capability_filter: z.enum(HOME_SEARCH_CANDIDATE_CAPABILITIES).optional(),
		next_cursor: z.string().min(1).max(limits.maxCursorCharacters).optional(),
	})
	.strict();

import { z } from 'zod';

import { ChannelCategory, DataTypeType, PropertyCategory } from '../../devices/devices.constants';
import {
	HOME_CURRENT_STATE_EQUALITY_OPERATORS,
	HOME_CURRENT_STATE_LIMIT_PROFILES,
	HOME_CURRENT_STATE_ORDERING_OPERATORS,
	HOME_CURRENT_STATE_PROFILE_BUDDY_V1,
} from '../home-context.constants';

const limits = HOME_CURRENT_STATE_LIMIT_PROFILES[HOME_CURRENT_STATE_PROFILE_BUDDY_V1];

const uniqueArray = <T extends z.ZodType>(schema: T, max: number, label: string) =>
	z
		.array(schema)
		.min(1)
		.max(max)
		.refine((values) => new Set(values).size === values.length, `${label} must be unique`)
		.optional();

const unitSchema = z.string().trim().min(1).max(32);

export const homeCurrentStatePredicateSchema = z.union([
	z
		.object({
			operator: z.enum(HOME_CURRENT_STATE_EQUALITY_OPERATORS),
			value: z.union([z.string().max(limits.maxPredicateStringCharacters), z.boolean()]),
		})
		.strict(),
	z
		.object({
			operator: z.enum(HOME_CURRENT_STATE_EQUALITY_OPERATORS),
			value: z.number().finite(),
			unit: unitSchema,
		})
		.strict(),
	z
		.object({
			operator: z.enum(HOME_CURRENT_STATE_ORDERING_OPERATORS),
			value: z.number().finite(),
			unit: unitSchema,
		})
		.strict(),
]);

const commonQueryShape = {
	profile: z.literal(HOME_CURRENT_STATE_PROFILE_BUDDY_V1),
	spaceId: z.string().trim().min(1).max(128).optional(),
	channelCategories: uniqueArray(z.enum(ChannelCategory), limits.maxChannelCategories, 'Channel categories'),
	propertyCategories: uniqueArray(z.enum(PropertyCategory), limits.maxPropertyCategories, 'Property categories'),
	dataTypes: uniqueArray(z.enum(DataTypeType), limits.maxDataTypes, 'Data types'),
	limit: z.number().int().min(1).max(limits.maxRows).optional(),
};

export const homeCurrentStateQuerySchema = z.discriminatedUnion('operation', [
	z
		.object({
			...commonQueryShape,
			operation: z.literal('rows'),
			predicate: homeCurrentStatePredicateSchema.optional(),
		})
		.strict(),
	z.object({ ...commonQueryShape, operation: z.literal('any'), predicate: homeCurrentStatePredicateSchema }).strict(),
	z.object({ ...commonQueryShape, operation: z.literal('all'), predicate: homeCurrentStatePredicateSchema }).strict(),
	z
		.object({ ...commonQueryShape, operation: z.literal('count_matches'), predicate: homeCurrentStatePredicateSchema })
		.strict(),
]);

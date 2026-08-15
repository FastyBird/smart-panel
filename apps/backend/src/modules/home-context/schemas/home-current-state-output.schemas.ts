import { z } from 'zod';

import { ChannelCategory, DataTypeType, PropertyCategory } from '../../devices/devices.constants';
import {
	HOME_CURRENT_STATE_AGGREGATE_STATUSES,
	HOME_CURRENT_STATE_LIMIT_PROFILES,
	HOME_CURRENT_STATE_PARTIAL_REASONS,
	HOME_CURRENT_STATE_PROFILE_BUDDY_V1,
} from '../home-context.constants';

import { homeCurrentStatePredicateSchema } from './home-current-state-input.schemas';

const limits = HOME_CURRENT_STATE_LIMIT_PROFILES[HOME_CURRENT_STATE_PROFILE_BUDDY_V1];

const rowSchema = z
	.object({
		property_id: z.string(),
		property_name: z.string().nullable(),
		property_category: z.enum(PropertyCategory),
		data_type: z.enum(DataTypeType),
		unit: z.string().nullable(),
		value: z.union([z.string(), z.number(), z.boolean()]),
		value_observed_at: z.string().datetime(),
		freshness: z.literal('known_timestamp'),
		source: z.enum(['cache', 'storage']),
		device: z
			.object({
				id: z.string(),
				name: z.string(),
				enabled: z.boolean(),
				room_id: z.string().nullable(),
			})
			.strict(),
		channel: z
			.object({
				id: z.string(),
				name: z.string(),
				category: z.enum(ChannelCategory),
			})
			.strict(),
	})
	.strict();

const commonResultShape = {
	profile: z.literal(HOME_CURRENT_STATE_PROFILE_BUDDY_V1),
	predicate: homeCurrentStatePredicateSchema.nullable(),
	space_id: z.string().nullable(),
	rows: z.array(rowSchema).max(limits.maxRows),
	observed_at: z.string().datetime(),
	eligible: z.number().int().nonnegative(),
	scanned: z.number().int().nonnegative(),
	evaluated: z.number().int().nonnegative(),
	unknown: z.number().int().nonnegative(),
	matched: z.number().int().nonnegative(),
	returned: z.number().int().nonnegative().max(limits.maxRows),
	complete: z.boolean(),
	partial: z.boolean(),
	partial_reasons: z.array(z.enum(HOME_CURRENT_STATE_PARTIAL_REASONS)),
	truncated: z.boolean(),
	storage_status: z.enum(['not_needed', 'available', 'disconnected', 'failed', 'timed_out']),
	cache_count: z.number().int().nonnegative(),
	storage_count: z.number().int().nonnegative(),
	missing_count: z.number().int().nonnegative(),
	unprocessed_count: z.number().int().nonnegative(),
	oldest_last_updated: z.string().datetime().nullable(),
	newest_last_updated: z.string().datetime().nullable(),
	freshness_unknown_count: z.number().int().nonnegative(),
};

export const homeCurrentStateResultSchema = z
	.discriminatedUnion('operation', [
		z
			.object({
				...commonResultShape,
				operation: z.literal('rows'),
				match_count: z.number().int().nonnegative().nullable(),
			})
			.strict(),
		z
			.object({
				...commonResultShape,
				operation: z.enum(['any', 'all']),
				value: z.boolean().nullable(),
				definitive: z.boolean(),
				status: z.enum(HOME_CURRENT_STATE_AGGREGATE_STATUSES),
			})
			.strict(),
		z
			.object({
				...commonResultShape,
				operation: z.literal('count_matches'),
				value: z.number().int().nonnegative().nullable(),
				definitive: z.boolean(),
				status: z.enum(HOME_CURRENT_STATE_AGGREGATE_STATUSES),
			})
			.strict(),
	])
	.superRefine((result, context) => {
		const invariant = (valid: boolean, message: string, path: PropertyKey[]) => {
			if (!valid) {
				context.addIssue({ code: 'custom', message, path });
			}
		};

		invariant(result.returned === result.rows.length, 'Returned must equal the row count', ['returned']);
		invariant(result.scanned <= result.eligible, 'Scanned may not exceed eligible', ['scanned']);
		invariant(result.scanned <= limits.maxCandidates, 'Scanned exceeds the profile limit', ['scanned']);
		invariant(result.evaluated <= result.scanned, 'Evaluated may not exceed scanned', ['evaluated']);
		invariant(result.matched <= result.evaluated, 'Matched may not exceed evaluated', ['matched']);
		invariant(result.unknown === result.eligible - result.evaluated, 'Unknown count is inconsistent', ['unknown']);
		invariant(result.complete === (result.unknown === 0), 'Complete is inconsistent with unknown', ['complete']);
		invariant(result.partial === !result.complete, 'Partial must be the inverse of complete', ['partial']);
		invariant(
			new Set(result.partial_reasons).size === result.partial_reasons.length,
			'Partial reasons must be unique',
			['partial_reasons'],
		);
		invariant(
			result.partial ? result.partial_reasons.length > 0 : result.partial_reasons.length === 0,
			'Partial reasons are inconsistent with partial',
			['partial_reasons'],
		);

		if (result.operation === 'rows') {
			invariant(result.match_count === (result.complete ? result.matched : null), 'Match count is inconsistent', [
				'match_count',
			]);
		} else {
			invariant(result.predicate !== null, 'Aggregate results require a predicate', ['predicate']);
			invariant(
				result.definitive === (result.status === 'complete' || result.status === 'conclusive_partial'),
				'Definitive is inconsistent with status',
				['definitive'],
			);
			invariant((result.status === 'no_eligible') === (result.eligible === 0), 'No-eligible status is inconsistent', [
				'status',
			]);
			if (result.status === 'complete') {
				invariant(result.complete && result.eligible > 0, 'Complete aggregate status is inconsistent', ['status']);
			}
			if (result.status === 'conclusive_partial' || result.status === 'indeterminate') {
				invariant(result.partial, 'Partial aggregate status requires partial coverage', ['status']);
			}
			invariant(
				result.status === 'indeterminate' || result.status === 'no_eligible'
					? result.value === null
					: result.value !== null,
				'Aggregate value is inconsistent with status',
				['value'],
			);
			if (result.operation === 'count_matches') {
				invariant(result.status !== 'conclusive_partial', 'Counts cannot be conclusive with partial coverage', [
					'status',
				]);
				if (result.status === 'complete') {
					invariant(result.value === result.matched, 'Complete count must equal matched', ['value']);
				}
			} else if (result.value !== null) {
				invariant(
					result.value === (result.operation === 'any' ? result.matched > 0 : result.evaluated === result.matched),
					'Boolean aggregate value is inconsistent',
					['value'],
				);
			}
		}
	});

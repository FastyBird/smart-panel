import { QualifiedPropertySample } from '../../../modules/devices/models/property-sample.model';
import { PropertyProducerQuality } from '../../../modules/devices/models/property-value-state.model';
import { VirtualAggregateFilter, VirtualAggregateOperator } from '../entities/virtual-producer.entity';

import { isValidAggregateFilter, isValidAggregateWeight } from './virtual-aggregate-policy.utils';

export type AggregateExclusion = 'missing' | 'incompatible' | 'offline' | 'invalid' | 'stale' | 'disabled' | 'outlier';
export interface AggregateInputEvidence {
	readonly id: string;
	readonly sourceIdentity: string;
	readonly sample: QualifiedPropertySample | null;
	readonly weight?: number;
	readonly expiresAt?: Date;
	readonly exclusion?: AggregateExclusion;
}
export interface AggregateInputDiagnostic {
	readonly id: string;
	readonly sourceIdentity: string;
	readonly value: number | boolean | null;
	readonly sampledAt: string | null;
	readonly ageSeconds: number | null;
	readonly exclusion: AggregateExclusion | null;
}
export interface AggregateEvaluation {
	readonly value: number | boolean | null;
	readonly quality: PropertyProducerQuality;
	readonly reasons: readonly string[];
	readonly sampledAt: Date | null;
	readonly expiresAt: Date | null;
	readonly inputs: readonly AggregateInputDiagnostic[];
}

/** Typed extension point: operators receive only qualified finite canonical measurements. */
export interface AggregateOperator {
	readonly kind: VirtualAggregateOperator;
	evaluate(values: readonly number[], weights?: readonly number[]): number;
}

/** Scale both values and weights before compensated summation, avoiding finite-product/sum overflow. */
function weightedMean(values: readonly number[], weights: readonly number[] = values.map(() => 1)): number {
	const maximumWeight = Math.max(...weights);
	const normalized = weights.map((weight) => weight / maximumWeight);
	const total = stableSum(normalized);
	const scale = Math.max(...values.map(Math.abs));
	if (scale === 0) return 0;
	const sum = stableSum(values.map((value, index) => (value / scale) * (normalized[index] / total)));
	// Convex results cannot exceed the largest magnitude; contain final floating-point overshoot.
	return Math.max(-1, Math.min(1, sum)) * scale;
}

function stableSum(values: readonly number[]): number {
	let sum = 0;
	let correction = 0;
	for (const value of values) {
		const term = value - correction;
		const next = sum + term;
		correction = next - sum - term;
		sum = next;
	}
	return sum;
}

export const aggregateOperators: ReadonlyMap<VirtualAggregateOperator, AggregateOperator> = new Map<
	VirtualAggregateOperator,
	AggregateOperator
>([
	[VirtualAggregateOperator.WEIGHTED_MEAN, { kind: VirtualAggregateOperator.WEIGHTED_MEAN, evaluate: weightedMean }],
	[
		VirtualAggregateOperator.MEAN,
		{
			kind: VirtualAggregateOperator.MEAN,
			evaluate: (values) => {
				// Divide before summing to avoid overflow, with compensated summation in stable input order.
				let sum = 0;
				let correction = 0;
				for (const value of values) {
					const term = value / values.length - correction;
					const next = sum + term;
					correction = next - sum - term;
					sum = next;
				}
				return sum;
			},
		},
	],
	[
		VirtualAggregateOperator.MEDIAN,
		{
			kind: VirtualAggregateOperator.MEDIAN,
			evaluate: (values) => {
				const sorted = [...values].sort((a, b) => a - b);
				const middle = Math.floor(sorted.length / 2);
				return sorted.length % 2 ? sorted[middle] : sorted[middle - 1] / 2 + sorted[middle] / 2;
			},
		},
	],
	[VirtualAggregateOperator.MIN, { kind: VirtualAggregateOperator.MIN, evaluate: (values) => Math.min(...values) }],
	[VirtualAggregateOperator.MAX, { kind: VirtualAggregateOperator.MAX, evaluate: (values) => Math.max(...values) }],
]);

/** One fixed clock, fixed membership/quorum and explicit opt-in outlier rejection or sample-time refresh. */
export function evaluateAggregate(
	operator: VirtualAggregateOperator,
	minimumValidInputs: number,
	maximumAgeSeconds: number,
	evidence: readonly AggregateInputEvidence[],
	now: Date,
	step?: number | null,
	outlierFilter?: VirtualAggregateFilter | null,
): AggregateEvaluation {
	if (operator === VirtualAggregateOperator.ANY || operator === VirtualAggregateOperator.ALL)
		return evaluateBinaryAggregate(operator, minimumValidInputs, maximumAgeSeconds, evidence, now, step, outlierFilter);
	let included: { id: string; value: number; weight: number; sampled: number; expiry: number; degraded: boolean }[] =
		[];
	const inputs = [...evidence]
		.sort((a, b) => a.id.localeCompare(b.id))
		.map((input): AggregateInputDiagnostic => {
			const sampled = input.sample?.sampledAt.getTime();
			const expiry =
				sampled === undefined
					? NaN
					: Math.min(sampled + maximumAgeSeconds * 1000, input.expiresAt?.getTime() ?? Infinity);
			let exclusion = input.exclusion ?? null;
			if (
				!exclusion &&
				(!input.sample ||
					typeof input.sample.value !== 'number' ||
					!Number.isFinite(input.sample.value) ||
					!Number.isFinite(sampled) ||
					sampled > now.getTime() ||
					input.sample.receivedAt.getTime() > now.getTime())
			)
				exclusion = 'invalid';
			if (!exclusion && (!Number.isFinite(expiry) || expiry <= now.getTime())) exclusion = 'stale';
			if (!exclusion)
				included.push({
					id: input.id,
					weight: input.weight ?? 1,
					value: input.sample.value as number,
					sampled,
					expiry,
					degraded: input.sample.quality === 'degraded',
				});
			return {
				id: input.id,
				sourceIdentity: input.sourceIdentity,
				value:
					typeof input.sample?.value === 'number' && Number.isFinite(input.sample.value) ? input.sample.value : null,
				sampledAt: Number.isFinite(sampled) ? new Date(sampled).toISOString() : null,
				ageSeconds: Number.isFinite(sampled) ? (now.getTime() - sampled) / 1000 : null,
				exclusion,
			};
		});
	const filterValid = isValidAggregateFilter(outlierFilter);
	// Excluded comparisons still determine median/cohort admission; their expiry must fence the result.
	const comparisonExpiry = outlierFilter != null ? Math.min(...included.map((input) => input.expiry)) : Infinity;
	const insufficientCohort = filterValid && outlierFilter != null && included.length < 3;
	if (filterValid && outlierFilter != null && !insufficientCohort) {
		const median = aggregateOperators.get(VirtualAggregateOperator.MEDIAN).evaluate(
			included.map((input) => input.value),
			included.map((input) => input.weight),
		);
		const excluded = new Set(
			included.filter((input) => Math.abs(input.value - median) > outlierFilter.threshold).map((input) => input.id),
		);
		included = included.filter((input) => !excluded.has(input.id));
		for (let index = 0; index < inputs.length; index++)
			if (excluded.has(inputs[index].id)) inputs[index] = { ...inputs[index], exclusion: 'outlier' };
	}
	const reasons = inputs.filter((input) => input.exclusion).map((input) => `${input.exclusion}:${input.id}`);
	const policyValid =
		filterValid &&
		evidence.every((input) => isValidAggregateWeight(input.weight === undefined ? 1 : input.weight)) &&
		evidence.length >= 2 &&
		evidence.length <= 256 &&
		new Set(evidence.map((input) => input.id)).size === evidence.length &&
		new Set(evidence.map((input) => input.sourceIdentity)).size === evidence.length &&
		Number.isInteger(minimumValidInputs) &&
		minimumValidInputs >= 1 &&
		minimumValidInputs <= evidence.length &&
		Number.isInteger(maximumAgeSeconds) &&
		maximumAgeSeconds > 0 &&
		maximumAgeSeconds <= 86400 &&
		aggregateOperators.has(operator) &&
		Number.isFinite(now.getTime());
	if (!policyValid || insufficientCohort || included.length < minimumValidInputs)
		return {
			value: null,
			quality: 'unavailable',
			reasons: [
				!policyValid ? 'invalid_policy' : insufficientCohort ? 'insufficient_comparison_cohort' : 'quorum_lost',
				...reasons,
			],
			sampledAt: null,
			expiresAt: null,
			inputs,
		};
	let value = aggregateOperators.get(operator).evaluate(
		included.map((input) => input.value),
		included.map((input) => input.weight),
	);
	if (Number.isFinite(step) && step > 0)
		value = Math.round(value / step + Number.EPSILON * Math.abs(value / step)) * step;
	if (!Number.isFinite(value))
		return {
			value: null,
			quality: 'unavailable',
			reasons: ['invalid_result', ...reasons],
			sampledAt: null,
			expiresAt: null,
			inputs,
		};
	const degraded = included.length < evidence.length || included.some((input) => input.degraded);
	if (included.some((input) => input.degraded)) reasons.push('input_degraded');
	return {
		value,
		quality: degraded ? 'degraded' : 'good',
		reasons,
		sampledAt: new Date(Math.min(...included.map((input) => input.sampled))),
		expiresAt: new Date(Math.min(comparisonExpiry, ...included.map((input) => input.expiry))),
		inputs,
	};
}

/** Reuse identical identity, freshness, quorum and age admission; only actual booleans enter the truth table. */
function evaluateBinaryAggregate(
	operator: VirtualAggregateOperator,
	quorum: number,
	maximumAgeSeconds: number,
	evidence: readonly AggregateInputEvidence[],
	now: Date,
	step?: number | null,
	filter?: VirtualAggregateFilter | null,
): AggregateEvaluation {
	const admitted = evaluateAggregate(
		VirtualAggregateOperator.MEAN,
		quorum,
		maximumAgeSeconds,
		evidence.map((input) => ({
			...input,
			exclusion: input.exclusion ?? (typeof input.sample?.value === 'boolean' ? undefined : 'invalid'),
			sample: input.sample ? { ...input.sample, value: input.sample.value === true ? 1 : 0 } : null,
		})),
		now,
	);
	const inputs = admitted.inputs.map((input) => ({
		...input,
		value: typeof evidence.find((item) => item.id === input.id)?.sample?.value === 'boolean' ? input.value === 1 : null,
	}));
	if (step != null || filter != null || evidence.some((input) => (input.weight ?? 1) !== 1))
		return {
			...admitted,
			inputs,
			value: null,
			quality: 'unavailable',
			sampledAt: null,
			expiresAt: null,
			reasons: ['invalid_policy'],
		};
	if (admitted.quality === 'unavailable') return { ...admitted, inputs };
	const decisive = operator === VirtualAggregateOperator.ANY;
	const retained = inputs.filter((input) => input.exclusion === null);
	const hasDecisive = retained.some((input) => input.value === decisive);
	if (!hasDecisive && retained.length !== evidence.length)
		return {
			...admitted,
			inputs,
			value: null,
			quality: 'unavailable',
			sampledAt: null,
			expiresAt: null,
			reasons: ['unknown_members', ...admitted.reasons],
		};
	return { ...admitted, inputs, value: hasDecisive ? decisive : !decisive };
}

import { QualifiedPropertySample } from '../../../modules/devices/models/property-sample.model';
import { PropertyProducerQuality } from '../../../modules/devices/models/property-value-state.model';
import { VirtualAggregateOperator } from '../entities/virtual-producer.entity';

export type AggregateExclusion = 'missing' | 'incompatible' | 'offline' | 'invalid' | 'stale' | 'disabled';
export interface AggregateInputEvidence {
	readonly id: string;
	readonly sourceIdentity: string;
	readonly sample: QualifiedPropertySample | null;
	readonly expiresAt?: Date;
	readonly exclusion?: AggregateExclusion;
}
export interface AggregateInputDiagnostic {
	readonly id: string;
	readonly sourceIdentity: string;
	readonly value: number | null;
	readonly sampledAt: string | null;
	readonly ageSeconds: number | null;
	readonly exclusion: AggregateExclusion | null;
}
export interface AggregateEvaluation {
	readonly value: number | null;
	readonly quality: PropertyProducerQuality;
	readonly reasons: readonly string[];
	readonly sampledAt: Date | null;
	readonly expiresAt: Date | null;
	readonly inputs: readonly AggregateInputDiagnostic[];
}

/** Typed extension point: operators receive only qualified finite canonical measurements. */
export interface AggregateOperator {
	readonly kind: VirtualAggregateOperator;
	evaluate(values: readonly number[]): number;
}

export const aggregateOperators: ReadonlyMap<VirtualAggregateOperator, AggregateOperator> = new Map([
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

/** One fixed clock, fixed membership/quorum and no implicit outlier rejection or sample-time refresh. */
export function evaluateAggregate(
	operator: VirtualAggregateOperator,
	minimumValidInputs: number,
	maximumAgeSeconds: number,
	evidence: readonly AggregateInputEvidence[],
	now: Date,
	step?: number | null,
): AggregateEvaluation {
	const included: { value: number; sampled: number; expiry: number; degraded: boolean }[] = [];
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
	const reasons = inputs.filter((input) => input.exclusion).map((input) => `${input.exclusion}:${input.id}`);
	const policyValid =
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
	if (!policyValid || included.length < minimumValidInputs)
		return {
			value: null,
			quality: 'unavailable',
			reasons: [policyValid ? 'quorum_lost' : 'invalid_policy', ...reasons],
			sampledAt: null,
			expiresAt: null,
			inputs,
		};
	let value = aggregateOperators.get(operator).evaluate(included.map((input) => input.value));
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
		expiresAt: new Date(Math.min(...included.map((input) => input.expiry))),
		inputs,
	};
}

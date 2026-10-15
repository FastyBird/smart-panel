import { QualifiedPropertySample } from '../../../modules/devices/models/property-sample.model';
import { VirtualAggregateFilterKind, VirtualAggregateOperator } from '../entities/virtual-producer.entity';

import { AggregateInputEvidence, evaluateAggregate } from './virtual-aggregate-evaluator';

const now = new Date('2026-10-13T10:00:20Z');
const input = (id: string, value: number, ageSeconds = 1): AggregateInputEvidence => ({
	id,
	sourceIdentity: id,
	sample: {
		propertyId: id,
		value,
		sampledAt: new Date(now.getTime() - ageSeconds * 1000),
		receivedAt: now,
		provenance: 'live',
		quality: 'good',
		reasons: [],
	} as QualifiedPropertySample,
});

describe('deterministic temperature aggregate evaluation', () => {
	it.each([
		[VirtualAggregateOperator.MEAN, 25],
		[VirtualAggregateOperator.MEDIAN, 23],
		[VirtualAggregateOperator.MIN, 18],
		[VirtualAggregateOperator.MAX, 36],
	])('evaluates %s over every valid member without hiding outliers', (operator, expected) => {
		const sources = [input('b', 22), input('a', 18), input('c', 24), input('d', 36)];
		expect(evaluateAggregate(operator, 4, 30, sources, now).value).toBe(expected);
		expect(evaluateAggregate(operator, 4, 30, sources.reverse(), now).value).toBe(expected);
	});

	it('uses stable mean and median without overflowing finite inputs', () => {
		const sources = [input('a', Number.MAX_VALUE), input('b', Number.MAX_VALUE)];
		for (const operator of [VirtualAggregateOperator.MEAN, VirtualAggregateOperator.MEDIAN])
			expect(evaluateAggregate(operator, 2, 30, sources, now).value).toBe(Number.MAX_VALUE);
	});

	it('propagates the oldest sample and earliest upstream or age expiry', () => {
		const result = evaluateAggregate(
			VirtualAggregateOperator.MEAN,
			2,
			30,
			[input('a', 20, 10), { ...input('b', 22, 2), expiresAt: new Date(now.getTime() + 5000) }],
			now,
		);
		expect(result).toMatchObject({
			value: 21,
			quality: 'good',
			sampledAt: new Date(now.getTime() - 10000),
			expiresAt: new Date(now.getTime() + 5000),
		});
	});

	it('keeps fixed configured quorum and reports every exclusion', () => {
		const sources: AggregateInputEvidence[] = [
			input('a', 20),
			input('b', 50, 30),
			input('c', NaN),
			{ ...input('d', 22), exclusion: 'offline' },
			{ ...input('e', 23), exclusion: 'incompatible' },
			{ id: 'f', sourceIdentity: 'deleted', sample: null, exclusion: 'missing' },
		];
		const failed = evaluateAggregate(VirtualAggregateOperator.MEAN, 2, 30, sources, now);
		expect(failed).toMatchObject({ value: null, quality: 'unavailable' });
		expect(failed.reasons).toEqual(['quorum_lost', 'stale:b', 'invalid:c', 'offline:d', 'incompatible:e', 'missing:f']);
		const degraded = evaluateAggregate(VirtualAggregateOperator.MEAN, 1, 30, sources, now);
		expect(degraded).toMatchObject({ value: 20, quality: 'degraded', sampledAt: sources[0].sample.sampledAt });
	});

	it('rounds only the final result and never refreshes sample evidence on reevaluation', () => {
		const sources = [input('a', 20.02, 5), input('b', 20.08, 3)];
		const first = evaluateAggregate(VirtualAggregateOperator.MEAN, 2, 30, sources, now, 0.1);
		const next = evaluateAggregate(VirtualAggregateOperator.MEAN, 2, 30, sources, new Date(now.getTime() + 1000), 0.1);
		expect(first.value).toBeCloseTo(20.1);
		expect(next.sampledAt).toEqual(first.sampledAt);
		expect(next.expiresAt).toEqual(first.expiresAt);
	});

	it('rejects future, infinite and expired evidence and propagates upstream degradation', () => {
		const upstream = { ...input('a', 20), sample: { ...input('a', 20).sample, quality: 'degraded' as const } };
		const result = evaluateAggregate(
			VirtualAggregateOperator.MEAN,
			1,
			30,
			[upstream, input('b', Infinity), input('c', 23, -1)],
			now,
		);
		expect(result).toMatchObject({
			value: 20,
			quality: 'degraded',
			reasons: ['invalid:b', 'invalid:c', 'input_degraded'],
		});
	});
	it.each([0.000001, 1, 1000000])(
		'accepts inclusive weight boundary %s and renormalizes after exclusions',
		(weight) => {
			const sources = [
				{ ...input('a', 10), weight },
				{ ...input('b', 30), weight },
				{ ...input('c', 100), weight: 1000000, exclusion: 'offline' as const },
			];
			expect(evaluateAggregate(VirtualAggregateOperator.WEIGHTED_MEAN, 2, 30, sources, now)).toMatchObject({
				value: 20,
				quality: 'degraded',
			});
		},
	);
	it.each([0, -1, NaN, Infinity, 0.000000999, 1000001, null])(
		'rejects invalid weight %s even on excluded members',
		(weight) => {
			const sources = [input('a', 20), { ...input('b', 30), weight, exclusion: 'offline' as const }];
			expect(evaluateAggregate(VirtualAggregateOperator.WEIGHTED_MEAN, 1, 30, sources, now).reasons[0]).toBe(
				'invalid_policy',
			);
		},
	);
	it('uses unequal weights in stable identity order, defaults legacy weights and counts quorum identities', () => {
		const sources = [
			{ ...input('a', 10), weight: 1 },
			{ ...input('b', 30), weight: 3 },
		];
		expect(evaluateAggregate(VirtualAggregateOperator.WEIGHTED_MEAN, 2, 30, sources, now).value).toBe(25);
		expect(evaluateAggregate(VirtualAggregateOperator.WEIGHTED_MEAN, 2, 30, sources.reverse(), now).value).toBe(25);
		expect(
			evaluateAggregate(VirtualAggregateOperator.WEIGHTED_MEAN, 2, 30, [input('a', 10), input('b', 30)], now).value,
		).toBe(20);
		expect(
			evaluateAggregate(
				VirtualAggregateOperator.WEIGHTED_MEAN,
				2,
				30,
				[
					{ ...input('a', 10), weight: 1000000 },
					{ ...input('b', 30), exclusion: 'offline' },
				],
				now,
			).reasons[0],
		).toBe('quorum_lost');
	});
	it('avoids overflow of finite weighted products and sums', () => {
		for (const values of [
			[Number.MAX_VALUE, Number.MAX_VALUE],
			[-Number.MAX_VALUE, -Number.MAX_VALUE],
			[Number.MAX_VALUE, -Number.MAX_VALUE],
		]) {
			const sources = values.map((value, index) => ({ ...input(String(index), value), weight: 1000000 }));
			expect(evaluateAggregate(VirtualAggregateOperator.WEIGHTED_MEAN, 2, 30, sources, now).value).toBe(
				values[0] === values[1] ? values[0] : 0,
			);
		}
		const result = evaluateAggregate(
			VirtualAggregateOperator.WEIGHTED_MEAN,
			2,
			30,
			[
				{ ...input('a', Number.MAX_VALUE), weight: 1000000 },
				{ ...input('b', -Number.MAX_VALUE), weight: 0.000001 },
			],
			now,
		);
		expect(Number.isFinite(result.value)).toBe(true);
		expect(result.value).toBeGreaterThan(Number.MAX_VALUE * 0.999999);
	});
	const filter = { kind: VirtualAggregateFilterKind.ABSOLUTE_DEVIATION_FROM_MEDIAN, threshold: 2 };
	it('retains equality, excludes strictly beyond median deviation and renormalizes before quorum', () => {
		const sources = [
			{ ...input('a', 18, 5), weight: 1 },
			{ ...input('b', 20, 3), weight: 3 },
			{ ...input('c', 22, 2), weight: 2 },
			{ ...input('d', 100, 10), weight: 1000000 },
		];
		const result = evaluateAggregate(VirtualAggregateOperator.WEIGHTED_MEAN, 2, 30, sources, now, undefined, filter);
		expect(result.value).toBeCloseTo(20.8);
		expect(result).toMatchObject({
			quality: 'degraded',
			reasons: ['outlier:a', 'outlier:d'],
			sampledAt: sources[1].sample.sampledAt,
		});
		expect(evaluateAggregate(VirtualAggregateOperator.MEAN, 3, 30, sources, now, undefined, filter).reasons).toEqual([
			'quorum_lost',
			'outlier:a',
			'outlier:d',
		]);
		expect(
			evaluateAggregate(
				VirtualAggregateOperator.MEAN,
				3,
				30,
				[input('a', 18), input('b', 20), input('c', 22)],
				now,
				undefined,
				filter,
			),
		).toMatchObject({ value: 20, quality: 'good' });
	});
	it.each(['stale', 'offline', 'invalid'] as const)(
		'requires a qualified cohort of three after %s admission',
		(exclusion) => {
			const sources = [input('a', 20), input('b', 21), { ...input('c', 100), exclusion }];
			expect(evaluateAggregate(VirtualAggregateOperator.MEAN, 1, 30, sources, now, undefined, filter)).toMatchObject({
				value: null,
				quality: 'unavailable',
				reasons: ['insufficient_comparison_cohort', exclusion + ':c'],
			});
		},
	);
	it.each([0, -1, Infinity, NaN])('rejects filter threshold %s', (threshold) => {
		expect(
			evaluateAggregate(
				VirtualAggregateOperator.MEAN,
				1,
				30,
				[input('a', 20), input('b', 20), input('c', 20)],
				now,
				undefined,
				{ ...filter, threshold },
			).reasons,
		).toEqual(['invalid_policy']);
	});
});

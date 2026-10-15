import { QualifiedPropertySample } from '../../../modules/devices/models/property-sample.model';
import { VirtualAggregateFilterKind, VirtualAggregateOperator } from '../entities/virtual-producer.entity';

import { AggregateInputEvidence, evaluateAggregate } from './virtual-aggregate-evaluator';

const now = new Date('2026-10-13T10:00:20Z');
const input = (id: string, value: number | boolean, ageSeconds = 1): AggregateInputEvidence => ({
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

describe('strict fixed-membership binary truth table', () => {
	for (const operator of [VirtualAggregateOperator.ANY, VirtualAggregateOperator.ALL])
		for (const a of [true, false, null])
			for (const b of [true, false, null])
				for (const c of [true, false, null])
					for (const quorum of [1, 2, 3])
						it(`${operator}(${a},${b},${c}) with quorum ${quorum}`, () => {
							const members = [a, b, c];
							const known = members.filter((value) => value !== null);
							const decisive = operator === VirtualAggregateOperator.ANY;
							const expected =
								known.length < quorum
									? null
									: known.includes(decisive)
										? decisive
										: known.length === 3
											? !decisive
											: null;
							const result = evaluateAggregate(
								operator,
								quorum,
								30,
								members.map((value, index) =>
									value === null
										? { id: String(index), sourceIdentity: String(index), sample: null, exclusion: 'missing' }
										: input(String(index), value),
								),
								now,
							);
							expect(result.value).toBe(expected);
							expect(result.quality).toBe(expected === null ? 'unavailable' : known.length === 3 ? 'good' : 'degraded');
						});

	it.each([0, 1, 'true', 'false', NaN])('does not coerce %s into a boolean', (value) => {
		const result = evaluateAggregate(
			VirtualAggregateOperator.ANY,
			2,
			30,
			[input('a', true), input('b', value as never)],
			now,
		);
		expect(result).toMatchObject({ value: null, quality: 'unavailable' });
		expect(result.inputs[1].exclusion).toBe('invalid');
	});

	it('rejects binary weights/filter/grid and expires decisive evidence exactly at its deadline', () => {
		const sources = [input('a', true, 10), input('b', false, 1)];
		const first = evaluateAggregate(VirtualAggregateOperator.ANY, 1, 30, sources, now);
		expect(first.sampledAt).toEqual(sources[0].sample.sampledAt);
		for (const result of [
			evaluateAggregate(VirtualAggregateOperator.ANY, 1, 30, [{ ...sources[0], weight: 2 }, sources[1]], now),
			evaluateAggregate(VirtualAggregateOperator.ALL, 1, 30, sources, now, 1),
			evaluateAggregate(VirtualAggregateOperator.ANY, 1, 30, sources, now, null, {
				kind: VirtualAggregateFilterKind.ABSOLUTE_DEVIATION_FROM_MEDIAN,
				threshold: 1,
			}),
		])
			expect(result.reasons).toContain('invalid_policy');
		expect(
			evaluateAggregate(VirtualAggregateOperator.ANY, 1, 30, sources, new Date(now.getTime() + 20000)),
		).toMatchObject({ value: null, quality: 'unavailable' });
	});
});

describe('declared profile output precision boundaries', () => {
	it.each([
		[1, 0.49, 0],
		[1, 0.5, 1],
		[1, 0.51, 1],
		[1, 99.5, 100],
		[0.1, 0.149, 0.1],
		[0.1, 0.15, 0.2],
		[0.1, 0.151, 0.2],
		[0.1, 99999.99, 100000],
		[0.1, -0.05, 0],
	])('rounds grid %s value %s to %s only after aggregation', (step, value, expected) => {
		const result = evaluateAggregate(
			VirtualAggregateOperator.WEIGHTED_MEAN,
			2,
			30,
			[input('a', value), input('b', value)],
			now,
			step,
		);
		expect(result.value).toBeCloseTo(expected, 10);
		expect(result.quality).toBe('good');
	});
});

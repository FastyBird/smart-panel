import { QualifiedPropertySample } from '../../../modules/devices/models/property-sample.model';
import { VirtualAggregateOperator } from '../entities/virtual-producer.entity';

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
});

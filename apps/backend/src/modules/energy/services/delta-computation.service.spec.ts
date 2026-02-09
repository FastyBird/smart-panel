/*
Reason: The test setup requires dynamic handling that ESLint flags unnecessarily.
*/
import { Logger } from '@nestjs/common';

import { DELTA_INTERVAL_MINUTES, EnergySourceType } from '../energy.constants';

import { DeltaComputationService } from './delta-computation.service';

describe('DeltaComputationService', () => {
	let service: DeltaComputationService;

	beforeEach(() => {
		service = new DeltaComputationService();

		// Suppress logger output in tests
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	const deviceId = 'device-001';
	const sourceType = EnergySourceType.CONSUMPTION_IMPORT;

	describe('first reading (no baseline)', () => {
		it('should store baseline and return null on first reading', () => {
			const result = service.computeDelta(deviceId, sourceType, 100.0, new Date('2026-02-09T12:00:00Z'));

			expect(result).toBeNull();
		});

		it('should store baseline for each device+source independently', () => {
			const result1 = service.computeDelta('dev-a', sourceType, 50.0, new Date('2026-02-09T12:00:00Z'));
			const result2 = service.computeDelta('dev-b', sourceType, 100.0, new Date('2026-02-09T12:00:00Z'));

			expect(result1).toBeNull();
			expect(result2).toBeNull();
		});
	});

	describe('monotonic increase', () => {
		it('should compute delta for a normal monotonic increase', () => {
			service.computeDelta(deviceId, sourceType, 100.0, new Date('2026-02-09T12:00:00Z'));
			const result = service.computeDelta(deviceId, sourceType, 100.5, new Date('2026-02-09T12:01:00Z'));

			expect(result).not.toBeNull();
			expect(result.deltaKwh).toBeCloseTo(0.5);
		});

		it('should compute correct deltas across multiple readings', () => {
			service.computeDelta(deviceId, sourceType, 100.0, new Date('2026-02-09T12:00:00Z'));

			const r1 = service.computeDelta(deviceId, sourceType, 100.5, new Date('2026-02-09T12:01:00Z'));
			expect(r1).not.toBeNull();
			expect(r1.deltaKwh).toBeCloseTo(0.5);

			const r2 = service.computeDelta(deviceId, sourceType, 101.2, new Date('2026-02-09T12:02:00Z'));
			expect(r2).not.toBeNull();
			expect(r2.deltaKwh).toBeCloseTo(0.7);

			const r3 = service.computeDelta(deviceId, sourceType, 102.0, new Date('2026-02-09T12:03:00Z'));
			expect(r3).not.toBeNull();
			expect(r3.deltaKwh).toBeCloseTo(0.8);
		});

		it('should return null when value does not change (zero delta)', () => {
			service.computeDelta(deviceId, sourceType, 100.0, new Date('2026-02-09T12:00:00Z'));
			const result = service.computeDelta(deviceId, sourceType, 100.0, new Date('2026-02-09T12:01:00Z'));

			expect(result).toBeNull();
		});
	});

	describe('meter reset (value drops)', () => {
		it('should detect meter reset and use new value as delta', () => {
			service.computeDelta(deviceId, sourceType, 500.0, new Date('2026-02-09T12:00:00Z'));
			const result = service.computeDelta(deviceId, sourceType, 2.0, new Date('2026-02-09T12:05:00Z'));

			expect(result).not.toBeNull();
			expect(result.deltaKwh).toBeCloseTo(2.0);
		});

		it('should handle reset to zero', () => {
			service.computeDelta(deviceId, sourceType, 100.0, new Date('2026-02-09T12:00:00Z'));
			const result = service.computeDelta(deviceId, sourceType, 0.0, new Date('2026-02-09T12:05:00Z'));

			// Zero delta should return null (no energy consumed)
			expect(result).toBeNull();
		});

		it('should resume normal operation after a reset', () => {
			service.computeDelta(deviceId, sourceType, 500.0, new Date('2026-02-09T12:00:00Z'));
			service.computeDelta(deviceId, sourceType, 2.0, new Date('2026-02-09T12:05:00Z'));

			// After reset, delta should be computed normally from new baseline
			const result = service.computeDelta(deviceId, sourceType, 5.0, new Date('2026-02-09T12:10:00Z'));
			expect(result).not.toBeNull();
			expect(result.deltaKwh).toBeCloseTo(3.0);
		});
	});

	describe('different source types', () => {
		it('should maintain separate baselines for consumption and production', () => {
			service.computeDelta(deviceId, EnergySourceType.CONSUMPTION_IMPORT, 100.0, new Date('2026-02-09T12:00:00Z'));
			service.computeDelta(deviceId, EnergySourceType.GENERATION_PRODUCTION, 50.0, new Date('2026-02-09T12:00:00Z'));

			const consumption = service.computeDelta(
				deviceId,
				EnergySourceType.CONSUMPTION_IMPORT,
				102.0,
				new Date('2026-02-09T12:05:00Z'),
			);
			const production = service.computeDelta(
				deviceId,
				EnergySourceType.GENERATION_PRODUCTION,
				53.0,
				new Date('2026-02-09T12:05:00Z'),
			);

			expect(consumption).not.toBeNull();
			expect(consumption.deltaKwh).toBeCloseTo(2.0);

			expect(production).not.toBeNull();
			expect(production.deltaKwh).toBeCloseTo(3.0);
		});
	});

	describe('interval bucketing', () => {
		it('should align interval to 5-minute boundaries', () => {
			service.computeDelta(deviceId, sourceType, 100.0, new Date('2026-02-09T12:00:00Z'));
			const result = service.computeDelta(deviceId, sourceType, 100.5, new Date('2026-02-09T12:03:27Z'));

			expect(result).not.toBeNull();
			expect(result.intervalStart).toEqual(new Date('2026-02-09T12:00:00Z'));
			expect(result.intervalEnd).toEqual(new Date('2026-02-09T12:05:00Z'));
		});

		it('should place samples at bucket boundary into the correct bucket', () => {
			service.computeDelta(deviceId, sourceType, 100.0, new Date('2026-02-09T12:00:00Z'));
			const result = service.computeDelta(deviceId, sourceType, 100.5, new Date('2026-02-09T12:05:00Z'));

			expect(result).not.toBeNull();
			expect(result.intervalStart).toEqual(new Date('2026-02-09T12:05:00Z'));
			expect(result.intervalEnd).toEqual(new Date('2026-02-09T12:10:00Z'));
		});

		it('should compute correct bucket for samples near midnight', () => {
			service.computeDelta(deviceId, sourceType, 100.0, new Date('2026-02-09T23:57:00Z'));
			const result = service.computeDelta(deviceId, sourceType, 100.5, new Date('2026-02-09T23:59:30Z'));

			expect(result).not.toBeNull();
			expect(result.intervalStart).toEqual(new Date('2026-02-09T23:55:00Z'));
			expect(result.intervalEnd).toEqual(new Date('2026-02-10T00:00:00Z'));
		});
	});

	describe('computeBucket', () => {
		it('should return correct bucket for exact boundary', () => {
			const bucket = service.computeBucket(new Date('2026-02-09T12:00:00Z'));
			expect(bucket.start).toEqual(new Date('2026-02-09T12:00:00Z'));
			expect(bucket.end).toEqual(new Date('2026-02-09T12:05:00Z'));
		});

		it('should return correct bucket for mid-interval timestamp', () => {
			const bucket = service.computeBucket(new Date('2026-02-09T12:07:30Z'));
			expect(bucket.start).toEqual(new Date('2026-02-09T12:05:00Z'));
			expect(bucket.end).toEqual(new Date('2026-02-09T12:10:00Z'));
		});

		it('should produce intervals of exactly DELTA_INTERVAL_MINUTES', () => {
			const bucket = service.computeBucket(new Date('2026-02-09T12:07:30Z'));
			const durationMs = bucket.end.getTime() - bucket.start.getTime();
			expect(durationMs).toBe(DELTA_INTERVAL_MINUTES * 60 * 1000);
		});
	});

	describe('clearBaseline', () => {
		it('should clear baseline so next reading is treated as first', () => {
			service.computeDelta(deviceId, sourceType, 100.0, new Date('2026-02-09T12:00:00Z'));
			service.clearBaseline(deviceId, sourceType);

			// Should be treated as first reading again
			const result = service.computeDelta(deviceId, sourceType, 105.0, new Date('2026-02-09T12:05:00Z'));
			expect(result).toBeNull();
		});
	});

	describe('clearAllBaselines', () => {
		it('should clear all baselines', () => {
			service.computeDelta('dev-a', sourceType, 100.0, new Date('2026-02-09T12:00:00Z'));
			service.computeDelta('dev-b', sourceType, 200.0, new Date('2026-02-09T12:00:00Z'));
			service.clearAllBaselines();

			const r1 = service.computeDelta('dev-a', sourceType, 105.0, new Date('2026-02-09T12:05:00Z'));
			const r2 = service.computeDelta('dev-b', sourceType, 205.0, new Date('2026-02-09T12:05:00Z'));

			expect(r1).toBeNull();
			expect(r2).toBeNull();
		});
	});

	describe('edge cases', () => {
		it('should handle very small deltas', () => {
			service.computeDelta(deviceId, sourceType, 100.0, new Date('2026-02-09T12:00:00Z'));
			const result = service.computeDelta(deviceId, sourceType, 100.001, new Date('2026-02-09T12:01:00Z'));

			expect(result).not.toBeNull();
			expect(result.deltaKwh).toBeCloseTo(0.001);
		});

		it('should handle large cumulative values', () => {
			service.computeDelta(deviceId, sourceType, 999999.0, new Date('2026-02-09T12:00:00Z'));
			const result = service.computeDelta(deviceId, sourceType, 1000000.5, new Date('2026-02-09T12:01:00Z'));

			expect(result).not.toBeNull();
			expect(result.deltaKwh).toBeCloseTo(1.5);
		});
	});
});

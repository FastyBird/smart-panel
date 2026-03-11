/*
Reason: The test setup requires dynamic handling that ESLint flags unnecessarily.
*/
import { Logger } from '@nestjs/common';

import { DELTA_INTERVAL_MINUTES, EnergySourceType } from '../energy.constants';

import { DeltaComputationService } from './delta-computation.service';
import { EnergyMetricsService } from './energy-metrics.service';

describe('DeltaComputationService', () => {
	let service: DeltaComputationService;
	let metrics: EnergyMetricsService;

	let warnSpy: jest.SpyInstance;

	beforeEach(() => {
		metrics = new EnergyMetricsService();
		service = new DeltaComputationService(metrics);

		// Suppress logger output in tests
		warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	const deviceId = 'device-001';
	const channelId = 'channel-001';
	const sourceType = EnergySourceType.CONSUMPTION_IMPORT;

	describe('first reading (no baseline)', () => {
		it('should store baseline and return null on first reading', () => {
			const result = service.computeDelta(deviceId, channelId, sourceType, 100.0, new Date('2026-02-09T12:00:00Z'));

			expect(result).toBeNull();
		});

		it('should store baseline for each device+channel+source independently', () => {
			const result1 = service.computeDelta('dev-a', 'ch-a', sourceType, 50.0, new Date('2026-02-09T12:00:00Z'));
			const result2 = service.computeDelta('dev-b', 'ch-b', sourceType, 100.0, new Date('2026-02-09T12:00:00Z'));

			expect(result1).toBeNull();
			expect(result2).toBeNull();
		});

		it('should increment firstSampleCount metric', () => {
			service.computeDelta(deviceId, channelId, sourceType, 100.0, new Date('2026-02-09T12:00:00Z'));

			expect(metrics.getSnapshot().firstSampleCount).toBe(1);
		});
	});

	describe('monotonic increase', () => {
		it('should compute delta for a normal monotonic increase', () => {
			service.computeDelta(deviceId, channelId, sourceType, 100.0, new Date('2026-02-09T12:00:00Z'));
			const result = service.computeDelta(deviceId, channelId, sourceType, 100.5, new Date('2026-02-09T12:01:00Z'));

			expect(result).not.toBeNull();
			expect(result.deltaKwh).toBeCloseTo(0.5);
		});

		it('should compute correct deltas across multiple readings', () => {
			service.computeDelta(deviceId, channelId, sourceType, 100.0, new Date('2026-02-09T12:00:00Z'));

			const r1 = service.computeDelta(deviceId, channelId, sourceType, 100.5, new Date('2026-02-09T12:01:00Z'));
			expect(r1).not.toBeNull();
			expect(r1.deltaKwh).toBeCloseTo(0.5);

			const r2 = service.computeDelta(deviceId, channelId, sourceType, 101.2, new Date('2026-02-09T12:02:00Z'));
			expect(r2).not.toBeNull();
			expect(r2.deltaKwh).toBeCloseTo(0.7);

			const r3 = service.computeDelta(deviceId, channelId, sourceType, 102.0, new Date('2026-02-09T12:03:00Z'));
			expect(r3).not.toBeNull();
			expect(r3.deltaKwh).toBeCloseTo(0.8);
		});

		it('should return null when value does not change (zero delta)', () => {
			service.computeDelta(deviceId, channelId, sourceType, 100.0, new Date('2026-02-09T12:00:00Z'));
			const result = service.computeDelta(deviceId, channelId, sourceType, 100.0, new Date('2026-02-09T12:01:00Z'));

			expect(result).toBeNull();
		});
	});

	describe('meter reset (value drops)', () => {
		it('should detect meter reset and use new value as delta', () => {
			service.computeDelta(deviceId, channelId, sourceType, 500.0, new Date('2026-02-09T12:00:00Z'));
			const result = service.computeDelta(deviceId, channelId, sourceType, 2.0, new Date('2026-02-09T12:05:00Z'));

			expect(result).not.toBeNull();
			expect(result.deltaKwh).toBeCloseTo(2.0);
		});

		it('should handle reset to zero silently (no warn)', () => {
			service.computeDelta(deviceId, channelId, sourceType, 100.0, new Date('2026-02-09T12:00:00Z'));
			const result = service.computeDelta(deviceId, channelId, sourceType, 0.0, new Date('2026-02-09T12:05:00Z'));

			// Zero delta should return null (no energy consumed)
			expect(result).toBeNull();
			// Should use debug, not warn — relay output off is not an anomaly
			for (const call of warnSpy.mock.calls as unknown[][]) {
				const msg = typeof call[0] === 'string' ? call[0] : '';
				expect(msg).not.toContain('Meter reset detected');
			}
		});

		it('should resume normal operation after relay output off/on cycle', () => {
			// Device consuming energy
			service.computeDelta(deviceId, channelId, sourceType, 500.0, new Date('2026-02-09T12:00:00Z'));
			// Relay output turned off — counter resets to 0
			service.computeDelta(deviceId, channelId, sourceType, 0.0, new Date('2026-02-09T12:05:00Z'));
			// Relay output turned on — counter starts from 0 again
			const result = service.computeDelta(deviceId, channelId, sourceType, 3.0, new Date('2026-02-09T12:10:00Z'));

			expect(result).not.toBeNull();
			expect(result.deltaKwh).toBeCloseTo(3.0);
		});

		it('should resume normal operation after a non-zero reset', () => {
			service.computeDelta(deviceId, channelId, sourceType, 500.0, new Date('2026-02-09T12:00:00Z'));
			service.computeDelta(deviceId, channelId, sourceType, 2.0, new Date('2026-02-09T12:05:00Z'));

			// After reset, delta should be computed normally from new baseline
			const result = service.computeDelta(deviceId, channelId, sourceType, 5.0, new Date('2026-02-09T12:10:00Z'));
			expect(result).not.toBeNull();
			expect(result.deltaKwh).toBeCloseTo(3.0);
		});

		it('should increment negativeDeltaCount metric on meter reset', () => {
			service.computeDelta(deviceId, channelId, sourceType, 500.0, new Date('2026-02-09T12:00:00Z'));
			service.computeDelta(deviceId, channelId, sourceType, 2.0, new Date('2026-02-09T12:05:00Z'));

			expect(metrics.getSnapshot().negativeDeltaCount).toBe(1);
		});
	});

	describe('out-of-order samples', () => {
		it('should still process out-of-order samples (not skip them)', () => {
			service.computeDelta(deviceId, channelId, sourceType, 100.0, new Date('2026-02-09T12:05:00Z'));
			const result = service.computeDelta(deviceId, channelId, sourceType, 101.0, new Date('2026-02-09T12:00:00Z'));

			// Out-of-order samples are processed because timestamps may mix
			// wall-clock fallbacks with real device times
			expect(result).not.toBeNull();
			expect(result.deltaKwh).toBeCloseTo(1.0);
		});

		it('should increment outOfOrderCount metric', () => {
			service.computeDelta(deviceId, channelId, sourceType, 100.0, new Date('2026-02-09T12:05:00Z'));
			service.computeDelta(deviceId, channelId, sourceType, 101.0, new Date('2026-02-09T12:00:00Z'));

			expect(metrics.getSnapshot().outOfOrderCount).toBe(1);
		});

		it('should update baseline even for out-of-order samples', () => {
			service.computeDelta(deviceId, channelId, sourceType, 100.0, new Date('2026-02-09T12:00:00Z'));
			// Out-of-order timestamp, but with a value decrease — treated as meter reset
			service.computeDelta(deviceId, channelId, sourceType, 50.0, new Date('2026-02-09T11:55:00Z'));
			// Baseline is now 50.0, so next reading computes delta from 50
			const result = service.computeDelta(deviceId, channelId, sourceType, 55.0, new Date('2026-02-09T12:05:00Z'));

			expect(result).not.toBeNull();
			expect(result.deltaKwh).toBeCloseTo(5.0);
		});

		it('should flag consecutive stale events by preserving timestamp high-water mark', () => {
			service.computeDelta(deviceId, channelId, sourceType, 100.0, new Date('2026-02-09T12:05:00Z'));
			// First stale sample — flagged
			service.computeDelta(deviceId, channelId, sourceType, 101.0, new Date('2026-02-09T12:00:00Z'));
			// Second stale sample — should also be flagged because 12:02 < 12:05
			service.computeDelta(deviceId, channelId, sourceType, 102.0, new Date('2026-02-09T12:02:00Z'));

			expect(metrics.getSnapshot().outOfOrderCount).toBe(2);
		});
	});

	describe('different source types', () => {
		it('should maintain separate baselines for consumption and production', () => {
			service.computeDelta(
				deviceId,
				'ch-energy',
				EnergySourceType.CONSUMPTION_IMPORT,
				100.0,
				new Date('2026-02-09T12:00:00Z'),
			);
			service.computeDelta(
				deviceId,
				'ch-gen',
				EnergySourceType.GENERATION_PRODUCTION,
				50.0,
				new Date('2026-02-09T12:00:00Z'),
			);

			const consumption = service.computeDelta(
				deviceId,
				'ch-energy',
				EnergySourceType.CONSUMPTION_IMPORT,
				102.0,
				new Date('2026-02-09T12:05:00Z'),
			);
			const production = service.computeDelta(
				deviceId,
				'ch-gen',
				EnergySourceType.GENERATION_PRODUCTION,
				53.0,
				new Date('2026-02-09T12:05:00Z'),
			);

			expect(consumption).not.toBeNull();
			expect(consumption.deltaKwh).toBeCloseTo(2.0);

			expect(production).not.toBeNull();
			expect(production.deltaKwh).toBeCloseTo(3.0);
		});

		it('should maintain separate baselines for grid_import and grid_export', () => {
			service.computeDelta(
				deviceId,
				'ch-import',
				EnergySourceType.GRID_IMPORT,
				200.0,
				new Date('2026-02-09T12:00:00Z'),
			);
			service.computeDelta(deviceId, 'ch-export', EnergySourceType.GRID_EXPORT, 80.0, new Date('2026-02-09T12:00:00Z'));

			const gridImport = service.computeDelta(
				deviceId,
				'ch-import',
				EnergySourceType.GRID_IMPORT,
				205.0,
				new Date('2026-02-09T12:05:00Z'),
			);
			const gridExport = service.computeDelta(
				deviceId,
				'ch-export',
				EnergySourceType.GRID_EXPORT,
				82.0,
				new Date('2026-02-09T12:05:00Z'),
			);

			expect(gridImport).not.toBeNull();
			expect(gridImport.deltaKwh).toBeCloseTo(5.0);

			expect(gridExport).not.toBeNull();
			expect(gridExport.deltaKwh).toBeCloseTo(2.0);
		});

		it('should handle meter reset for grid_import source type', () => {
			service.computeDelta(deviceId, channelId, EnergySourceType.GRID_IMPORT, 500.0, new Date('2026-02-09T12:00:00Z'));
			const result = service.computeDelta(
				deviceId,
				channelId,
				EnergySourceType.GRID_IMPORT,
				10.0,
				new Date('2026-02-09T12:05:00Z'),
			);

			expect(result).not.toBeNull();
			expect(result.deltaKwh).toBeCloseTo(10.0);
			expect(metrics.getSnapshot().negativeDeltaCount).toBe(1);
		});

		it('should handle meter reset for grid_export source type', () => {
			service.computeDelta(deviceId, channelId, EnergySourceType.GRID_EXPORT, 300.0, new Date('2026-02-09T12:00:00Z'));
			const result = service.computeDelta(
				deviceId,
				channelId,
				EnergySourceType.GRID_EXPORT,
				5.0,
				new Date('2026-02-09T12:05:00Z'),
			);

			expect(result).not.toBeNull();
			expect(result.deltaKwh).toBeCloseTo(5.0);
			expect(metrics.getSnapshot().negativeDeltaCount).toBe(1);
		});

		it('should resume normal grid_import deltas after reset', () => {
			service.computeDelta(deviceId, channelId, EnergySourceType.GRID_IMPORT, 500.0, new Date('2026-02-09T12:00:00Z'));
			service.computeDelta(deviceId, channelId, EnergySourceType.GRID_IMPORT, 10.0, new Date('2026-02-09T12:05:00Z'));

			const result = service.computeDelta(
				deviceId,
				channelId,
				EnergySourceType.GRID_IMPORT,
				15.0,
				new Date('2026-02-09T12:10:00Z'),
			);

			expect(result).not.toBeNull();
			expect(result.deltaKwh).toBeCloseTo(5.0);
		});

		it('should maintain all four source types independently on the same device', () => {
			const ts1 = new Date('2026-02-09T12:00:00Z');
			const ts2 = new Date('2026-02-09T12:05:00Z');

			service.computeDelta(deviceId, 'ch-c', EnergySourceType.CONSUMPTION_IMPORT, 100.0, ts1);
			service.computeDelta(deviceId, 'ch-g', EnergySourceType.GENERATION_PRODUCTION, 50.0, ts1);
			service.computeDelta(deviceId, 'ch-i', EnergySourceType.GRID_IMPORT, 200.0, ts1);
			service.computeDelta(deviceId, 'ch-e', EnergySourceType.GRID_EXPORT, 80.0, ts1);

			const r1 = service.computeDelta(deviceId, 'ch-c', EnergySourceType.CONSUMPTION_IMPORT, 110.0, ts2);
			const r2 = service.computeDelta(deviceId, 'ch-g', EnergySourceType.GENERATION_PRODUCTION, 55.0, ts2);
			const r3 = service.computeDelta(deviceId, 'ch-i', EnergySourceType.GRID_IMPORT, 212.0, ts2);
			const r4 = service.computeDelta(deviceId, 'ch-e', EnergySourceType.GRID_EXPORT, 83.0, ts2);

			expect(r1.deltaKwh).toBeCloseTo(10.0);
			expect(r2.deltaKwh).toBeCloseTo(5.0);
			expect(r3.deltaKwh).toBeCloseTo(12.0);
			expect(r4.deltaKwh).toBeCloseTo(3.0);
		});
	});

	describe('multi-channel devices', () => {
		it('should maintain separate baselines for different channels on same device with same source type', () => {
			const ts1 = new Date('2026-02-09T12:00:00Z');
			const ts2 = new Date('2026-02-09T12:05:00Z');

			// Two energy channels on the same device, both reporting consumption
			service.computeDelta(deviceId, 'ch-energy-1', sourceType, 52618.43, ts1);
			service.computeDelta(deviceId, 'ch-energy-2', sourceType, 5427.97, ts1);

			// Next readings — should compute correct deltas without false meter resets
			const r1 = service.computeDelta(deviceId, 'ch-energy-1', sourceType, 52619.0, ts2);
			const r2 = service.computeDelta(deviceId, 'ch-energy-2', sourceType, 5428.5, ts2);

			expect(r1).not.toBeNull();
			expect(r1.deltaKwh).toBeCloseTo(0.57);

			expect(r2).not.toBeNull();
			expect(r2.deltaKwh).toBeCloseTo(0.53);
		});

		it('should not trigger meter reset when channels interleave readings', () => {
			// This is the exact scenario from the bug report
			const ts = new Date('2026-02-09T12:00:00Z');

			service.computeDelta(deviceId, 'ch-1', sourceType, 52618.43, ts);
			service.computeDelta(deviceId, 'ch-2', sourceType, 5427.97, ts);

			// Interleaved updates — ch-1 has higher value, ch-2 has lower
			const r1 = service.computeDelta(deviceId, 'ch-1', sourceType, 52620.0, new Date('2026-02-09T12:05:00Z'));
			const r2 = service.computeDelta(deviceId, 'ch-2', sourceType, 5430.0, new Date('2026-02-09T12:05:00Z'));

			// Both should be normal monotonic deltas, not meter resets
			expect(r1.deltaKwh).toBeCloseTo(1.57);
			expect(r2.deltaKwh).toBeCloseTo(2.03);
			expect(metrics.getSnapshot().negativeDeltaCount).toBe(0);
		});
	});

	describe('interval bucketing', () => {
		it('should align interval to 5-minute boundaries', () => {
			service.computeDelta(deviceId, channelId, sourceType, 100.0, new Date('2026-02-09T12:00:00Z'));
			const result = service.computeDelta(deviceId, channelId, sourceType, 100.5, new Date('2026-02-09T12:03:27Z'));

			expect(result).not.toBeNull();
			expect(result.intervalStart).toEqual(new Date('2026-02-09T12:00:00Z'));
			expect(result.intervalEnd).toEqual(new Date('2026-02-09T12:05:00Z'));
		});

		it('should place samples at bucket boundary into the correct bucket', () => {
			service.computeDelta(deviceId, channelId, sourceType, 100.0, new Date('2026-02-09T12:00:00Z'));
			const result = service.computeDelta(deviceId, channelId, sourceType, 100.5, new Date('2026-02-09T12:05:00Z'));

			expect(result).not.toBeNull();
			expect(result.intervalStart).toEqual(new Date('2026-02-09T12:05:00Z'));
			expect(result.intervalEnd).toEqual(new Date('2026-02-09T12:10:00Z'));
		});

		it('should compute correct bucket for samples near midnight', () => {
			service.computeDelta(deviceId, channelId, sourceType, 100.0, new Date('2026-02-09T23:57:00Z'));
			const result = service.computeDelta(deviceId, channelId, sourceType, 100.5, new Date('2026-02-09T23:59:30Z'));

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
			service.computeDelta(deviceId, channelId, sourceType, 100.0, new Date('2026-02-09T12:00:00Z'));
			service.clearBaseline(deviceId, channelId, sourceType);

			// Should be treated as first reading again
			const result = service.computeDelta(deviceId, channelId, sourceType, 105.0, new Date('2026-02-09T12:05:00Z'));
			expect(result).toBeNull();
		});
	});

	describe('clearDeviceBaselines', () => {
		it('should clear all baselines for a device across all channels and source types', () => {
			service.computeDelta(deviceId, 'ch-1', sourceType, 100.0, new Date('2026-02-09T12:00:00Z'));
			service.computeDelta(deviceId, 'ch-2', sourceType, 200.0, new Date('2026-02-09T12:00:00Z'));
			service.clearDeviceBaselines(deviceId);

			const r1 = service.computeDelta(deviceId, 'ch-1', sourceType, 105.0, new Date('2026-02-09T12:05:00Z'));
			const r2 = service.computeDelta(deviceId, 'ch-2', sourceType, 205.0, new Date('2026-02-09T12:05:00Z'));

			expect(r1).toBeNull();
			expect(r2).toBeNull();
		});

		it('should not affect other devices', () => {
			service.computeDelta('dev-a', 'ch-a', sourceType, 100.0, new Date('2026-02-09T12:00:00Z'));
			service.computeDelta('dev-b', 'ch-b', sourceType, 200.0, new Date('2026-02-09T12:00:00Z'));
			service.clearDeviceBaselines('dev-a');

			const r1 = service.computeDelta('dev-a', 'ch-a', sourceType, 105.0, new Date('2026-02-09T12:05:00Z'));
			const r2 = service.computeDelta('dev-b', 'ch-b', sourceType, 205.0, new Date('2026-02-09T12:05:00Z'));

			expect(r1).toBeNull(); // cleared
			expect(r2).not.toBeNull(); // untouched
			expect(r2.deltaKwh).toBeCloseTo(5.0);
		});
	});

	describe('clearAllBaselines', () => {
		it('should clear all baselines', () => {
			service.computeDelta('dev-a', 'ch-a', sourceType, 100.0, new Date('2026-02-09T12:00:00Z'));
			service.computeDelta('dev-b', 'ch-b', sourceType, 200.0, new Date('2026-02-09T12:00:00Z'));
			service.clearAllBaselines();

			const r1 = service.computeDelta('dev-a', 'ch-a', sourceType, 105.0, new Date('2026-02-09T12:05:00Z'));
			const r2 = service.computeDelta('dev-b', 'ch-b', sourceType, 205.0, new Date('2026-02-09T12:05:00Z'));

			expect(r1).toBeNull();
			expect(r2).toBeNull();
		});
	});

	describe('edge cases', () => {
		it('should handle very small deltas', () => {
			service.computeDelta(deviceId, channelId, sourceType, 100.0, new Date('2026-02-09T12:00:00Z'));
			const result = service.computeDelta(deviceId, channelId, sourceType, 100.001, new Date('2026-02-09T12:01:00Z'));

			expect(result).not.toBeNull();
			expect(result.deltaKwh).toBeCloseTo(0.001);
		});

		it('should handle large cumulative values', () => {
			service.computeDelta(deviceId, channelId, sourceType, 999999.0, new Date('2026-02-09T12:00:00Z'));
			const result = service.computeDelta(deviceId, channelId, sourceType, 1000000.5, new Date('2026-02-09T12:01:00Z'));

			expect(result).not.toBeNull();
			expect(result.deltaKwh).toBeCloseTo(1.5);
		});
	});
});

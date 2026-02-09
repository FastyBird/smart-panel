import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { DELTA_INTERVAL_MINUTES, ENERGY_MODULE_NAME, EnergySourceType } from '../energy.constants';

/**
 * Result of a delta computation.
 * `null` means no delta could be computed (first sample or unknown reset).
 */
export interface DeltaResult {
	deltaKwh: number;
	intervalStart: Date;
	intervalEnd: Date;
}

/**
 * Tracks the baseline (previous cumulative reading) for a single source.
 */
interface BaselineState {
	cumulativeKwh: number;
}

/**
 * Computes energy deltas from cumulative kWh readings.
 *
 * Rules:
 * - If prev is missing: store baseline, produce no delta.
 * - If new >= prev: delta = new - prev (monotonic increase).
 * - If new < prev:
 *   - Treat as meter reset: delta = new (energy accumulated since reset).
 *   - Log the reset event.
 */
@Injectable()
export class DeltaComputationService {
	private readonly logger = createExtensionLogger(ENERGY_MODULE_NAME, 'DeltaComputationService');

	/**
	 * Baselines keyed by `${deviceId}:${sourceType}`.
	 */
	private baselines = new Map<string, BaselineState>();

	/**
	 * Process a new cumulative kWh reading and return a delta if computable.
	 *
	 * @param deviceId The device that reported the reading.
	 * @param sourceType The energy source type.
	 * @param cumulativeKwh The new cumulative kWh value.
	 * @param timestamp When the sample was received.
	 * @returns A DeltaResult if a delta could be computed, null otherwise.
	 */
	computeDelta(
		deviceId: string,
		sourceType: EnergySourceType,
		cumulativeKwh: number,
		timestamp: Date,
	): DeltaResult | null {
		const key = `${deviceId}:${sourceType}`;
		const prev = this.baselines.get(key);

		// Always update baseline to the latest reading
		this.baselines.set(key, { cumulativeKwh });

		if (!prev) {
			this.logger.debug(`First reading for ${key}: ${cumulativeKwh} kWh — storing baseline, no delta`);
			return null;
		}

		let deltaKwh: number;

		if (cumulativeKwh >= prev.cumulativeKwh) {
			// Normal monotonic increase
			deltaKwh = cumulativeKwh - prev.cumulativeKwh;
		} else {
			// Value decreased — meter reset
			this.logger.warn(
				`Meter reset detected for ${key}: prev=${prev.cumulativeKwh}, new=${cumulativeKwh}. Using new value as delta.`,
			);
			deltaKwh = cumulativeKwh;
		}

		// Skip zero deltas (no energy consumed in this interval)
		if (deltaKwh === 0) {
			return null;
		}

		const bucket = this.computeBucket(timestamp);

		return {
			deltaKwh,
			intervalStart: bucket.start,
			intervalEnd: bucket.end,
		};
	}

	/**
	 * Compute the time bucket that contains the given timestamp.
	 * Buckets are aligned to the interval size (e.g., 5-minute boundaries).
	 */
	computeBucket(timestamp: Date): { start: Date; end: Date } {
		const intervalMs = DELTA_INTERVAL_MINUTES * 60 * 1000;
		const bucketStartMs = Math.floor(timestamp.getTime() / intervalMs) * intervalMs;

		return {
			start: new Date(bucketStartMs),
			end: new Date(bucketStartMs + intervalMs),
		};
	}

	/**
	 * Clear baseline for a specific device+source (e.g., on device removal).
	 */
	clearBaseline(deviceId: string, sourceType: EnergySourceType): void {
		this.baselines.delete(`${deviceId}:${sourceType}`);
	}

	/**
	 * Clear all baselines (e.g., on module reset).
	 */
	clearAllBaselines(): void {
		this.baselines.clear();
	}
}

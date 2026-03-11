import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { DELTA_INTERVAL_MINUTES, ENERGY_MODULE_NAME, EnergySourceType } from '../energy.constants';

import { EnergyMetricsService } from './energy-metrics.service';

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
	lastTimestamp: Date;
}

/**
 * Computes energy deltas from cumulative kWh readings.
 *
 * Rules:
 * - If prev is missing: store baseline, produce no delta.
 * - If new >= prev: delta = new - prev (monotonic increase).
 * - If new < prev and new === 0:
 *   - Counter reset to zero (e.g. relay output turned off). Reset baseline, no delta.
 * - If new < prev and new > 0:
 *   - Treat as meter reset: delta = new (energy accumulated since reset). Log warning.
 */
@Injectable()
export class DeltaComputationService {
	private readonly logger = createExtensionLogger(ENERGY_MODULE_NAME, 'DeltaComputationService');

	/**
	 * Baselines keyed by `${deviceId}:${channelId}:${sourceType}`.
	 */
	private baselines = new Map<string, BaselineState>();

	constructor(private readonly metrics: EnergyMetricsService) {}

	/**
	 * Process a new cumulative kWh reading and return a delta if computable.
	 *
	 * @param deviceId The device that reported the reading.
	 * @param channelId The channel that reported the reading.
	 * @param sourceType The energy source type.
	 * @param cumulativeKwh The new cumulative kWh value.
	 * @param timestamp When the sample was received.
	 * @returns A DeltaResult if a delta could be computed, null otherwise.
	 */
	computeDelta(
		deviceId: string,
		channelId: string,
		sourceType: EnergySourceType,
		cumulativeKwh: number,
		timestamp: Date,
	): DeltaResult | null {
		const key = `${deviceId}:${channelId}:${sourceType}`;
		const prev = this.baselines.get(key);

		// Detect out-of-order samples (log + count) but still process them.
		// Timestamps may mix wall-clock fallbacks with real device times,
		// so rejecting would suppress legitimate deltas.
		if (prev && timestamp < prev.lastTimestamp) {
			this.logger.warn(
				`Out-of-order sample for device=${deviceId} sourceType=${sourceType}: ` +
					`received=${timestamp.toISOString()}, lastSeen=${prev.lastTimestamp.toISOString()}, ` +
					`cumulativeKwh=${cumulativeKwh}, prevKwh=${prev.cumulativeKwh}. Processing anyway.`,
			);
			this.metrics.recordOutOfOrder();
		}

		// Update baseline: always store the latest cumulative reading, but only
		// advance lastTimestamp when the incoming sample is newer to avoid
		// regressing the high-water mark and underreporting out-of-order events.
		const highWaterTimestamp = prev && prev.lastTimestamp > timestamp ? prev.lastTimestamp : timestamp;
		this.baselines.set(key, { cumulativeKwh, lastTimestamp: highWaterTimestamp });

		if (!prev) {
			this.logger.debug(
				`First reading for device=${deviceId} sourceType=${sourceType}: ${cumulativeKwh} kWh — storing baseline, no delta`,
			);
			this.metrics.recordFirstSample();
			return null;
		}

		let deltaKwh: number;

		if (cumulativeKwh >= prev.cumulativeKwh) {
			// Normal monotonic increase
			deltaKwh = cumulativeKwh - prev.cumulativeKwh;
		} else if (cumulativeKwh === 0) {
			// Counter reset to zero — normal for relay-based devices (e.g. Shelly)
			// when the output is turned off. Just reset baseline, no delta.
			this.logger.debug(
				`Counter reset to zero for device=${deviceId} sourceType=${sourceType}: ` +
					`prev=${prev.cumulativeKwh}, timestamp=${timestamp.toISOString()}. Resetting baseline.`,
			);
			this.metrics.recordNegativeDelta();
			deltaKwh = 0;
		} else {
			// Value decreased to non-zero — unusual meter reset
			this.logger.warn(
				`Meter reset detected for device=${deviceId} sourceType=${sourceType}: ` +
					`prev=${prev.cumulativeKwh}, new=${cumulativeKwh}, ` +
					`timestamp=${timestamp.toISOString()}, reset_behavior=treat_as_reset. Using new value as delta.`,
			);
			this.metrics.recordNegativeDelta();
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
	 * Clear baseline for a specific device+channel+source (e.g., on channel removal).
	 */
	clearBaseline(deviceId: string, channelId: string, sourceType: EnergySourceType): void {
		this.baselines.delete(`${deviceId}:${channelId}:${sourceType}`);
	}

	/**
	 * Clear all baselines for a specific device (e.g., on device removal).
	 */
	clearDeviceBaselines(deviceId: string): void {
		const prefix = `${deviceId}:`;
		for (const key of this.baselines.keys()) {
			if (key.startsWith(prefix)) {
				this.baselines.delete(key);
			}
		}
	}

	/**
	 * Clear all baselines (e.g., on module reset).
	 */
	clearAllBaselines(): void {
		this.baselines.clear();
	}
}

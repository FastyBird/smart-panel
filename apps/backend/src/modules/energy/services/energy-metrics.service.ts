import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { ENERGY_MODULE_NAME } from '../energy.constants';

export interface EnergyMetricsSnapshot {
	samplesProcessed: number;
	deltasCreated: number;
	negativeDeltaCount: number;
	outOfOrderCount: number;
	firstSampleCount: number;
}

/**
 * Lightweight in-memory counters for energy ingestion observability.
 * Tracks throughput and anomaly rates without external dependencies.
 */
@Injectable()
export class EnergyMetricsService {
	private readonly logger = createExtensionLogger(ENERGY_MODULE_NAME, 'EnergyMetricsService');

	private samplesProcessed = 0;
	private deltasCreated = 0;
	private negativeDeltaCount = 0;
	private outOfOrderCount = 0;
	private firstSampleCount = 0;

	recordSampleProcessed(): void {
		this.samplesProcessed++;
	}

	recordDeltaCreated(): void {
		this.deltasCreated++;
	}

	recordNegativeDelta(): void {
		this.negativeDeltaCount++;
	}

	recordOutOfOrder(): void {
		this.outOfOrderCount++;
	}

	recordFirstSample(): void {
		this.firstSampleCount++;
	}

	getSnapshot(): EnergyMetricsSnapshot {
		return {
			samplesProcessed: this.samplesProcessed,
			deltasCreated: this.deltasCreated,
			negativeDeltaCount: this.negativeDeltaCount,
			outOfOrderCount: this.outOfOrderCount,
			firstSampleCount: this.firstSampleCount,
		};
	}

	/**
	 * Reset all counters. Useful for periodic reporting windows.
	 */
	reset(): void {
		this.samplesProcessed = 0;
		this.deltasCreated = 0;
		this.negativeDeltaCount = 0;
		this.outOfOrderCount = 0;
		this.firstSampleCount = 0;
	}
}

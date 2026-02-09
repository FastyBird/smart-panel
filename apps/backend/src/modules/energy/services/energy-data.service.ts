import { Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { ENERGY_MODULE_NAME, EnergySourceType } from '../energy.constants';
import { EnergyDeltaEntity } from '../entities/energy-delta.entity';

export interface EnergySummary {
	totalConsumptionKwh: number;
	totalProductionKwh: number;
	lastUpdatedAt: string | null;
}

export interface EnergyDeltaRow {
	intervalStart: string;
	intervalEnd: string;
	consumptionDeltaKwh: number;
	productionDeltaKwh: number;
}

interface SummaryRawRow {
	sourceType: EnergySourceType;
	totalKwh: number | null;
	lastUpdated: string | null;
}

interface DeltaRawRow {
	intervalStart: string;
	intervalEnd: string;
	sourceType: EnergySourceType;
	totalKwh: number | null;
}

@Injectable()
export class EnergyDataService {
	private readonly logger = createExtensionLogger(ENERGY_MODULE_NAME, 'EnergyDataService');

	constructor(
		@InjectRepository(EnergyDeltaEntity)
		private readonly deltaRepository: Repository<EnergyDeltaEntity>,
	) {}

	/**
	 * Persist a delta record. If a record already exists for the same
	 * device + sourceType + intervalStart, accumulate the delta.
	 */
	async saveDelta(params: {
		deviceId: string;
		roomId: string | null;
		sourceType: EnergySourceType;
		deltaKwh: number;
		intervalStart: Date;
		intervalEnd: Date;
	}): Promise<void> {
		const { deviceId, roomId, sourceType, deltaKwh, intervalStart, intervalEnd } = params;

		// Check if a delta already exists for this bucket
		const existing = await this.deltaRepository.findOne({
			where: {
				deviceId,
				sourceType,
				intervalStart: intervalStart.toISOString() as unknown as Date,
			},
		});

		if (existing) {
			// Accumulate into existing bucket
			const newDelta = (typeof existing.deltaKwh === 'number' ? existing.deltaKwh : 0) + deltaKwh;

			await this.deltaRepository.update(existing.id, { deltaKwh: newDelta });

			this.logger.debug(
				`Accumulated delta for device=${deviceId} source=${sourceType} bucket=${intervalStart.toISOString()}: ${existing.deltaKwh} + ${deltaKwh} = ${newDelta}`,
			);
		} else {
			const entity = this.deltaRepository.create({
				deviceId,
				roomId,
				sourceType,
				deltaKwh,
				intervalStart: intervalStart.toISOString(),
				intervalEnd: intervalEnd.toISOString(),
			});

			await this.deltaRepository.save(entity);

			this.logger.debug(
				`Saved delta for device=${deviceId} source=${sourceType} bucket=${intervalStart.toISOString()}: ${deltaKwh} kWh`,
			);
		}
	}

	/**
	 * Get energy summary for a time range, optionally filtered by room.
	 */
	async getSummary(rangeStart: Date, rangeEnd: Date, roomId?: string): Promise<EnergySummary> {
		const qb = this.deltaRepository.createQueryBuilder('delta');

		qb.select('delta.sourceType', 'sourceType')
			.addSelect('SUM(delta.deltaKwh)', 'totalKwh')
			.addSelect('MAX(delta.createdAt)', 'lastUpdated')
			.where('delta.intervalStart >= :rangeStart', { rangeStart: rangeStart.toISOString() })
			.andWhere('delta.intervalEnd <= :rangeEnd', { rangeEnd: rangeEnd.toISOString() })
			.groupBy('delta.sourceType');

		if (roomId) {
			qb.andWhere('delta.roomId = :roomId', { roomId });
		}

		const rows: SummaryRawRow[] = await qb.getRawMany<SummaryRawRow>();

		let totalConsumptionKwh = 0;
		let totalProductionKwh = 0;
		let lastUpdatedAt: string | null = null;

		for (const row of rows) {
			const kwh = Number(row.totalKwh) || 0;

			if (row.sourceType === EnergySourceType.CONSUMPTION_IMPORT) {
				totalConsumptionKwh = kwh;
			} else if (row.sourceType === EnergySourceType.GENERATION_PRODUCTION) {
				totalProductionKwh = kwh;
			}

			if (row.lastUpdated && (!lastUpdatedAt || row.lastUpdated > lastUpdatedAt)) {
				lastUpdatedAt = row.lastUpdated;
			}
		}

		return { totalConsumptionKwh, totalProductionKwh, lastUpdatedAt };
	}

	/**
	 * Get energy deltas for a time range, optionally filtered by room.
	 * Results are aggregated by interval bucket across all devices.
	 */
	async getDeltas(rangeStart: Date, rangeEnd: Date, roomId?: string): Promise<EnergyDeltaRow[]> {
		const qb = this.deltaRepository.createQueryBuilder('delta');

		qb.select('delta.intervalStart', 'intervalStart')
			.addSelect('delta.intervalEnd', 'intervalEnd')
			.addSelect('delta.sourceType', 'sourceType')
			.addSelect('SUM(delta.deltaKwh)', 'totalKwh')
			.where('delta.intervalStart >= :rangeStart', { rangeStart: rangeStart.toISOString() })
			.andWhere('delta.intervalEnd <= :rangeEnd', { rangeEnd: rangeEnd.toISOString() })
			.groupBy('delta.intervalStart')
			.addGroupBy('delta.intervalEnd')
			.addGroupBy('delta.sourceType')
			.orderBy('delta.intervalStart', 'ASC');

		if (roomId) {
			qb.andWhere('delta.roomId = :roomId', { roomId });
		}

		const rows: DeltaRawRow[] = await qb.getRawMany<DeltaRawRow>();

		// Merge consumption + production into a single row per interval
		const bucketMap = new Map<
			string,
			{
				intervalStart: string;
				intervalEnd: string;
				consumptionDeltaKwh: number;
				productionDeltaKwh: number;
			}
		>();

		for (const row of rows) {
			const key: string = row.intervalStart;
			let bucket = bucketMap.get(key);

			if (!bucket) {
				bucket = {
					intervalStart: row.intervalStart,
					intervalEnd: row.intervalEnd,
					consumptionDeltaKwh: 0,
					productionDeltaKwh: 0,
				};
				bucketMap.set(key, bucket);
			}

			const kwh = Number(row.totalKwh) || 0;

			if (row.sourceType === EnergySourceType.CONSUMPTION_IMPORT) {
				bucket.consumptionDeltaKwh = kwh;
			} else if (row.sourceType === EnergySourceType.GENERATION_PRODUCTION) {
				bucket.productionDeltaKwh = kwh;
			}
		}

		return Array.from(bucketMap.values());
	}
}

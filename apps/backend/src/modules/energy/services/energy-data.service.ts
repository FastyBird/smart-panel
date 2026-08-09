import { Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { DELTA_INTERVAL_MINUTES, ENERGY_MODULE_NAME, EnergySourceType } from '../energy.constants';
import { EnergyDeltaEntity } from '../entities/energy-delta.entity';
import { getLocalMidnight, getLocalMidnightDaysAgo } from '../helpers/energy-range.helper';

export interface EnergySummary {
	totalConsumptionKwh: number;
	totalProductionKwh: number;
	totalGridImportKwh: number;
	totalGridExportKwh: number;
	hasGridMetrics: boolean;
	lastUpdatedAt: string | null;
}

export interface EnergyDeltaRow {
	intervalStart: string;
	intervalEnd: string;
	consumptionDeltaKwh: number;
	productionDeltaKwh: number;
	gridImportDeltaKwh: number;
	gridExportDeltaKwh: number;
}

export interface SpaceEnergySummary {
	totalConsumptionKwh: number;
	totalProductionKwh: number;
	totalGridImportKwh: number;
	totalGridExportKwh: number;
	netKwh: number;
	netGridKwh: number;
	hasGridMetrics: boolean;
	lastUpdatedAt: string | null;
}

export interface TimeseriesPoint {
	intervalStart: string;
	intervalEnd: string;
	consumptionDeltaKwh: number;
	productionDeltaKwh: number;
	gridImportDeltaKwh: number;
	gridExportDeltaKwh: number;
}

export interface BreakdownItem {
	deviceId: string;
	deviceName: string;
	roomId: string | null;
	roomName: string | null;
	consumptionKwh: number;
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

interface TimeseriesRawRow {
	bucket: string;
	sourceType: EnergySourceType;
	totalKwh: number | null;
}

interface BreakdownRawRow {
	deviceId: string;
	deviceName: string;
	roomId: string | null;
	roomName: string | null;
	/** Selected only to resolve `roomId` and `roomName` against the device's last recorded delta. */
	lastIntervalStart: string | null;
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
	 * device + sourceType + intervalStart, atomically accumulate the delta.
	 *
	 * Uses SQLite's INSERT ... ON CONFLICT ... DO UPDATE (upsert) to avoid
	 * race conditions when concurrent events target the same bucket.
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

		const intervalStartStr = intervalStart.toISOString();
		const intervalEndStr = intervalEnd.toISOString();

		// Atomic upsert: insert a new row or accumulate deltaKwh into the existing bucket.
		// Uses SQLite's INSERT ... ON CONFLICT ... DO UPDATE to avoid race conditions
		// when concurrent events target the same (deviceId, sourceType, intervalStart) bucket.
		// The unique constraint UQ_energy_deltas_device_source_interval enforces this at the DB level.
		//
		// The room comes along on conflict, so a device that changes room mid-interval stops filling the
		// row the old room owns. Without it the readers above would go on adding this device's new
		// consumption to its former room until the bucket closed, which is the same defect they were
		// just fixed for, arriving from the write side.
		//
		// The bucket *moves* rather than splitting, and that is a deliberate trade. Splitting means the
		// room joins the unique key, and a nullable column in a SQLite unique index does not conflict
		// with itself — every reading from a device in no room would open its own row instead of
		// accumulating. Working around that takes an expression index the entity decorators cannot
		// declare, which CI and the e2e suite build the schema from. So the residue is that up to one
		// interval of energy recorded just before a move is attributed to the room the device ended it
		// in: bounded by DELTA_INTERVAL_MINUTES, and on the side of where the operator has just put the
		// device rather than where it used to be.
		await this.deltaRepository.query(
			`INSERT INTO energy_module_deltas ("id", "deviceId", "roomId", "sourceType", "deltaKwh", "intervalStart", "intervalEnd", "createdAt")
			 VALUES (
			   lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
			   ?, ?, ?, ?, ?, ?, datetime('now')
			 )
			 ON CONFLICT ("deviceId", "sourceType", "intervalStart")
			 DO UPDATE SET "deltaKwh" = "deltaKwh" + excluded."deltaKwh", "roomId" = excluded."roomId"`,
			[deviceId, roomId, sourceType, deltaKwh, intervalStartStr, intervalEndStr],
		);

		this.logger.debug(
			`Upserted delta for device=${deviceId} source=${sourceType} bucket=${intervalStartStr}: ${deltaKwh} kWh`,
		);
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
			.andWhere('delta.intervalStart < :rangeEnd', { rangeEnd: rangeEnd.toISOString() })
			.groupBy('delta.sourceType');

		if (roomId) {
			qb.andWhere('delta.roomId = :roomId', { roomId });
		}

		const rows: SummaryRawRow[] = await qb.getRawMany<SummaryRawRow>();

		let totalConsumptionKwh = 0;
		let totalProductionKwh = 0;
		let totalGridImportKwh = 0;
		let totalGridExportKwh = 0;
		let hasGridMetrics = false;
		let lastUpdatedAt: string | null = null;

		for (const row of rows) {
			const kwh = Number(row.totalKwh) || 0;

			if (row.sourceType === EnergySourceType.CONSUMPTION_IMPORT) {
				totalConsumptionKwh = kwh;
			} else if (row.sourceType === EnergySourceType.GENERATION_PRODUCTION) {
				totalProductionKwh = kwh;
			} else if (row.sourceType === EnergySourceType.GRID_IMPORT) {
				totalGridImportKwh = kwh;
				hasGridMetrics = true;
			} else if (row.sourceType === EnergySourceType.GRID_EXPORT) {
				totalGridExportKwh = kwh;
				hasGridMetrics = true;
			}

			if (row.lastUpdated && (!lastUpdatedAt || row.lastUpdated > lastUpdatedAt)) {
				lastUpdatedAt = row.lastUpdated;
			}
		}

		return {
			totalConsumptionKwh,
			totalProductionKwh,
			totalGridImportKwh,
			totalGridExportKwh,
			hasGridMetrics,
			lastUpdatedAt,
		};
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
			.andWhere('delta.intervalStart < :rangeEnd', { rangeEnd: rangeEnd.toISOString() })
			.groupBy('delta.intervalStart')
			.addGroupBy('delta.intervalEnd')
			.addGroupBy('delta.sourceType')
			.orderBy('delta.intervalStart', 'ASC');

		if (roomId) {
			qb.andWhere('delta.roomId = :roomId', { roomId });
		}

		const rows: DeltaRawRow[] = await qb.getRawMany<DeltaRawRow>();

		// Merge all source types into a single row per interval
		const bucketMap = new Map<string, EnergyDeltaRow>();

		for (const row of rows) {
			const key: string = row.intervalStart;
			let bucket = bucketMap.get(key);

			if (!bucket) {
				bucket = {
					intervalStart: row.intervalStart,
					intervalEnd: row.intervalEnd,
					consumptionDeltaKwh: 0,
					productionDeltaKwh: 0,
					gridImportDeltaKwh: 0,
					gridExportDeltaKwh: 0,
				};
				bucketMap.set(key, bucket);
			}

			const kwh = Number(row.totalKwh) || 0;

			if (row.sourceType === EnergySourceType.CONSUMPTION_IMPORT) {
				bucket.consumptionDeltaKwh = kwh;
			} else if (row.sourceType === EnergySourceType.GENERATION_PRODUCTION) {
				bucket.productionDeltaKwh = kwh;
			} else if (row.sourceType === EnergySourceType.GRID_IMPORT) {
				bucket.gridImportDeltaKwh = kwh;
			} else if (row.sourceType === EnergySourceType.GRID_EXPORT) {
				bucket.gridExportDeltaKwh = kwh;
			}
		}

		return Array.from(bucketMap.values());
	}

	/**
	 * Get energy summary for a space (aggregated from all rooms belonging to the space).
	 * If spaceId is 'home' or undefined, aggregates across all rooms/spaces.
	 *
	 * Reached through the room the delta was *recorded* with, not the room its device is in now. The
	 * two differ the moment anything moves, and reaching through the device made a move rewrite
	 * history: yesterday's consumption left the room that actually consumed it and appeared in the new
	 * one, while `delta.roomId` sat there unchanged. Deleting the device erased its history from every
	 * space view outright, since the join dropped the rows.
	 *
	 * The room's own membership stays a *current* fact — `parentId` is read from the room row — because
	 * a room moved to another zone is still the same room, and its history moves with it. What is
	 * pinned is which room consumed the energy.
	 */
	async getSpaceSummary(rangeStart: Date, rangeEnd: Date, spaceId?: string): Promise<SpaceEnergySummary> {
		const isHome = !spaceId || spaceId === 'home';

		const query = `
			SELECT delta."sourceType" AS "sourceType",
			       SUM(delta."deltaKwh") AS "totalKwh",
			       MAX(delta."createdAt") AS "lastUpdated"
			FROM energy_module_deltas delta
			${isHome ? '' : `INNER JOIN spaces_module_spaces room ON delta."roomId" = room."id" WHERE (room."id" = ? OR room."parentId" = ?) AND`}
			${isHome ? 'WHERE' : ''}
			delta."intervalStart" >= ?
			AND delta."intervalStart" < ?
			GROUP BY delta."sourceType"
		`;

		const params = isHome
			? [rangeStart.toISOString(), rangeEnd.toISOString()]
			: [spaceId, spaceId, rangeStart.toISOString(), rangeEnd.toISOString()];

		const rows: SummaryRawRow[] = await this.deltaRepository.query(query, params);

		return this.mapSpaceSummary(rows);
	}

	async getDeviceZoneSummary(rangeStart: Date, rangeEnd: Date, zoneId: string): Promise<SpaceEnergySummary> {
		const rows: SummaryRawRow[] = await this.deltaRepository.query(
			`SELECT delta."sourceType" AS "sourceType",
			        SUM(delta."deltaKwh") AS "totalKwh",
			        MAX(delta."createdAt") AS "lastUpdated"
			 FROM energy_module_deltas delta
			 INNER JOIN devices_module_devices_zones deviceZone ON delta."deviceId" = deviceZone."deviceId"
			 WHERE deviceZone."zoneId" = ?
			 AND delta."intervalStart" >= ?
			 AND delta."intervalStart" < ?
			 GROUP BY delta."sourceType"`,
			[zoneId, rangeStart.toISOString(), rangeEnd.toISOString()],
		);

		return this.mapSpaceSummary(rows);
	}

	private mapSpaceSummary(rows: SummaryRawRow[]): SpaceEnergySummary {
		let totalConsumptionKwh = 0;
		let totalProductionKwh = 0;
		let totalGridImportKwh = 0;
		let totalGridExportKwh = 0;
		let hasGridMetrics = false;
		let lastUpdatedAt: string | null = null;

		for (const row of rows) {
			const kwh = Number(row.totalKwh) || 0;

			if (row.sourceType === EnergySourceType.CONSUMPTION_IMPORT) {
				totalConsumptionKwh = kwh;
			} else if (row.sourceType === EnergySourceType.GENERATION_PRODUCTION) {
				totalProductionKwh = kwh;
			} else if (row.sourceType === EnergySourceType.GRID_IMPORT) {
				totalGridImportKwh = kwh;
				hasGridMetrics = true;
			} else if (row.sourceType === EnergySourceType.GRID_EXPORT) {
				totalGridExportKwh = kwh;
				hasGridMetrics = true;
			}

			if (row.lastUpdated && (!lastUpdatedAt || row.lastUpdated > lastUpdatedAt)) {
				lastUpdatedAt = row.lastUpdated;
			}
		}

		return {
			totalConsumptionKwh,
			totalProductionKwh,
			totalGridImportKwh,
			totalGridExportKwh,
			netKwh: totalConsumptionKwh - totalProductionKwh,
			netGridKwh: totalGridImportKwh - totalGridExportKwh,
			hasGridMetrics,
			lastUpdatedAt,
		};
	}

	/**
	 * Get time-series data for a space, aggregated into the requested interval.
	 * Supports 5m (native), 1h, and 1d intervals.
	 * Returns zero-filled points for intervals with no data.
	 *
	 * For 1d intervals, buckets are aligned to rangeStart (which is Prague-midnight-aligned)
	 * rather than UTC midnight, so that "today" in Europe/Prague groups data correctly.
	 *
	 * Scoped by the recorded room, for the reasons `getSpaceSummary` gives — and it matters more here:
	 * a chart is a claim about the past, and one that redraws itself when a device changes room is
	 * claiming something that never happened.
	 */
	async getSpaceTimeseries(
		rangeStart: Date,
		rangeEnd: Date,
		interval: string,
		spaceId?: string,
	): Promise<TimeseriesPoint[]> {
		const isHome = !spaceId || spaceId === 'home';

		// Determine the strftime format for bucketing and interval size
		let strftimeFmt: string;
		let intervalMs: number;

		switch (interval) {
			case '1h':
				strftimeFmt = '%Y-%m-%dT%H:00:00.000Z';
				intervalMs = 60 * 60 * 1000;
				break;
			case '1d':
				// For 1d, bucketing uses actual Prague midnights via getLocalMidnight/getLocalMidnightDaysAgo
				// to handle DST transitions correctly (days can be 23h or 25h).
				strftimeFmt = '';
				intervalMs = 0; // Not used; 1d has its own loop
				break;
			case '5m':
			default:
				// For 5m, use native bucket from intervalStart (already 5m aligned)
				strftimeFmt = '';
				intervalMs = DELTA_INTERVAL_MINUTES * 60 * 1000;
				break;
		}

		// For 1d, fetch raw per-sourceType sums without SQL-level day bucketing,
		// since we need to re-bucket relative to rangeStart (Prague-aligned).
		// For 5m and 1h, use strftime-based SQL bucketing.
		const useSqlBucketing = interval !== '1d' && strftimeFmt !== '';
		const bucketExpr = useSqlBucketing ? `strftime('${strftimeFmt}', delta."intervalStart")` : 'delta."intervalStart"';

		const query = `
			SELECT ${bucketExpr} AS "bucket",
			       delta."sourceType" AS "sourceType",
			       SUM(delta."deltaKwh") AS "totalKwh"
			FROM energy_module_deltas delta
			${isHome ? '' : `INNER JOIN spaces_module_spaces room ON delta."roomId" = room."id" WHERE (room."id" = ? OR room."parentId" = ?) AND`}
			${isHome ? 'WHERE' : ''}
			delta."intervalStart" >= ?
			AND delta."intervalStart" < ?
			GROUP BY "bucket", delta."sourceType"
			ORDER BY "bucket" ASC
		`;

		const params = isHome
			? [rangeStart.toISOString(), rangeEnd.toISOString()]
			: [spaceId, spaceId, rangeStart.toISOString(), rangeEnd.toISOString()];

		const rows: TimeseriesRawRow[] = await this.deltaRepository.query(query, params);

		// For 1d interval, re-bucket raw rows relative to rangeStart (Prague-aligned).
		// For other intervals, use the SQL bucket key directly.
		const rangeStartMs = rangeStart.getTime();
		const bucketMap = new Map<
			string,
			{
				consumptionDeltaKwh: number;
				productionDeltaKwh: number;
				gridImportDeltaKwh: number;
				gridExportDeltaKwh: number;
			}
		>();

		for (const row of rows) {
			let key: string;

			if (interval === '1d') {
				// Compute Prague-midnight for this row's date to handle DST correctly
				key = getLocalMidnight(new Date(row.bucket)).toISOString();
			} else {
				key = row.bucket;
			}

			let bucket = bucketMap.get(key);

			if (!bucket) {
				bucket = { consumptionDeltaKwh: 0, productionDeltaKwh: 0, gridImportDeltaKwh: 0, gridExportDeltaKwh: 0 };
				bucketMap.set(key, bucket);
			}

			const kwh = Number(row.totalKwh) || 0;

			if (row.sourceType === EnergySourceType.CONSUMPTION_IMPORT) {
				bucket.consumptionDeltaKwh += kwh;
			} else if (row.sourceType === EnergySourceType.GENERATION_PRODUCTION) {
				bucket.productionDeltaKwh += kwh;
			} else if (row.sourceType === EnergySourceType.GRID_IMPORT) {
				bucket.gridImportDeltaKwh += kwh;
			} else if (row.sourceType === EnergySourceType.GRID_EXPORT) {
				bucket.gridExportDeltaKwh += kwh;
			}
		}

		// Generate zero-filled points for the full range.
		const points: TimeseriesPoint[] = [];
		const rangeEndMs = rangeEnd.getTime();

		if (interval === '1d') {
			// Compute day boundaries using actual Prague midnights to handle DST correctly.
			// Days during DST transitions are 23h (spring-forward) or 25h (fall-back).
			const dayBoundaries: Date[] = [];
			let current = new Date(rangeStartMs);

			while (current.getTime() < rangeEndMs) {
				dayBoundaries.push(current);
				current = getLocalMidnightDaysAgo(current, -1);
			}

			dayBoundaries.push(current); // end boundary for last bucket

			for (let i = 0; i < dayBoundaries.length - 1; i++) {
				const bucketStart = dayBoundaries[i];
				const bucketEnd = dayBoundaries[i + 1];
				const key = bucketStart.toISOString();
				const data = bucketMap.get(key);

				points.push({
					intervalStart: bucketStart.toISOString(),
					intervalEnd: bucketEnd.toISOString(),
					consumptionDeltaKwh: data?.consumptionDeltaKwh ?? 0,
					productionDeltaKwh: data?.productionDeltaKwh ?? 0,
					gridImportDeltaKwh: data?.gridImportDeltaKwh ?? 0,
					gridExportDeltaKwh: data?.gridExportDeltaKwh ?? 0,
				});
			}
		} else {
			// For 5m and 1h, align to fixed interval boundaries.
			const loopStartMs = Math.floor(rangeStartMs / intervalMs) * intervalMs;

			for (let ts = loopStartMs; ts < rangeEndMs; ts += intervalMs) {
				const bucketStart = new Date(ts);
				const bucketEnd = new Date(ts + intervalMs);
				const key = strftimeFmt === '' ? bucketStart.toISOString() : this.formatBucketKey(bucketStart, interval);
				const data = bucketMap.get(key);

				points.push({
					intervalStart: bucketStart.toISOString(),
					intervalEnd: bucketEnd.toISOString(),
					consumptionDeltaKwh: data?.consumptionDeltaKwh ?? 0,
					productionDeltaKwh: data?.productionDeltaKwh ?? 0,
					gridImportDeltaKwh: data?.gridImportDeltaKwh ?? 0,
					gridExportDeltaKwh: data?.gridExportDeltaKwh ?? 0,
				});
			}
		}

		return points;
	}

	/**
	 * Get a breakdown of top consuming devices for a space.
	 * Only considers consumption_import source type.
	 *
	 * Scoped and reported by the recorded room, like the two readers above. The device join is a LEFT
	 * join for the same reason: it supplies a name, and a name that has gone away is no reason to drop
	 * the consumption from the total — an inner join here erased a deleted device's history from every
	 * space view, which is not what "history is not re-attributed" is supposed to mean.
	 *
	 * One row per device. Where a device consumed in more than one room inside the range, the room
	 * reported is the one it was last recorded in: SQLite resolves the bare `roomId` and `room.name`
	 * against the row that supplied `MAX(intervalStart)` (documented bare-column behaviour alongside a
	 * single min/max aggregate), which is why that aggregate is selected even though nothing reads it.
	 * The kWh is still the device's whole total for the scope asked about — splitting the row would
	 * report the same device twice in a list the panel renders as one tile per device.
	 */
	async getSpaceBreakdown(
		rangeStart: Date,
		rangeEnd: Date,
		spaceId?: string,
		limit: number = 10,
	): Promise<BreakdownItem[]> {
		const isHome = !spaceId || spaceId === 'home';

		const query = `
			SELECT delta."deviceId" AS "deviceId",
			       device."name" AS "deviceName",
			       delta."roomId" AS "roomId",
			       room."name" AS "roomName",
			       MAX(delta."intervalStart") AS "lastIntervalStart",
			       SUM(delta."deltaKwh") AS "totalKwh"
			FROM energy_module_deltas delta
			LEFT JOIN devices_module_devices device ON delta."deviceId" = device."id"
			LEFT JOIN spaces_module_spaces room ON delta."roomId" = room."id"
			WHERE delta."sourceType" = ?
			AND delta."intervalStart" >= ?
			AND delta."intervalStart" < ?
			${isHome ? '' : `AND (room."id" = ? OR room."parentId" = ?)`}
			GROUP BY delta."deviceId"
			ORDER BY "totalKwh" DESC
			LIMIT ?
		`;

		const params = isHome
			? [EnergySourceType.CONSUMPTION_IMPORT, rangeStart.toISOString(), rangeEnd.toISOString(), limit]
			: [
					EnergySourceType.CONSUMPTION_IMPORT,
					rangeStart.toISOString(),
					rangeEnd.toISOString(),
					spaceId,
					spaceId,
					limit,
				];

		const rows: BreakdownRawRow[] = await this.deltaRepository.query(query, params);

		return rows.map((row) => ({
			deviceId: row.deviceId,
			deviceName: row.deviceName || 'Unknown',
			roomId: row.roomId ?? null,
			roomName: row.roomName ?? null,
			consumptionKwh: Number(row.totalKwh) || 0,
		}));
	}

	/**
	 * Format a bucket start timestamp to match the strftime output format.
	 */
	private formatBucketKey(date: Date, interval: string): string {
		const iso = date.toISOString();

		switch (interval) {
			case '1h':
				return iso.replace(/:\d{2}:\d{2}\.\d{3}Z$/, ':00:00.000Z');
			default:
				return iso;
		}
	}
}

import { Injectable } from '@nestjs/common';

import { InfluxDbService } from '../../influxdb/services/influxdb.service';

@Injectable()
export class StatsService {
	constructor(private readonly influx: InfluxDbService) {}

	async getUpdatesPerMin(): Promise<{ value: number; lastUpdated: Date }> {
		const q = `
    SELECT "cn","cs"
    FROM "min_14d"."property_value_counts_1m"
    ORDER BY time DESC
    LIMIT 1
  `;

		const rows = await this.influx.query<{ cn: number; cs: number; time: Date }>(q);

		const r = rows?.[0];

		// If the latest data point is older than 2 minutes, there have been
		// no recent property-value writes, so the per-minute rate is 0.
		const rowTime = r?.time ? new Date(r.time) : new Date(0);
		const isStale = Date.now() - rowTime.getTime() > 2 * 60 * 1000;

		return {
			value: isStale ? 0 : Number(r?.cn ?? 0) + Number(r?.cs ?? 0),
			lastUpdated: new Date(),
		};
	}

	async getUpdatesToday(midnightIso: string): Promise<{ value: number; lastUpdated: Date }> {
		const q = `
    SELECT COUNT("numberValue") + COUNT("stringValue") AS total
    FROM "raw_24h"."property_value"
    WHERE time >= '${midnightIso}' AND time < now()
  `;

		const rows = await this.influx.query<{ total: number }>(q);

		const total = Number(rows?.[0]?.total ?? 0);

		return { value: total, lastUpdated: new Date() };
	}
}

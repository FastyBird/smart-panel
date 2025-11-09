import { Injectable } from '@nestjs/common';

import { toInstance } from '../../../common/utils/transform.utils';
import { InfluxDbService } from '../../influxdb/services/influxdb.service';
import { StatsProvider } from '../../stats/stats.interfaces';
import { ModuleStatsModel } from '../models/api.model';

@Injectable()
export class ApiStatsProvider implements StatsProvider {
	constructor(private readonly influxDbService: InfluxDbService) {}

	async getStats(): Promise<ModuleStatsModel> {
		const q = `
      SELECT SUM("count") AS c, SUM("errors") AS e, MEAN("p95_ms") AS p95
      FROM "api_minute"
      WHERE time > now() - 5m
    `;

		const rows = await this.influxDbService.query<{ c: number; e: number; p95: number; time: Date }>(q);

		const r = rows?.[0] ?? { c: 0, e: 0, p95: 0, time: new Date() };

		const c = Number(r.c ?? 0);
		const e = Number(r.e ?? 0);
		const p95 = Math.round(Number(r.p95 ?? 0));
		const reqPerMin = Math.round(c / 5);
		const errorRate5m = c ? +((e / c) * 100).toFixed(2) : 0;

		return toInstance(ModuleStatsModel, {
			reqPerMin: { value: reqPerMin, lastUpdated: r.time },
			errorRate5m: { value: errorRate5m, lastUpdated: r.time },
			p95ms5m: { value: p95, lastUpdated: r.time },
		});
	}
}

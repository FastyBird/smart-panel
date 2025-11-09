import { Injectable } from '@nestjs/common';

import { toInstance } from '../../../common/utils/transform.utils';
import { InfluxDbService } from '../../influxdb/services/influxdb.service';
import { StatsProvider } from '../../stats/stats.interfaces';
import { ModuleStatsModel } from '../models/ws.model';

@Injectable()
export class WsStatsProvider implements StatsProvider {
	constructor(private readonly influxDbService: InfluxDbService) {}

	async getStats(): Promise<ModuleStatsModel> {
		const clientsQ = `
      SELECT LAST("clients") AS c
      FROM "ws_conn"
      WHERE time > now() - 10m
    `;

		const rowsC = await this.influxDbService.query<{ c: number; time: Date }>(clientsQ);

		const clientsNow = Number(rowsC?.[0]?.c ?? 0);

		const hbQ = `
      SELECT COUNT("n") AS k
      FROM "ws_heartbeat"
      WHERE time > now() - 5m
    `;

		const rowsH = await this.influxDbService.query<{ k: number; time: Date }>(hbQ);

		const k = Number(rowsH?.[0]?.k ?? 0);

		const expected = 30;

		const availability5m = Math.min(100, +((k / expected) * 100).toFixed(2));

		return toInstance(ModuleStatsModel, {
			clientsNow: {
				value: clientsNow,
				lastUpdated: rowsC?.[0]?.time ?? new Date(),
			},
			availability5m: {
				value: availability5m,
				lastUpdated: rowsH?.[0]?.time ?? new Date(),
			},
		});
	}
}

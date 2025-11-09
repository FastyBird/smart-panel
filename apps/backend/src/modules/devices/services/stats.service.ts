import { Injectable } from '@nestjs/common';

import { InfluxDbService } from '../../influxdb/services/influxdb.service';
import { ConnectionState } from '../devices.constants';
import { DeviceEntity } from '../entities/devices.entity';

@Injectable()
export class StatsService {
	constructor(private readonly influx: InfluxDbService) {}

	async getUpdatesPerMin(): Promise<{ value: number; lastUpdated: Date }> {
		const q = `
      SELECT LAST("cn") AS cn, LAST("cs") AS cs
      FROM "min_14d"."property_value_counts_1m"
      WHERE time > now() - 10m
    `;

		const rows = await this.influx.query<{ cn: number; cs: number; time: Date }>(q);

		const r = rows?.[0] ?? { cn: 0, cs: 0, time: new Date() };

		return { value: Number(r.cn ?? 0) + Number(r.cs ?? 0), lastUpdated: r.time };
	}

	async getUpdatesToday(midnightIso: string): Promise<{ value: number; lastUpdated: Date }> {
		const q = `
      SELECT COUNT("numberValue") AS cn, COUNT("stringValue") AS cs
      FROM "raw_24h"."property_value"
      WHERE time >= '${midnightIso}'
    `;

		const rows = await this.influx.query<{ cn: number; cs: number; time: Date }>(q);

		const r = rows?.[0] ?? { cn: 0, cs: 0, time: new Date() };

		return { value: Number(r.cn ?? 0) + Number(r.cs ?? 0), lastUpdated: r.time };
	}

	async getOnlineNow(): Promise<{ value: number; lastUpdated: Date }> {
		const q = `
      SELECT LAST("online_count") AS online
      FROM "min_14d"."online_count_1m"
      WHERE time > now() - 10m
    `;

		const rows = await this.influx.query<{ online: number; time: Date }>(q);

		return { value: Number(rows?.[0]?.online ?? 0), lastUpdated: rows?.[0]?.time ?? new Date() };
	}

	async getLatestStates(): Promise<
		Record<DeviceEntity['id'], { online: boolean; status: ConnectionState; lastUpdated: Date | null }>
	> {
		const q = `
      SELECT LAST("onlineI") AS onlineI, LAST("status") AS status
      FROM "min_14d"."device_status_1m"
      WHERE time > now() - 10m
      GROUP BY "deviceId"
    `;

		const rows = await this.influx.query<{
			onlineI: number;
			status: string;
			time: Date;
			deviceId?: string;
		}>(q);

		const out: Record<string, { online: boolean; status: ConnectionState; lastUpdated: Date | null }> = {};

		for (const r of rows) {
			out[r.deviceId] = {
				online: Number(r.onlineI ?? 0) > 0,
				status: String(r.status ?? ConnectionState.UNKNOWN) as ConnectionState,
				lastUpdated: r.time,
			};
		}

		return out;
	}
}

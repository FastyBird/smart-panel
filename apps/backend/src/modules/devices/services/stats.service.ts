import { Injectable } from '@nestjs/common';

import { InfluxDbService } from '../../influxdb/services/influxdb.service';
import { ConnectionState } from '../devices.constants';
import { DeviceEntity } from '../entities/devices.entity';

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

	async getOnlineNow(): Promise<{ value: number; lastUpdated: Date }> {
		// Compute online count from per-device last-known state in the
		// 14-day retention policy.  The previous approach queried the
		// pre-aggregated "online_count_1m" measurement, but that is fed
		// by a CQ chain rooted in "raw_24h" — once all devices are stable
		// for >24 h the source data expires and the CQ stops producing
		// output, making the count and timestamp stale.
		const states = await this.getLatestStates();

		const onlineCount = Object.values(states).filter((s) => s.online).length;

		return {
			value: onlineCount,
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

	async getLatestStates(): Promise<
		Record<DeviceEntity['id'], { online: boolean; status: ConnectionState; lastUpdated: Date | null }>
	> {
		const q = `
			SELECT LAST("onlineI") AS onlineI, LAST("status") AS status
			FROM "min_14d"."device_status_1m"
			GROUP BY "deviceId"
		`;

		const rows = await this.influx.query<{
			onlineI: number;
			status: string;
			time: Date;
			deviceId?: string;
		}>(q);

		const out: Record<string, { online: boolean; status: ConnectionState; lastUpdated: Date | null }> = {};

		for (const r of rows ?? []) {
			if (!r.deviceId) {
				continue;
			}

			out[r.deviceId] = {
				online: Number(r.onlineI ?? 0) > 0,
				status: (r.status ?? ConnectionState.UNKNOWN) as ConnectionState,
				lastUpdated: r.time ?? null,
			};
		}

		return out;
	}
}

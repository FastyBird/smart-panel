import { Injectable, Logger } from '@nestjs/common';

import { InfluxDbService } from '../../influxdb/services/influxdb.service';
import { ConnectionState, OnlineDisplayState } from '../displays.constants';
import { DisplayEntity } from '../entities/displays.entity';

@Injectable()
export class DisplayConnectionStateService {
	private readonly logger = new Logger(DisplayConnectionStateService.name);

	private statusMap: Map<DisplayEntity['id'], { online: boolean; status: ConnectionState }> = new Map();

	constructor(private readonly influxDbService: InfluxDbService) {}

	async write(display: DisplayEntity, status: ConnectionState): Promise<void> {
		if (this.statusMap.has(display.id) && this.statusMap.get(display.id)?.status === status) {
			// no change → skip Influx write
			return;
		}

		try {
			const isOnline = OnlineDisplayState.includes(status);

			await this.influxDbService.writePoints([
				{
					measurement: 'display_status',
					tags: { displayId: display.id },
					fields: {
						online: isOnline,
						onlineI: isOnline ? 1 : 0,
						status,
					},
					timestamp: new Date(),
				},
			]);

			this.statusMap.set(display.id, { online: isOnline, status });

			this.logger.debug(`[DISPLAY] Status saved id=${display.id} status=${status}`);
		} catch (error) {
			const err = error as Error;

			this.logger.error(
				`[DISPLAY] Failed to write status to InfluxDB id=${display.id} error=${err.message}`,
				err.stack,
			);
		}
	}

	async readLatest(display: DisplayEntity): Promise<{ online: boolean; status: ConnectionState }> {
		try {
			if (this.statusMap.has(display.id)) {
				this.logger.debug(
					`[DISPLAY] Loaded cached status for display id=${display.id}, status=${this.statusMap.get(display.id)?.status}`,
				);

				return this.statusMap.get(display.id);
			}

			const query = `
        SELECT * FROM display_status
        WHERE displayId = '${display.id}'
        ORDER BY time DESC
        LIMIT 1
      `;

			this.logger.debug(`[DISPLAY] Fetching latest status id=${display.id}`);

			const result = await this.influxDbService.query<{
				online: boolean;
				onlineI: number;
				status: ConnectionState;
				displayId: DisplayEntity['id'];
			}>(query);

			if (!result.length) {
				this.logger.debug(`[DISPLAY] No stored status found for id=${display.id}`);

				return {
					online: false,
					status: ConnectionState.UNKNOWN,
				};
			}

			const latest = result[0];

			this.logger.debug(`[DISPLAY] Read latest value id=${display.id} status=${latest.status}`);

			this.statusMap.set(display.id, { online: latest.online, status: latest.status });

			return latest;
		} catch (error) {
			const err = error as Error;

			this.logger.error(
				`[DISPLAY] Failed to read latest status from InfluxDB id=${display.id} error=${err.message}`,
				err.stack,
			);

			return {
				online: false,
				status: ConnectionState.UNKNOWN,
			};
		}
	}

	async delete(display: DisplayEntity): Promise<void> {
		try {
			const query = `DELETE FROM display_status WHERE displayId = '${display.id}'`;

			await this.influxDbService.query(query);

			this.statusMap.delete(display.id);

			this.logger.log(`[DISPLAY] Deleted display status for id=${display.id}`);
		} catch (error) {
			const err = error as Error;

			this.logger.error(
				`[DISPLAY] Failed to delete display status from InfluxDB id=${display.id} error=${err.message}`,
				err.stack,
			);
		}
	}
}

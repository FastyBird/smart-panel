import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { InfluxDbService } from '../../influxdb/services/influxdb.service';
import { ConnectionState, DISPLAYS_MODULE_NAME, OnlineDisplayState } from '../displays.constants';
import { DisplayEntity } from '../entities/displays.entity';

@Injectable()
export class DisplayConnectionStateService {
	private readonly logger = createExtensionLogger(DISPLAYS_MODULE_NAME, 'DisplayConnectionStateService');

	private statusMap: Map<DisplayEntity['id'], { online: boolean; status: ConnectionState }> = new Map();

	constructor(private readonly influxDbService: InfluxDbService) {}

	async write(display: DisplayEntity, status: ConnectionState): Promise<void> {
		if (this.statusMap.has(display.id) && this.statusMap.get(display.id)?.status === status) {
			// no change → skip Influx write
			return;
		}

		const isOnline = OnlineDisplayState.includes(status);

		// Update local cache regardless of InfluxDB availability
		this.statusMap.set(display.id, { online: isOnline, status });

		if (!this.influxDbService.isConnected()) {
			return;
		}

		try {
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
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to write status to InfluxDB id=${display.id} error=${err.message}`, err.stack);
		}
	}

	async readLatest(display: DisplayEntity): Promise<{ online: boolean; status: ConnectionState }> {
		// Check local cache first
		if (this.statusMap.has(display.id)) {
			return this.statusMap.get(display.id);
		}

		// Return default if InfluxDB not connected
		if (!this.influxDbService.isConnected()) {
			return {
				online: false,
				status: ConnectionState.UNKNOWN,
			};
		}

		try {
			const query = `
        SELECT * FROM display_status
        WHERE displayId = '${display.id}'
        ORDER BY time DESC
        LIMIT 1
      `;

			const result = await this.influxDbService.query<{
				online: boolean;
				onlineI: number;
				status: ConnectionState;
				displayId: DisplayEntity['id'];
			}>(query);

			if (!result.length) {
				return {
					online: false,
					status: ConnectionState.UNKNOWN,
				};
			}

			const latest = result[0];

			this.statusMap.set(display.id, { online: latest.online, status: latest.status });

			return latest;
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to read latest status from InfluxDB id=${display.id} error=${err.message}`, err.stack);

			return {
				online: false,
				status: ConnectionState.UNKNOWN,
			};
		}
	}

	async delete(display: DisplayEntity): Promise<void> {
		// Always clear local cache
		this.statusMap.delete(display.id);

		if (!this.influxDbService.isConnected()) {
			return;
		}

		try {
			const query = `DELETE FROM display_status WHERE displayId = '${display.id}'`;

			await this.influxDbService.query(query);

			this.logger.log(`Deleted display status for id=${display.id}`);
		} catch (error) {
			const err = error as Error;

			this.logger.error(
				`Failed to delete display status from InfluxDB id=${display.id} error=${err.message}`,
				err.stack,
			);
		}
	}
}

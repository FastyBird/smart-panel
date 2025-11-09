import { Injectable, Logger } from '@nestjs/common';

import { InfluxDbService } from '../../influxdb/services/influxdb.service';
import { ConnectionState, OnlineDeviceState, PropertyCategory } from '../devices.constants';
import { ChannelPropertyEntity, DeviceEntity } from '../entities/devices.entity';

@Injectable()
export class DeviceStatusService {
	private readonly logger = new Logger(DeviceStatusService.name);

	private statusMap: Map<DeviceEntity['id'], { online: boolean; status: ConnectionState }> = new Map();
	private statusPropertyMap: Map<DeviceEntity['id'], ChannelPropertyEntity['id']> = new Map();

	constructor(private readonly influxDbService: InfluxDbService) {}

	async write(device: DeviceEntity, property: ChannelPropertyEntity, status: ConnectionState): Promise<void> {
		if (property.category !== PropertyCategory.STATUS) {
			this.logger.error(
				`[DEVICE] Failed to write device provided property if=${property.id} is not device status property`,
			);

			return;
		}

		if (this.statusMap.has(device.id) && this.statusMap.get(device.id).status === status) {
			// no change → skip Influx write
			return;
		}

		try {
			const isOnline = OnlineDeviceState.includes(status);

			await this.influxDbService.writePoints([
				{
					measurement: 'device_status',
					tags: { deviceId: device.id, propertyId: property.id },
					fields: {
						online: isOnline,
						onlineI: isOnline ? 1 : 0,
						status,
					},
					timestamp: new Date(),
				},
			]);

			this.statusMap.set(device.id, { online: isOnline, status });
			this.statusPropertyMap.set(device.id, property.id);

			this.logger.debug(`[DEVICE] Status saved id=${device.id} status=${status}`);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`[DEVICE] Failed to write status to InfluxDB id=${device.id} error=${err.message}`, err.stack);
		}
	}

	async readLatest(device: DeviceEntity): Promise<{ online: boolean; status: ConnectionState }> {
		try {
			if (this.statusMap.has(device.id)) {
				this.logger.debug(
					`[DEVICE] Loaded cached status for device id=${device.id}, status=${this.statusMap.get(device.id)?.status}`,
				);

				return this.statusMap.get(device.id);
			}

			const query = `
        SELECT * FROM device_status
        WHERE deviceId = '${device.id}'
        ORDER BY time DESC
        LIMIT 1
      `;

			this.logger.debug(`[DEVICE] Fetching latest status id=${device.id}`);

			const result = await this.influxDbService.query<{
				online: boolean;
				onlineI: number;
				status: ConnectionState;
				deviceId: DeviceEntity['id'];
				propertyId: ChannelPropertyEntity['id'];
			}>(query);

			if (!result.length) {
				this.logger.debug(`[DEVICE] No stored status found for id=${device.id}`);

				return {
					online: false,
					status: ConnectionState.UNKNOWN,
				};
			}

			const latest = result[0];

			this.logger.debug(`[DEVICE] Read latest value id=${device.id} status=${latest.status}`);

			this.statusMap.set(device.id, { online: latest.online, status: latest.status });
			this.statusPropertyMap.set(device.id, latest.propertyId);

			return latest;
		} catch (error) {
			const err = error as Error;

			this.logger.error(
				`[DEVICE] Failed to read latest status from InfluxDB id=${device.id} error=${err.message}`,
				err.stack,
			);

			return {
				online: false,
				status: ConnectionState.UNKNOWN,
			};
		}
	}

	async getOnlineCount(windowMinutes = 15): Promise<number> {
		const query = `
      SELECT SUM(v) FROM (
        SELECT LAST("online") AS v
        FROM device_status
        WHERE time > now() - ${windowMinutes}m
        GROUP BY "deviceId"
      )
  `;

		const result = await this.influxDbService.query<{ sum: number }>(query);

		if (!result.length) {
			this.logger.debug('[DEVICE] No stored statuses found');

			return 0;
		}

		const row = result[0];

		const sum = row.sum ?? 0;

		return Number(sum) || 0;
	}

	async delete(device: DeviceEntity): Promise<void> {
		try {
			const query = `DELETE FROM device_status WHERE deviceId = '${device.id}'`;

			await this.influxDbService.query(query);

			this.statusMap.delete(device.id);
			this.statusPropertyMap.delete(device.id);

			this.logger.log(`[DEVICE] Deleted device status for id=${device.id}`);
		} catch (error) {
			const err = error as Error;

			this.logger.error(
				`[DEVICE] Failed to delete device status from InfluxDB id=${device.id} error=${err.message}`,
				err.stack,
			);
		}
	}

	async deleteByProperty(property: ChannelPropertyEntity): Promise<void> {
		try {
			const query = `DELETE FROM device_status WHERE propertyId = '${property.id}'`;

			await this.influxDbService.query(query);

			const deviceId = [...this.statusPropertyMap.entries()].find(([_, val]) => val === property.id)?.[0];

			if (typeof deviceId !== 'undefined') {
				this.statusMap.delete(deviceId);
				this.statusPropertyMap.delete(deviceId);
			}

			this.logger.log(`[DEVICE] Deleted device status for id=${deviceId}`);
		} catch (error) {
			const err = error as Error;

			this.logger.error(
				`[DEVICE] Failed to delete device status from InfluxDB propertyId=${property.id} error=${err.message}`,
				err.stack,
			);
		}
	}
}

import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { InfluxDbService } from '../../influxdb/services/influxdb.service';
import { ConnectionState, DEVICES_MODULE_NAME, OnlineDeviceState, PropertyCategory } from '../devices.constants';
import { ChannelPropertyEntity, DeviceEntity } from '../entities/devices.entity';

@Injectable()
export class DeviceConnectionStateService {
	private readonly logger = createExtensionLogger(DEVICES_MODULE_NAME, 'DeviceConnectionStateService');

	private statusMap: Map<DeviceEntity['id'], { online: boolean; status: ConnectionState }> = new Map();
	private statusPropertyMap: Map<DeviceEntity['id'], ChannelPropertyEntity['id']> = new Map();

	constructor(private readonly influxDbService: InfluxDbService) {}

	async write(device: DeviceEntity, property: ChannelPropertyEntity, status: ConnectionState): Promise<void> {
		if (property.category !== PropertyCategory.STATUS) {
			this.logger.error(`Failed to write device provided property if=${property.id} is not device status property`, {
				resource: device.id,
			});

			return;
		}

		if (this.statusMap.has(device.id) && this.statusMap.get(device.id).status === status) {
			// no change → skip Influx write
			return;
		}

		const isOnline = OnlineDeviceState.includes(status);

		// Update local cache regardless of InfluxDB availability
		this.statusMap.set(device.id, { online: isOnline, status });
		this.statusPropertyMap.set(device.id, property.id);

		if (!this.influxDbService.isConnected()) {
			return;
		}

		try {
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
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to write status to InfluxDB id=${device.id} error=${err.message}`, {
				resource: device.id,
				stack: err.stack,
			});
		}
	}

	async readLatest(device: DeviceEntity): Promise<{ online: boolean; status: ConnectionState }> {
		// Check local cache first
		if (this.statusMap.has(device.id)) {
			this.logger.debug(
				`Loaded cached status for device id=${device.id}, status=${this.statusMap.get(device.id)?.status}`,
				{ resource: device.id },
			);

			return this.statusMap.get(device.id);
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
        SELECT * FROM device_status
        WHERE deviceId = '${device.id}'
        ORDER BY time DESC
        LIMIT 1
      `;

			const result = await this.influxDbService.query<{
				online: boolean;
				onlineI: number;
				status: ConnectionState;
				deviceId: DeviceEntity['id'];
				propertyId: ChannelPropertyEntity['id'];
			}>(query);

			if (!result.length) {
				return {
					online: false,
					status: ConnectionState.UNKNOWN,
				};
			}

			const latest = result[0];

			this.statusMap.set(device.id, { online: latest.online, status: latest.status });
			this.statusPropertyMap.set(device.id, latest.propertyId);

			return latest;
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to read latest status from InfluxDB id=${device.id} error=${err.message}`, {
				resource: device.id,
				stack: err.stack,
			});

			return {
				online: false,
				status: ConnectionState.UNKNOWN,
			};
		}
	}

	async getOnlineCount(windowMinutes = 15): Promise<number> {
		if (!this.influxDbService.isConnected()) {
			return 0;
		}

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
			return 0;
		}

		const row = result[0];

		const sum = row.sum ?? 0;

		return Number(sum) || 0;
	}

	async delete(device: DeviceEntity): Promise<void> {
		// Always clear local cache
		this.statusMap.delete(device.id);
		this.statusPropertyMap.delete(device.id);

		if (!this.influxDbService.isConnected()) {
			return;
		}

		try {
			const query = `DELETE FROM device_status WHERE deviceId = '${device.id}'`;

			await this.influxDbService.query(query);

			this.logger.log(`Deleted device status for id=${device.id}`, { resource: device.id });
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to delete device status from InfluxDB id=${device.id} error=${err.message}`, {
				resource: device.id,
				stack: err.stack,
			});
		}
	}

	async deleteByProperty(property: ChannelPropertyEntity): Promise<void> {
		// Always clear local cache
		const deviceId = [...this.statusPropertyMap.entries()].find(([_, val]) => val === property.id)?.[0];

		if (typeof deviceId !== 'undefined') {
			this.statusMap.delete(deviceId);
			this.statusPropertyMap.delete(deviceId);
		}

		if (!this.influxDbService.isConnected()) {
			return;
		}

		try {
			const query = `DELETE FROM device_status WHERE propertyId = '${property.id}'`;

			await this.influxDbService.query(query);

			this.logger.log(
				`Deleted device status for propertyId=${property.id}${deviceId ? ` deviceId=${deviceId}` : ''}`,
				deviceId ? { resource: deviceId } : {},
			);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to delete device status from InfluxDB propertyId=${property.id} error=${err.message}`, {
				...(deviceId ? { resource: deviceId } : {}),
				stack: err.stack,
			});
		}
	}
}

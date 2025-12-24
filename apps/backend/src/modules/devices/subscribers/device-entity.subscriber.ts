import { DataSource, EntitySubscriberInterface, RemoveEvent, UpdateEvent } from 'typeorm';

import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { DEVICES_MODULE_NAME } from '../devices.constants';
import { DeviceEntity } from '../entities/devices.entity';
import { DeviceConnectionStateService } from '../services/device-connection-state.service';

@Injectable()
export class DeviceEntitySubscriber implements EntitySubscriberInterface<DeviceEntity> {
	private readonly logger = createExtensionLogger(DEVICES_MODULE_NAME, 'DeviceEntitySubscriber');

	constructor(
		private readonly deviceStatusService: DeviceConnectionStateService,
		private readonly dataSource: DataSource,
	) {
		this.dataSource.subscribers.push(this);
	}

	listenTo(): typeof DeviceEntity {
		return DeviceEntity;
	}

	async afterLoad(entity: DeviceEntity): Promise<void> {
		try {
			entity.status = await this.deviceStatusService.readLatest(entity);

			this.logger.debug(`Loaded device status from InfluxDB id=${entity.id}, value=${entity.status.status}`, {
				resource: entity.id,
			});
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to load device status from InfluxDB id=${entity.id}, error=${err.message}`, {
				resource: entity.id,
				stack: err.stack,
			});
		}
	}

	beforeUpdate(event: UpdateEvent<DeviceEntity>): void {
		if (event.entity) {
			event.entity.updatedAt = new Date();
		}
	}

	async afterRemove(event: RemoveEvent<DeviceEntity>): Promise<void> {
		if (!event.entity) {
			this.logger.warn(`No entity found in afterRemove event`);
			return;
		}

		const deviceId = event.entity.id;

		try {
			this.logger.debug(`Deleting stored statuses for id=${deviceId}`, { resource: deviceId });

			await this.deviceStatusService.delete(event.entity);

			this.logger.log(`Successfully removed all stored statuses for id=${deviceId}`, { resource: deviceId });
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to remove device statuses from InfluxDB id=${deviceId} error=${err.message}`, {
				resource: deviceId,
				stack: err.stack,
			});
		}
	}
}

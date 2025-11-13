import { DataSource, EntitySubscriberInterface, RemoveEvent, UpdateEvent } from 'typeorm';

import { Injectable, Logger } from '@nestjs/common';

import { DeviceEntity } from '../entities/devices.entity';
import { DeviceConnectionStateService } from '../services/device-connection-state.service';

@Injectable()
export class DeviceEntitySubscriber implements EntitySubscriberInterface<DeviceEntity> {
	private readonly logger = new Logger(DeviceEntitySubscriber.name);

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

			this.logger.debug(
				`[SUBSCRIBER] Loaded device status from InfluxDB id=${entity.id}, value=${entity.status.status}`,
			);
		} catch (error) {
			const err = error as Error;

			this.logger.error(
				`[SUBSCRIBER] Failed to load device status from InfluxDB id=${entity.id}, error=${err.message}`,
				err.stack,
			);
		}
	}

	beforeUpdate(event: UpdateEvent<DeviceEntity>): void {
		if (event.entity) {
			event.entity.updatedAt = new Date();
		}
	}

	async afterRemove(event: RemoveEvent<DeviceEntity>): Promise<void> {
		if (!event.entity) {
			this.logger.warn(`[SUBSCRIBER] No entity found in afterRemove event`);
			return;
		}

		const deviceId = event.entity.id;

		try {
			this.logger.debug(`[SUBSCRIBER] Deleting stored statuses for id=${deviceId}`);

			await this.deviceStatusService.delete(event.entity);

			this.logger.log(`[SUBSCRIBER] Successfully removed all stored statuses for id=${deviceId}`);
		} catch (error) {
			const err = error as Error;

			this.logger.error(
				`[SUBSCRIBER] Failed to remove device statuses from InfluxDB id=${deviceId} error=${err.message}`,
				err.stack,
			);
		}
	}
}

import { DataSource, EntitySubscriberInterface, UpdateEvent } from 'typeorm';
import { InsertEvent } from 'typeorm/subscriber/event/InsertEvent';

import { Injectable, Logger } from '@nestjs/common';

import { ShellyNgDeviceEntity } from '../entities/devices-shelly-ng.entity';
import { DeviceManagerService } from '../services/device-manager.service';
import { ShellyNgService } from '../services/shelly-ng.service';

@Injectable()
export class DeviceEntitySubscriber implements EntitySubscriberInterface<ShellyNgDeviceEntity> {
	private readonly logger = new Logger(DeviceEntitySubscriber.name);

	constructor(
		private readonly dataSource: DataSource,
		private readonly deviceManagerService: DeviceManagerService,
		private readonly shellyNgService: ShellyNgService,
	) {
		this.dataSource.subscribers.push(this);
	}

	listenTo(): typeof ShellyNgDeviceEntity {
		return ShellyNgDeviceEntity;
	}

	async afterInsert(event: InsertEvent<ShellyNgDeviceEntity>): Promise<void> {
		try {
			await this.deviceManagerService.createOrUpdate(event.entity.id);

			this.logger.debug(
				`[SHELLY NG][DEVICE ENTITY SUBSCRIBER] Shelly device=${event.entity.id} was successfully created`,
			);

			this.shellyNgService.restart().catch((error) => {
				const err = error as Error;

				this.logger.error('[SHELLY NG][DEVICE ENTITY SUBSCRIBER] Failed restart Shelly communication service', {
					message: err.message,
					stack: err.stack,
				});
			});
		} catch (error) {
			const err = error as Error;

			this.logger.error(
				`[SHELLY NG][DEVICE ENTITY SUBSCRIBER] Failed to finalize newly created device=${event.entity.id}`,
				{
					message: err.message,
					stack: err.stack,
				},
			);
		}
	}

	async afterUpdate(event: UpdateEvent<ShellyNgDeviceEntity>): Promise<void> {
		let credentialsUpdated = false;

		for (const updatedColumn of event.updatedColumns) {
			if (['password', 'hostname'].includes(updatedColumn.databaseName.toLowerCase())) {
				credentialsUpdated = true;
			}
		}

		if (!credentialsUpdated) {
			return;
		}

		try {
			await this.deviceManagerService.createOrUpdate(event.databaseEntity.id);

			this.logger.debug(
				`[SHELLY NG][DEVICE ENTITY SUBSCRIBER] Shelly device=${event.databaseEntity.id} was successfully updated`,
			);

			this.shellyNgService.restart().catch((error) => {
				const err = error as Error;

				this.logger.error('[SHELLY NG][DEVICE ENTITY SUBSCRIBER] Failed restart Shelly communication service', {
					message: err.message,
					stack: err.stack,
				});
			});
		} catch (error) {
			const err = error as Error;

			this.logger.error(
				`[SHELLY NG][DEVICE ENTITY SUBSCRIBER] Failed to finalize updated device=${event.databaseEntity.id}`,
				{
					message: err.message,
					stack: err.stack,
				},
			);
		}
	}

	afterRemove(): void {
		this.shellyNgService.restart().catch((error) => {
			const err = error as Error;

			this.logger.error('[SHELLY NG][DEVICE ENTITY SUBSCRIBER] Failed restart Shelly communication service', {
				message: err.message,
				stack: err.stack,
			});
		});
	}
}

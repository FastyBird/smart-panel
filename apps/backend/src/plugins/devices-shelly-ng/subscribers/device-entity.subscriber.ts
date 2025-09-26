import { DataSource, EntitySubscriberInterface, UpdateEvent } from 'typeorm';
import { InsertEvent } from 'typeorm/subscriber/event/InsertEvent';
import { RemoveEvent } from 'typeorm/subscriber/event/RemoveEvent';

import { Injectable, Logger } from '@nestjs/common';

import { ShellyNgDeviceEntity } from '../entities/devices-shelly-ng.entity';
import { DatabaseDiscovererService } from '../services/database-discoverer.service';
import { DeviceManagerService } from '../services/device-manager.service';

@Injectable()
export class DeviceEntitySubscriber implements EntitySubscriberInterface<ShellyNgDeviceEntity> {
	private readonly logger = new Logger(DeviceEntitySubscriber.name);

	constructor(
		private readonly dataSource: DataSource,
		private readonly deviceManagerService: DeviceManagerService,
		private readonly databaseDiscovererService: DatabaseDiscovererService,
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

			this.databaseDiscovererService.run().catch((error) => {
				const err = error as Error;

				this.logger.error('[SHELLY NG][DEVICE ENTITY SUBSCRIBER] Failed restart database discovered', {
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
		try {
			await this.deviceManagerService.createOrUpdate(event.databaseEntity.id);

			this.logger.debug(
				`[SHELLY NG][DEVICE ENTITY SUBSCRIBER] Shelly device=${event.databaseEntity.id} was successfully updated`,
			);

			this.databaseDiscovererService.run().catch((error) => {
				const err = error as Error;

				this.logger.error('[SHELLY NG][DEVICE ENTITY SUBSCRIBER] Failed restart database discovered', {
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
		this.databaseDiscovererService.run().catch((error) => {
			const err = error as Error;

			this.logger.error('[SHELLY NG][DEVICE ENTITY SUBSCRIBER] Failed restart database discovered', {
				message: err.message,
				stack: err.stack,
			});
		});
	}
}

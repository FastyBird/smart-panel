import { DataSource, EntitySubscriberInterface, UpdateEvent } from 'typeorm';
import { InsertEvent } from 'typeorm/subscriber/event/InsertEvent';

import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { DEVICES_SHELLY_NG_PLUGIN_NAME } from '../devices-shelly-ng.constants';
import { ShellyNgDeviceEntity } from '../entities/devices-shelly-ng.entity';
import { DeviceManagerService } from '../services/device-manager.service';
import { ShellyNgService } from '../services/shelly-ng.service';

@Injectable()
export class DeviceEntitySubscriber implements EntitySubscriberInterface<ShellyNgDeviceEntity> {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_SHELLY_NG_PLUGIN_NAME,
		'DeviceEntitySubscriber',
	);

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
		// Defer work to next tick to avoid transaction savepoint issues
		// Entity subscribers run within transactions, so heavy DB operations can cause savepoint conflicts
		setImmediate(async () => {
			try {
				await this.deviceManagerService.createOrUpdate(event.entity.id);

				this.shellyNgService.restart().catch((error) => {
					const err = error as Error;

					this.logger.error('Failed restart Shelly communication service', {
						message: err.message,
						stack: err.stack,
					});
				});
			} catch (error) {
				const err = error as Error;

				this.logger.error(`Failed to finalize newly created device=${event.entity.id}`, {
					message: err.message,
					stack: err.stack,
				});
			}
		});
	}

	async afterUpdate(event: UpdateEvent<ShellyNgDeviceEntity>): Promise<void> {
		let needsResync = false;

		for (const updatedColumn of event.updatedColumns) {
			// Resync when credentials, hostname, or category changes
			// Category change requires channel re-creation with new categories
			if (['password', 'hostname', 'category'].includes(updatedColumn.databaseName.toLowerCase())) {
				needsResync = true;
			}
		}

		if (!needsResync) {
			return;
		}

		// Defer work to next tick to avoid transaction savepoint issues
		// Entity subscribers run within transactions, so heavy DB operations can cause savepoint conflicts
		setImmediate(async () => {
			try {
				await this.deviceManagerService.createOrUpdate(event.databaseEntity.id);

				this.shellyNgService.restart().catch((error) => {
					const err = error as Error;

					this.logger.error('Failed restart Shelly communication service', {
						message: err.message,
						stack: err.stack,
					});
				});
			} catch (error) {
				const err = error as Error;

				this.logger.error(`Failed to finalize updated device=${event.databaseEntity.id}`, {
					message: err.message,
					stack: err.stack,
				});
			}
		});
	}

	afterRemove(): void {
		this.shellyNgService.restart().catch((error) => {
			const err = error as Error;

			this.logger.error('Failed restart Shelly communication service', {
				message: err.message,
				stack: err.stack,
			});
		});
	}
}

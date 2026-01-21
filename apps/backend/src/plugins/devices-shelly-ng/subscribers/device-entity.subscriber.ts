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

	afterInsert(event: InsertEvent<ShellyNgDeviceEntity>): void {
		this.scheduleProvision(event.entity.id, event.queryRunner?.isTransactionActive ?? false);
	}

	afterUpdate(event: UpdateEvent<ShellyNgDeviceEntity>): void {
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

		this.scheduleProvision(event.databaseEntity.id, event.queryRunner?.isTransactionActive ?? false);
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

	private scheduleProvision(deviceId: string, inTransaction: boolean): void {
		const run = async (): Promise<void> => {
			try {
				await this.deviceManagerService.createOrUpdate(deviceId);
			} catch (error) {
				const err = error as Error;

				// If the device was deleted between insert/update and finalize, skip retrying.
				if (err.message === 'Device not found.') {
					this.logger.warn(`Skip finalize for missing device=${deviceId}`);
					return;
				}

				this.logger.error(`Failed to finalize device=${deviceId}`, {
					message: err.message,
					stack: err.stack,
				});
			}
		};

		// If still inside a transaction, defer to the macrotask queue so the outer
		// transaction can commit before we start new DB work (avoids SQLite savepoint issues).
		if (inTransaction) {
			setTimeout(() => {
				void run();
			}, 0);
			return;
		}

		void run();
	}
}

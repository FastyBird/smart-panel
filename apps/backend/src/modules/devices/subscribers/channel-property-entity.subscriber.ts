import { DataSource, EntitySubscriberInterface, RemoveEvent, UpdateEvent } from 'typeorm';

import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { DEVICES_MODULE_NAME } from '../devices.constants';
import { ChannelPropertyEntity } from '../entities/devices.entity';
import { DeviceConnectionStateService } from '../services/device-connection-state.service';
import { PropertyValueService } from '../services/property-value.service';

@Injectable()
export class ChannelPropertyEntitySubscriber implements EntitySubscriberInterface<ChannelPropertyEntity> {
	private readonly logger = createExtensionLogger(DEVICES_MODULE_NAME, 'ChannelPropertyEntitySubscriber');

	constructor(
		private readonly propertyValueService: PropertyValueService,
		private readonly deviceStatusService: DeviceConnectionStateService,
		private readonly dataSource: DataSource,
	) {
		this.dataSource.subscribers.push(this);
	}

	listenTo(): typeof ChannelPropertyEntity {
		return ChannelPropertyEntity;
	}

	async afterLoad(entity: ChannelPropertyEntity): Promise<void> {
		try {
			entity.value = await this.propertyValueService.readLatest(entity);

			this.logger.debug(`Loaded property value from InfluxDB id=${entity.id}, value=${entity.value}`);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to load property value from InfluxDB id=${entity.id}, error=${err.message}`, {
				stack: err.stack,
			});
		}
	}

	beforeUpdate(event: UpdateEvent<ChannelPropertyEntity>): void {
		if (event.entity) {
			this.logger.debug(`Updating property id=${event.entity.id}`);

			event.entity.updatedAt = new Date();
		}
	}

	async afterRemove(event: RemoveEvent<ChannelPropertyEntity>): Promise<void> {
		if (!event.entity) {
			this.logger.warn(`No entity found in afterRemove event`);
			return;
		}

		const propertyId = event.entity.id;

		try {
			this.logger.debug(`Deleting stored values for id=${propertyId}`);

			await this.propertyValueService.delete(event.entity);
			await this.deviceStatusService.deleteByProperty(event.entity);

			this.logger.log(`Successfully removed all stored values for id=${propertyId}`);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to remove property value from InfluxDB id=${propertyId} error=${err.message}`, {
				stack: err.stack,
			});
		}
	}
}

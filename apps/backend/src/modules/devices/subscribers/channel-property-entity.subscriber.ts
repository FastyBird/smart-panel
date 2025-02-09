import { DataSource, EntitySubscriberInterface, RemoveEvent, UpdateEvent } from 'typeorm';

import { Injectable, Logger } from '@nestjs/common';

import { ChannelPropertyEntity } from '../entities/devices.entity';
import { PropertyValueService } from '../services/property-value.service';

@Injectable()
export class ChannelPropertyEntitySubscriber implements EntitySubscriberInterface<ChannelPropertyEntity> {
	private readonly logger = new Logger(ChannelPropertyEntitySubscriber.name);

	constructor(
		private readonly propertyValueService: PropertyValueService,
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

			this.logger.debug(`[SUBSCRIBER] Loaded property value from InfluxDB id=${entity.id}, value=${entity.value}`);
		} catch (error) {
			const err = error as Error;

			this.logger.error(
				`[SUBSCRIBER] Failed to load property value from InfluxDB id=${entity.id}, error=${err.message}`,
				err.stack,
			);
		}
	}

	beforeUpdate(event: UpdateEvent<ChannelPropertyEntity>): void {
		if (event.entity) {
			this.logger.debug(`[SUBSCRIBER] Updating property id=${event.entity.id}`);

			event.entity.updatedAt = new Date();
		}
	}

	async afterRemove(event: RemoveEvent<ChannelPropertyEntity>): Promise<void> {
		if (!event.entity) {
			this.logger.warn(`[SUBSCRIBER] No entity found in afterRemove event`);
			return;
		}

		const propertyId = event.entity.id;

		try {
			this.logger.debug(`[SUBSCRIBER] Deleting stored values for id=${propertyId}`);

			await this.propertyValueService.delete(event.entity);

			this.logger.log(`[SUBSCRIBER] Successfully removed all stored values for id=${propertyId}`);
		} catch (error) {
			const err = error as Error;

			this.logger.error(
				`[SUBSCRIBER] Failed to remove property value from InfluxDB id=${propertyId} error=${err.message}`,
				err.stack,
			);
		}
	}
}

import { DataSource, EntitySubscriberInterface, RemoveEvent } from 'typeorm';

import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { DISPLAYS_MODULE_NAME } from '../displays.constants';
import { DisplayEntity } from '../entities/displays.entity';
import { DisplayConnectionStateService } from '../services/display-connection-state.service';

@Injectable()
export class DisplayEntitySubscriber implements EntitySubscriberInterface<DisplayEntity> {
	private readonly logger = createExtensionLogger(DISPLAYS_MODULE_NAME, 'DisplayEntitySubscriber');

	constructor(
		private readonly displayStatusService: DisplayConnectionStateService,
		private readonly dataSource: DataSource,
	) {
		this.dataSource.subscribers.push(this);
	}

	listenTo(): typeof DisplayEntity {
		return DisplayEntity;
	}

	async afterLoad(entity: DisplayEntity): Promise<void> {
		try {
			const status = await this.displayStatusService.readLatest(entity);
			entity.online = status.online;
			entity.status = status.status;

			this.logger.debug(`Loaded display status from InfluxDB id=${entity.id}, value=${entity.status}`);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to load display status from InfluxDB id=${entity.id}, error=${err.message}`, err.stack);
		}
	}

	async afterRemove(event: RemoveEvent<DisplayEntity>): Promise<void> {
		if (!event.entity) {
			this.logger.warn(`No entity found in afterRemove event`);
			return;
		}

		const displayId = event.entity.id;

		try {
			this.logger.debug(`Deleting stored statuses for id=${displayId}`);

			await this.displayStatusService.delete(event.entity);

			this.logger.log(`Successfully removed all stored statuses for id=${displayId}`);
		} catch (error) {
			const err = error as Error;

			this.logger.error(
				`Failed to remove display statuses from InfluxDB id=${displayId} error=${err.message}`,
				err.stack,
			);
		}
	}
}

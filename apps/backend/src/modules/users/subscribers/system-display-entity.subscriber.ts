import { DataSource, EntitySubscriberInterface, UpdateEvent } from 'typeorm';
import { InsertEvent } from 'typeorm/subscriber/event/InsertEvent';

import { Injectable, Logger } from '@nestjs/common';

import { DisplayProfileEntity } from '../../system/entities/system.entity';
import { DisplaysInstancesService } from '../services/displays-instances.service';

@Injectable()
export class SystemDisplayEntitySubscriber implements EntitySubscriberInterface<DisplayProfileEntity> {
	private readonly logger = new Logger(SystemDisplayEntitySubscriber.name);

	constructor(
		private readonly displaysService: DisplaysInstancesService,
		private readonly dataSource: DataSource,
	) {
		this.dataSource.subscribers.push(this);
	}

	listenTo(): typeof DisplayProfileEntity {
		return DisplayProfileEntity;
	}

	afterInsert(event: InsertEvent<DisplayProfileEntity>): void {
		this.connectDisplays(event.entity.id, event.entity.uid).catch((error) => {
			const err = error as Error;

			this.logger.error('[DISPLAYS SUBSCRIBER] Failed to connect system display profile with display instance', {
				message: err.message,
				stack: err.stack,
			});
		});
	}

	afterUpdate(event: UpdateEvent<DisplayProfileEntity>): void {
		if (!event.databaseEntity?.id || !event.databaseEntity?.uid) {
			this.logger.warn('[DISPLAYS SUBSCRIBER] Missing data for update hook');

			return;
		}

		this.connectDisplays(event.databaseEntity.id, event.databaseEntity.uid).catch((error) => {
			const err = error as Error;

			this.logger.error('[DISPLAYS SUBSCRIBER] Failed to connect system display profile with display instance', {
				message: err.message,
				stack: err.stack,
			});
		});
	}

	private async connectDisplays(systemDisplayId: string, systemDisplayUid: string): Promise<void> {
		const display = await this.displaysService.findByUid(systemDisplayUid);

		if (!display) {
			return;
		}

		await this.displaysService.update(display.id, {
			display_profile: systemDisplayId,
		});
	}
}

import { EntitySubscriberInterface, EventSubscriber, UpdateEvent } from 'typeorm';

import { Injectable } from '@nestjs/common';

import { DataSourceEntity } from '../entities/dashboard.entity';

@Injectable()
@EventSubscriber()
export class DataSourceEntitySubscriber implements EntitySubscriberInterface<DataSourceEntity> {
	listenTo(): typeof DataSourceEntity {
		return DataSourceEntity;
	}

	beforeUpdate(event: UpdateEvent<DataSourceEntity>): void {
		if (event.entity) {
			event.entity.updatedAt = new Date();
		}
	}
}

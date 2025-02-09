import { EntitySubscriberInterface, EventSubscriber, UpdateEvent } from 'typeorm';

import { Injectable } from '@nestjs/common';

import { PageEntity } from '../entities/dashboard.entity';

@Injectable()
@EventSubscriber()
export class PageEntitySubscriber implements EntitySubscriberInterface<PageEntity> {
	listenTo(): typeof PageEntity {
		return PageEntity;
	}

	beforeUpdate(event: UpdateEvent<PageEntity>): void {
		if (event.entity) {
			event.entity.updatedAt = new Date();
		}
	}
}

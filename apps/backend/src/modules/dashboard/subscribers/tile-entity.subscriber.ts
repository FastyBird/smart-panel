import { EntitySubscriberInterface, EventSubscriber, UpdateEvent } from 'typeorm';

import { Injectable } from '@nestjs/common';

import { TileEntity } from '../entities/dashboard.entity';

@Injectable()
@EventSubscriber()
export class TileEntitySubscriber implements EntitySubscriberInterface<TileEntity> {
	listenTo(): typeof TileEntity {
		return TileEntity;
	}

	beforeUpdate(event: UpdateEvent<TileEntity>): void {
		if (event.entity) {
			event.entity.updatedAt = new Date();
		}
	}
}

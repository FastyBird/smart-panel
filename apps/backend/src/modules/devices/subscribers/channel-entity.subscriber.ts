import { DataSource, EntitySubscriberInterface, UpdateEvent } from 'typeorm';

import { Injectable } from '@nestjs/common';

import { ChannelEntity } from '../entities/devices.entity';

@Injectable()
export class ChannelEntitySubscriber implements EntitySubscriberInterface<ChannelEntity> {
	constructor(private readonly dataSource: DataSource) {
		this.dataSource.subscribers.push(this);
	}

	listenTo(): typeof ChannelEntity {
		return ChannelEntity;
	}

	beforeUpdate(event: UpdateEvent<ChannelEntity>): void {
		if (event.entity) {
			event.entity.updatedAt = new Date();
		}
	}
}

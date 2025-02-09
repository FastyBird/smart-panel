import { DataSource, EntitySubscriberInterface, UpdateEvent } from 'typeorm';

import { Injectable } from '@nestjs/common';

import { ChannelControlEntity } from '../entities/devices.entity';

@Injectable()
export class ChannelControlEntitySubscriber implements EntitySubscriberInterface<ChannelControlEntity> {
	constructor(private readonly dataSource: DataSource) {
		this.dataSource.subscribers.push(this);
	}

	listenTo(): typeof ChannelControlEntity {
		return ChannelControlEntity;
	}

	beforeUpdate(event: UpdateEvent<ChannelControlEntity>): void {
		if (event.entity) {
			event.entity.updatedAt = new Date();
		}
	}
}

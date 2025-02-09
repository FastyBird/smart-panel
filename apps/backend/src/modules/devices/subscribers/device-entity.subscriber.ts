import { DataSource, EntitySubscriberInterface, UpdateEvent } from 'typeorm';

import { Injectable } from '@nestjs/common';

import { DeviceEntity } from '../entities/devices.entity';

@Injectable()
export class DeviceEntitySubscriber implements EntitySubscriberInterface<DeviceEntity> {
	constructor(private readonly dataSource: DataSource) {
		this.dataSource.subscribers.push(this);
	}

	listenTo(): typeof DeviceEntity {
		return DeviceEntity;
	}

	beforeUpdate(event: UpdateEvent<DeviceEntity>): void {
		if (event.entity) {
			event.entity.updatedAt = new Date();
		}
	}
}

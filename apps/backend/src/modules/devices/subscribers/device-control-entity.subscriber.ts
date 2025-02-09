import { DataSource, EntitySubscriberInterface, UpdateEvent } from 'typeorm';

import { Injectable } from '@nestjs/common';

import { DeviceControlEntity } from '../entities/devices.entity';

@Injectable()
export class DeviceControlEntitySubscriber implements EntitySubscriberInterface<DeviceControlEntity> {
	constructor(private readonly dataSource: DataSource) {
		this.dataSource.subscribers.push(this);
	}

	listenTo(): typeof DeviceControlEntity {
		return DeviceControlEntity;
	}

	beforeUpdate(event: UpdateEvent<DeviceControlEntity>): void {
		if (event.entity) {
			event.entity.updatedAt = new Date();
		}
	}
}

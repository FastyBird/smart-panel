import { Repository } from 'typeorm';

import { DeviceEntity } from '../entities/devices.entity';

/** Shared relation shape for fresh CRUD reads and the structural command graph. */
export function buildDeviceGraphQuery<T extends DeviceEntity>(repository: Repository<T>) {
	const qb = repository
		.createQueryBuilder('device')
		.leftJoinAndSelect('device.controls', 'controls')
		.leftJoinAndSelect('controls.device', 'controlDevice')
		.leftJoinAndSelect('device.channels', 'channels')
		.leftJoinAndSelect('channels.device', 'channelDevice')
		.leftJoinAndSelect('channels.controls', 'channelControls')
		.leftJoinAndSelect('channelControls.channel', 'channelControlChannel')
		.leftJoinAndSelect('channels.properties', 'channelProperties')
		.leftJoinAndSelect('channelProperties.channel', 'channelPropertyChannel')
		.leftJoinAndSelect('device.deviceZones', 'deviceZones');

	// QueryBuilder ignores eager:true — auto-join any eager relations from plugin entities
	for (const relation of repository.metadata?.relations ?? []) {
		if (relation.isEager && !['controls', 'channels', 'deviceZones'].includes(relation.propertyName)) {
			qb.leftJoinAndSelect(`device.${relation.propertyName}`, relation.propertyName);
		}
	}

	return qb;
}

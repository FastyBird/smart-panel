import { DataSource, EntitySubscriberInterface, LoadEvent } from 'typeorm';

import { Injectable, Optional } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

import { getEnvValue } from '../../../common/utils/config.utils';
import { ChannelEntity, ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { VirtualChannelPropertyEntity } from '../entities/devices-virtual.entity';
import { VirtualTransformConfigEntity } from '../entities/virtual-transform.entity';
import { transformContractErrors } from '../services/virtual-transform-contract.utils';

/** Config-owned metadata overlays only transform properties; physical specification units remain untouched. */
@Injectable()
export class VirtualTransformMetadataSubscriber implements EntitySubscriberInterface<ChannelPropertyEntity> {
	constructor(
		private readonly dataSource: DataSource,
		@Optional() configService: NestConfigService = new NestConfigService(),
	) {
		if (getEnvValue<string>(configService, 'FB_CLI', null) !== 'on') this.dataSource.subscribers.push(this);
	}

	listenTo(): typeof ChannelPropertyEntity {
		return ChannelPropertyEntity;
	}

	async afterLoad(entity: ChannelPropertyEntity, event: LoadEvent<ChannelPropertyEntity>): Promise<void> {
		if (!(entity instanceof VirtualChannelPropertyEntity) || !entity.isDerived) return;
		const config = await event.manager.findOneBy(VirtualTransformConfigEntity, { outputPropertyId: entity.id });
		if (!config) return;
		const existingChannel = typeof entity.channel === 'string' ? null : entity.channel;
		const channel =
			existingChannel && typeof existingChannel.device !== 'string' && existingChannel.device
				? existingChannel
				: await event.manager
						.createQueryBuilder(ChannelEntity, 'channel')
						.innerJoin('channel.properties', 'property', 'property.id = :id', { id: entity.id })
						.leftJoinAndSelect('channel.device', 'device')
						.getOne();
		if (!channel) return;
		const hydrated = Object.assign(new VirtualChannelPropertyEntity(), entity, { channel });
		// Generic units are durable config metadata; the base subscriber has supplied the spec's null unit.
		hydrated.unit = null;
		if (transformContractErrors(config, hydrated, null).length) return;
		entity.unit = config.unit;
		entity.measurementQuantity = config.quantity;
	}
}

import { Repository } from 'typeorm';

import { Injectable, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger';
import { EventType as DevicesEventType } from '../../devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { SpaceEntity } from '../entities/space.entity';
import { SPACES_MODULE_NAME } from '../spaces.constants';

@Injectable()
export class SpaceActivityListener implements OnModuleInit {
	private readonly logger = createExtensionLogger(SPACES_MODULE_NAME, 'SpaceActivityListener');

	constructor(
		@InjectRepository(SpaceEntity)
		private readonly spaceRepository: Repository<SpaceEntity>,
		@InjectRepository(DeviceEntity)
		private readonly deviceRepository: Repository<DeviceEntity>,
	) {}

	onModuleInit() {
		this.logger.debug('Space activity listener initialized');
	}

	@OnEvent(DevicesEventType.CHANNEL_PROPERTY_UPDATED)
	async handlePropertyUpdated(property: ChannelPropertyEntity): Promise<void> {
		try {
			await this.updateSpaceActivity(property);
		} catch (error) {
			const err = error as Error;
			this.logger.warn(`Failed to update space activity on property update: ${err.message}`, err.stack);
		}
	}

	private async updateSpaceActivity(property: ChannelPropertyEntity): Promise<void> {
		// Get the channel from the property
		const channelId = typeof property.channel === 'string' ? property.channel : property.channel?.id;

		if (!channelId) {
			this.logger.debug('Property has no channel, skipping activity update');
			return;
		}

		// Find the device for this channel
		const device = await this.deviceRepository
			.createQueryBuilder('device')
			.innerJoin(ChannelEntity, 'channel', 'channel.device = device.id')
			.where('channel.id = :channelId', { channelId })
			.andWhere('device.spaceId IS NOT NULL')
			.getOne();

		if (!device || !device.spaceId) {
			this.logger.debug('Device not found or has no space, skipping activity update');
			return;
		}

		// Update the space's lastActivityAt timestamp
		const now = new Date();

		await this.spaceRepository
			.createQueryBuilder()
			.update()
			.set({ lastActivityAt: now })
			.where('id = :spaceId', { spaceId: device.spaceId })
			.execute();

		this.logger.debug(`Updated lastActivityAt for space=${device.spaceId} to ${now.toISOString()}`);
	}
}

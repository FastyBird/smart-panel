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
		@InjectRepository(ChannelEntity)
		private readonly channelRepository: Repository<ChannelEntity>,
	) {}

	onModuleInit() {
		// Listener initialized
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
			return;
		}

		// Find the channel with its device using relation-based join
		const channel = await this.channelRepository
			.createQueryBuilder('channel')
			.innerJoinAndSelect('channel.device', 'device')
			.where('channel.id = :channelId', { channelId })
			.andWhere('device.roomId IS NOT NULL')
			.getOne();

		if (!channel) {
			return;
		}

		const device = channel.device as DeviceEntity;

		if (!device.roomId) {
			return;
		}

		// Update the space's lastActivityAt timestamp
		const now = new Date();

		await this.spaceRepository
			.createQueryBuilder()
			.update()
			.set({ lastActivityAt: now })
			.where('id = :roomId', { roomId: device.roomId })
			.execute();
	}
}

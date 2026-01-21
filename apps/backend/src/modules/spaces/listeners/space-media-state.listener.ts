import { Repository } from 'typeorm';

import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger';
import { EventType as DevicesEventType, PropertyCategory } from '../../devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { SpaceMediaStateService } from '../services/space-media-state.service';
import { EventType, MEDIA_CHANNEL_CATEGORIES, SPACES_MODULE_NAME } from '../spaces.constants';

const MEDIA_STATE_DEBOUNCE_MS = 100;

const MEDIA_PROPERTY_CATEGORIES: PropertyCategory[] = [
	PropertyCategory.ON,
	PropertyCategory.VOLUME,
	PropertyCategory.MUTE,
];

@Injectable()
export class SpaceMediaStateListener implements OnModuleInit, OnModuleDestroy {
	private readonly logger = createExtensionLogger(SPACES_MODULE_NAME, 'SpaceMediaStateListener');

	private readonly debounceTimers = new Map<string, NodeJS.Timeout>();

	constructor(
		@InjectRepository(ChannelEntity)
		private readonly channelRepository: Repository<ChannelEntity>,
		private readonly mediaStateService: SpaceMediaStateService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	onModuleInit(): void {
		this.logger.debug('Space media state listener initialized');
	}

	onModuleDestroy(): void {
		for (const timer of this.debounceTimers.values()) {
			clearTimeout(timer);
		}
		this.debounceTimers.clear();
	}

	@OnEvent(DevicesEventType.CHANNEL_PROPERTY_VALUE_SET)
	@OnEvent(DevicesEventType.CHANNEL_PROPERTY_UPDATED)
	async handlePropertyChanged(property: ChannelPropertyEntity): Promise<void> {
		try {
			await this.processMediaPropertyChange(property);
		} catch (error) {
			const err = error as Error;
			this.logger.warn(`Failed to process media property change: ${err.message}`, err.stack);
		}
	}

	private async processMediaPropertyChange(property: ChannelPropertyEntity): Promise<void> {
		if (!MEDIA_PROPERTY_CATEGORIES.includes(property.category)) {
			return;
		}

		const channelId = typeof property.channel === 'string' ? property.channel : property.channel?.id;

		if (!channelId) {
			return;
		}

		const channel = await this.channelRepository
			.createQueryBuilder('channel')
			.innerJoinAndSelect('channel.device', 'device')
			.where('channel.id = :channelId', { channelId })
			.andWhere('device.roomId IS NOT NULL')
			.getOne();

		if (!channel) {
			return;
		}

		if (
			!MEDIA_CHANNEL_CATEGORIES.includes(
				channel.category as (typeof MEDIA_CHANNEL_CATEGORIES)[number],
			)
		) {
			return;
		}

		const device = channel.device as DeviceEntity;
		const roomId = device.roomId;

		if (!roomId) {
			return;
		}

		this.scheduleMediaStateEmit(roomId);
	}

	private scheduleMediaStateEmit(roomId: string): void {
		const existing = this.debounceTimers.get(roomId);
		if (existing) {
			clearTimeout(existing);
		}

		const timer = setTimeout(() => {
			this.debounceTimers.delete(roomId);
			void this.emitMediaStateChange(roomId);
		}, MEDIA_STATE_DEBOUNCE_MS);

		this.debounceTimers.set(roomId, timer);
	}

	private async emitMediaStateChange(roomId: string): Promise<void> {
		try {
			const state = await this.mediaStateService.getMediaState(roomId);

			if (!state || state.totalDevices === 0) {
				this.logger.debug(`No media devices in room=${roomId}, skipping media state event`);
				return;
			}

			this.eventEmitter.emit(EventType.MEDIA_STATE_CHANGED, {
				space_id: roomId,
				state,
			});

			this.logger.debug(`Emitted MEDIA_STATE_CHANGED for room=${roomId}`);
		} catch (error) {
			const err = error as Error;
			this.logger.warn(`Failed to emit media state change for room=${roomId}: ${err.message}`);
		}
	}
}

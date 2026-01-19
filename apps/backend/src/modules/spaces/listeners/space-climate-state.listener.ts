import { Repository } from 'typeorm';

import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import { ChannelCategory, PropertyCategory } from '../../devices/devices.constants';
import { EventType as DevicesEventType } from '../../devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { ClimateStateDataModel } from '../models/spaces-response.model';
import { SpaceClimateStateService } from '../services/space-climate-state.service';
import { EventType, SPACES_MODULE_NAME } from '../spaces.constants';

// Climate-relevant channel categories
const CLIMATE_CHANNEL_CATEGORIES: ChannelCategory[] = [
	ChannelCategory.TEMPERATURE,
	ChannelCategory.HUMIDITY,
	ChannelCategory.HEATER,
	ChannelCategory.COOLER,
	ChannelCategory.THERMOSTAT,
];

// Climate-relevant property categories
const CLIMATE_PROPERTY_CATEGORIES: PropertyCategory[] = [
	PropertyCategory.TEMPERATURE,
	PropertyCategory.ON,
	PropertyCategory.STATUS,
	PropertyCategory.HUMIDITY,
	PropertyCategory.LOCKED,
];

@Injectable()
export class SpaceClimateStateListener implements OnModuleInit {
	private readonly logger = createExtensionLogger(SPACES_MODULE_NAME, 'SpaceClimateStateListener');

	constructor(
		@InjectRepository(ChannelEntity)
		private readonly channelRepository: Repository<ChannelEntity>,
		private readonly climateStateService: SpaceClimateStateService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	onModuleInit() {
		this.logger.debug('Space climate state listener initialized');
	}

	@OnEvent(DevicesEventType.CHANNEL_PROPERTY_VALUE_SET)
	@OnEvent(DevicesEventType.CHANNEL_PROPERTY_UPDATED)
	async handlePropertyChanged(property: ChannelPropertyEntity): Promise<void> {
		try {
			await this.processClimatePropertyChange(property);
		} catch (error) {
			const err = error as Error;
			this.logger.warn(`Failed to process climate property change: ${err.message}`, err.stack);
		}
	}

	private async processClimatePropertyChange(property: ChannelPropertyEntity): Promise<void> {
		// 1. Check if property category is climate-relevant
		if (!CLIMATE_PROPERTY_CATEGORIES.includes(property.category)) {
			return;
		}

		// 2. Get the channel ID
		const channelId = typeof property.channel === 'string' ? property.channel : property.channel?.id;

		if (!channelId) {
			return;
		}

		// 3. Find the channel with its device
		const channel = await this.channelRepository
			.createQueryBuilder('channel')
			.innerJoinAndSelect('channel.device', 'device')
			.where('channel.id = :channelId', { channelId })
			.andWhere('device.roomId IS NOT NULL')
			.getOne();

		if (!channel) {
			return;
		}

		// 4. Check if channel category is climate-relevant
		if (!CLIMATE_CHANNEL_CATEGORIES.includes(channel.category)) {
			return;
		}

		const device = channel.device as DeviceEntity;
		const roomId = device.roomId;

		if (!roomId) {
			return;
		}

		// 5. Recalculate climate state for the room
		const state = await this.climateStateService.getClimateState(roomId);

		// 6. Convert to data model and emit event
		const stateModel = toInstance(ClimateStateDataModel, state);

		this.eventEmitter.emit(EventType.CLIMATE_STATE_CHANGED, {
			space_id: roomId,
			state: stateModel,
		});

		this.logger.debug(`Emitted CLIMATE_STATE_CHANGED for room=${roomId} due to property change`);
	}
}

import { Repository } from 'typeorm';

import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
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

/**
 * Debounce delay in milliseconds for climate state change events.
 * This prevents flooding WebSocket with events when multiple property changes happen quickly.
 */
const CLIMATE_STATE_DEBOUNCE_MS = 100;

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
export class SpaceClimateStateListener implements OnModuleInit, OnModuleDestroy {
	private readonly logger = createExtensionLogger(SPACES_MODULE_NAME, 'SpaceClimateStateListener');

	/**
	 * Debounce timers per room to prevent flooding WebSocket with events.
	 * Key: roomId, Value: NodeJS.Timeout
	 */
	private readonly debounceTimers = new Map<string, NodeJS.Timeout>();

	constructor(
		@InjectRepository(ChannelEntity)
		private readonly channelRepository: Repository<ChannelEntity>,
		private readonly climateStateService: SpaceClimateStateService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	onModuleInit() {
		this.logger.debug('Space climate state listener initialized');
	}

	onModuleDestroy() {
		// Clean up all pending debounce timers
		for (const timer of this.debounceTimers.values()) {
			clearTimeout(timer);
		}
		this.debounceTimers.clear();
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

		// 5. Schedule debounced state recalculation and event emission
		this.scheduleClimateStateEmit(roomId);
	}

	/**
	 * Schedule a debounced climate state recalculation and event emission for a room.
	 * If multiple property changes happen within the debounce window, only one
	 * state recalculation and event emission will occur.
	 *
	 * Performance optimization: Prevents flooding WebSocket with events when
	 * devices update multiple properties at once (e.g., temperature + humidity).
	 */
	private scheduleClimateStateEmit(roomId: string): void {
		// Cancel any existing timer for this room
		const existingTimer = this.debounceTimers.get(roomId);
		if (existingTimer) {
			clearTimeout(existingTimer);
		}

		// Schedule new emission after debounce delay
		const timer = setTimeout(() => {
			this.debounceTimers.delete(roomId);
			void this.emitClimateStateChange(roomId);
		}, CLIMATE_STATE_DEBOUNCE_MS);

		this.debounceTimers.set(roomId, timer);
	}

	/**
	 * Recalculate climate state and emit event for a room.
	 */
	private async emitClimateStateChange(roomId: string): Promise<void> {
		try {
			const state = await this.climateStateService.getClimateState(roomId);

			// Only emit event if state is valid (space exists and has climate devices)
			if (!state || !state.hasClimate) {
				this.logger.debug(`No valid climate state for room=${roomId}, skipping event emission`);
				return;
			}

			// Convert to data model and emit event
			const stateModel = toInstance(ClimateStateDataModel, state);

			this.eventEmitter.emit(EventType.CLIMATE_STATE_CHANGED, {
				space_id: roomId,
				state: stateModel,
			});

			this.logger.debug(`Emitted CLIMATE_STATE_CHANGED for room=${roomId} due to property change`);
		} catch (error) {
			const err = error as Error;
			this.logger.warn(`Failed to emit climate state change for room=${roomId}: ${err.message}`);
		}
	}
}

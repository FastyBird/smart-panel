import { Repository } from 'typeorm';

import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger';
import { ChannelCategory, PropertyCategory } from '../../devices/devices.constants';
import { EventType as DevicesEventType } from '../../devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { LightingStateDataModel } from '../models/spaces-response.model';
import { SpaceLightingStateService } from '../services/space-lighting-state.service';
import { EventType, SPACES_MODULE_NAME } from '../spaces.constants';

/**
 * Debounce delay in milliseconds for lighting state change events.
 * This prevents flooding WebSocket with events when multiple property changes happen quickly.
 */
const LIGHTING_STATE_DEBOUNCE_MS = 100;

// Lighting-relevant channel categories
const LIGHTING_CHANNEL_CATEGORIES: ChannelCategory[] = [ChannelCategory.LIGHT];

// Lighting-relevant property categories
const LIGHTING_PROPERTY_CATEGORIES: PropertyCategory[] = [
	PropertyCategory.ON,
	PropertyCategory.BRIGHTNESS,
	PropertyCategory.COLOR_RED,
	PropertyCategory.COLOR_GREEN,
	PropertyCategory.COLOR_BLUE,
	PropertyCategory.COLOR_WHITE,
	PropertyCategory.COLOR_TEMPERATURE,
	PropertyCategory.HUE,
	PropertyCategory.SATURATION,
];

@Injectable()
export class SpaceLightingStateListener implements OnModuleInit, OnModuleDestroy {
	private readonly logger = createExtensionLogger(SPACES_MODULE_NAME, 'SpaceLightingStateListener');

	/**
	 * Debounce timers per room to prevent flooding WebSocket with events.
	 * Key: roomId, Value: NodeJS.Timeout
	 */
	private readonly debounceTimers = new Map<string, NodeJS.Timeout>();

	constructor(
		@InjectRepository(ChannelEntity)
		private readonly channelRepository: Repository<ChannelEntity>,
		private readonly lightingStateService: SpaceLightingStateService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	onModuleInit() {
		this.logger.debug('Space lighting state listener initialized');
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
			await this.processLightingPropertyChange(property);
		} catch (error) {
			const err = error as Error;
			this.logger.warn(`Failed to process lighting property change: ${err.message}`, err.stack);
		}
	}

	private async processLightingPropertyChange(property: ChannelPropertyEntity): Promise<void> {
		// 1. Check if property category is lighting-relevant
		if (!LIGHTING_PROPERTY_CATEGORIES.includes(property.category)) {
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

		// 4. Check if channel category is lighting-relevant
		if (!LIGHTING_CHANNEL_CATEGORIES.includes(channel.category)) {
			return;
		}

		const device = channel.device as DeviceEntity;
		const roomId = device.roomId;

		if (!roomId) {
			return;
		}

		// 5. Schedule debounced state recalculation and event emission
		this.scheduleLightingStateEmit(roomId);
	}

	/**
	 * Schedule a debounced lighting state recalculation and event emission for a room.
	 * If multiple property changes happen within the debounce window, only one
	 * state recalculation and event emission will occur.
	 */
	private scheduleLightingStateEmit(roomId: string): void {
		// Cancel any existing timer for this room
		const existingTimer = this.debounceTimers.get(roomId);
		if (existingTimer) {
			clearTimeout(existingTimer);
		}

		// Schedule new emission after debounce delay
		const timer = setTimeout(() => {
			this.debounceTimers.delete(roomId);
			void this.emitLightingStateChange(roomId);
		}, LIGHTING_STATE_DEBOUNCE_MS);

		this.debounceTimers.set(roomId, timer);
	}

	/**
	 * Recalculate lighting state and emit event for a room.
	 */
	private async emitLightingStateChange(roomId: string): Promise<void> {
		try {
			const state = await this.lightingStateService.getLightingState(roomId, {
				synchronizeModeValidity: false,
			});

			// Only emit event if state is valid (space exists and has lights)
			if (!state || !state.hasLights) {
				this.logger.debug(`No valid lighting state for room=${roomId}, skipping event emission`);
				return;
			}

			// Convert to data model and emit event
			const stateModel = LightingStateDataModel.fromState(state);

			this.eventEmitter.emit(EventType.LIGHTING_STATE_CHANGED, {
				space_id: roomId,
				state: stateModel,
			});

			this.logger.debug(`Emitted LIGHTING_STATE_CHANGED for room=${roomId} due to property change`);
		} catch (error) {
			const err = error as Error;
			this.logger.warn(`Failed to emit lighting state change for room=${roomId}: ${err.message}`);
		}
	}
}

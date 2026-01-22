import { Repository } from 'typeorm';

import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import { EventType as DevicesEventType, PropertyCategory } from '../../devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { SensorStateDataModel } from '../models/spaces-response.model';
import { SpaceSensorStateService } from '../services/space-sensor-state.service';
import { EventType, SENSOR_CHANNEL_CATEGORIES, SPACES_MODULE_NAME } from '../spaces.constants';

/**
 * Debounce delay in milliseconds for sensor state change events.
 * Prevents flooding WebSocket clients when multiple properties update quickly.
 */
const SENSOR_STATE_DEBOUNCE_MS = 100;

/**
 * Property categories that can impact sensor state calculations.
 * Mirrors the properties read in SpaceSensorStateService.extractChannelValue.
 */
const SENSOR_PROPERTY_CATEGORIES: PropertyCategory[] = [
	PropertyCategory.TEMPERATURE,
	PropertyCategory.HUMIDITY,
	PropertyCategory.PRESSURE,
	PropertyCategory.ILLUMINANCE,
	PropertyCategory.CONCENTRATION,
	PropertyCategory.AQI,
	PropertyCategory.DETECTED,
	PropertyCategory.POWER,
	PropertyCategory.CONSUMPTION,
	PropertyCategory.PERCENTAGE,
];

@Injectable()
export class SpaceSensorStateListener implements OnModuleInit, OnModuleDestroy {
	private readonly logger = createExtensionLogger(SPACES_MODULE_NAME, 'SpaceSensorStateListener');

	/**
	 * Debounce timers per room to prevent flooding WebSocket with events.
	 * Key: roomId, Value: NodeJS.Timeout
	 */
	private readonly debounceTimers = new Map<string, NodeJS.Timeout>();

	constructor(
		@InjectRepository(ChannelEntity)
		private readonly channelRepository: Repository<ChannelEntity>,
		private readonly sensorStateService: SpaceSensorStateService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	onModuleInit() {
		this.logger.debug('Space sensor state listener initialized');
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
			await this.processSensorPropertyChange(property);
		} catch (error) {
			const err = error as Error;
			this.logger.warn(`Failed to process sensor property change: ${err.message}`, err.stack);
		}
	}

	private async processSensorPropertyChange(property: ChannelPropertyEntity): Promise<void> {
		// 1. Check if property category is sensor-relevant
		if (!SENSOR_PROPERTY_CATEGORIES.includes(property.category)) {
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

		// 4. Check if channel category is sensor-relevant
		if (!SENSOR_CHANNEL_CATEGORIES.includes(channel.category as (typeof SENSOR_CHANNEL_CATEGORIES)[number])) {
			return;
		}

		const device = channel.device as DeviceEntity;
		const roomId = device.roomId;

		if (!roomId) {
			return;
		}

		// 5. Schedule debounced state recalculation and event emission
		this.scheduleSensorStateEmit(roomId);
	}

	/**
	 * Schedule a debounced sensor state recalculation and event emission for a room.
	 * If multiple property changes happen within the debounce window, only one
	 * state recalculation and event emission will occur.
	 */
	private scheduleSensorStateEmit(roomId: string): void {
		// Cancel any existing timer for this room
		const existingTimer = this.debounceTimers.get(roomId);
		if (existingTimer) {
			clearTimeout(existingTimer);
		}

		// Schedule new emission after debounce delay
		const timer = setTimeout(() => {
			this.debounceTimers.delete(roomId);
			void this.emitSensorStateChange(roomId);
		}, SENSOR_STATE_DEBOUNCE_MS);

		this.debounceTimers.set(roomId, timer);
	}

	/**
	 * Recalculate sensor state and emit event for a room.
	 */
	private async emitSensorStateChange(roomId: string): Promise<void> {
		try {
			const state = await this.sensorStateService.getSensorState(roomId);

			// Only emit event if state is valid (space exists and has sensors)
			if (!state || !state.hasSensors) {
				this.logger.debug(`No valid sensor state for room=${roomId}, skipping event emission`);
				return;
			}

			// Convert to data model and emit event
			const stateModel = toInstance(SensorStateDataModel, state);

			this.eventEmitter.emit(EventType.SENSOR_STATE_CHANGED, {
				space_id: roomId,
				state: stateModel,
			});

			this.logger.debug(`Emitted SENSOR_STATE_CHANGED for room=${roomId} due to property change`);
		} catch (error) {
			const err = error as Error;
			this.logger.warn(`Failed to emit sensor state change for room=${roomId}: ${err.message}`);
		}
	}
}

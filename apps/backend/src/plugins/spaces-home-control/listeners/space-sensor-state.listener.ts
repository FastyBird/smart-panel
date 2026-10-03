import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import { EventType as DevicesEventType, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { PropertyMetadataService } from '../../../modules/devices/services/property-metadata.service';
import { SPACES_MODULE_NAME } from '../../../modules/spaces/spaces.constants';
import { SensorStateDataModel } from '../models/spaces-response.model';
import { SpaceSensorStateService } from '../services/space-sensor-state.service';
import { EventType, SENSOR_CHANNEL_CATEGORIES } from '../spaces-home-control.constants';

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
		private readonly propertyMetadata: PropertyMetadataService,
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

	@OnEvent(EventType.SENSOR_TARGET_CREATED)
	@OnEvent(EventType.SENSOR_TARGET_UPDATED)
	@OnEvent(EventType.SENSOR_TARGET_DELETED)
	handleSensorRoleChanged(payload: { space_id: string }): void {
		const spaceId = payload?.space_id;

		if (!spaceId) {
			return;
		}

		this.scheduleSensorStateEmit(spaceId);
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
		if (!property.id || !SENSOR_PROPERTY_CATEGORIES.includes(property.category)) {
			return;
		}

		// Use current structural membership, not a potentially stale relation carried by the event.
		// The ingestion path already warms this catalog; device moves/remaps invalidate it.
		const metadata = await this.propertyMetadata.findOne(property.id);
		const channel = metadata?.channel;

		if (!channel || typeof channel === 'string') {
			return;
		}

		// Check if channel category is sensor-relevant
		if (!SENSOR_CHANNEL_CATEGORIES.includes(channel.category as (typeof SENSOR_CHANNEL_CATEGORIES)[number])) {
			return;
		}

		const device = channel.device;
		const roomId = device && typeof device !== 'string' ? device.roomId : null;

		if (!roomId) {
			return;
		}

		// Schedule debounced state recalculation and event emission
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

			if (!state) {
				this.logger.debug(`No sensor state for room=${roomId}, skipping event emission`);
				return;
			}

			// Convert to data model and emit event.
			// Always emit, even when hasSensors is false (all roles removed),
			// so panel clients can update to "not configured" state.
			const stateModel = toInstance(SensorStateDataModel, state);

			this.eventEmitter.emit(EventType.SENSOR_STATE_CHANGED, {
				space_id: roomId,
				state: stateModel,
			});

			this.logger.debug(`Emitted SENSOR_STATE_CHANGED for room=${roomId} (hasSensors=${state.hasSensors})`);
		} catch (error) {
			const err = error as Error;
			this.logger.warn(`Failed to emit sensor state change for room=${roomId}: ${err.message}`);
		}
	}
}

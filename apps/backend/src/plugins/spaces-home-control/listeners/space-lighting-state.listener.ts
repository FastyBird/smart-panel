import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger';
import { ChannelCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { EventType as DevicesEventType } from '../../../modules/devices/devices.constants';
import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { PropertyMetadataService } from '../../../modules/devices/services/property-metadata.service';
import { SPACES_MODULE_NAME } from '../../../modules/spaces/spaces.constants';
import { LightingStateDataModel } from '../models/spaces-response.model';
import { SpaceLightingStateService } from '../services/space-lighting-state.service';
import { EventType } from '../spaces-home-control.constants';

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
		private readonly propertyMetadata: PropertyMetadataService,
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
		if (!property.id || !LIGHTING_PROPERTY_CATEGORIES.includes(property.category)) {
			return;
		}

		// Use current structural membership, not a potentially stale relation carried by the event.
		// The ingestion path already warms this catalog; device moves/remaps invalidate it.
		const metadata = await this.propertyMetadata.findOne(property.id);
		const channel = metadata?.channel;

		if (!channel || typeof channel === 'string') {
			return;
		}

		// Check if channel category is lighting-relevant
		if (!LIGHTING_CHANNEL_CATEGORIES.includes(channel.category)) {
			return;
		}

		const device = channel.device;
		const roomId = device && typeof device !== 'string' ? device.roomId : null;

		if (!roomId) {
			return;
		}

		// Schedule debounced state recalculation and event emission
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

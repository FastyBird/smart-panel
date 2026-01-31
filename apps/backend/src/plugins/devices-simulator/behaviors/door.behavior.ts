import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { SimulatorDeviceEntity } from '../entities/devices-simulator.entity';

import {
	BaseDeviceBehavior,
	DeviceBehaviorState,
	PropertyChangeEvent,
	ScheduledPropertyUpdate,
} from './device-behavior.interface';

/**
 * Realistic door behavior.
 *
 * Simulates motorized door/garage door:
 * - Open/close takes 3-8 seconds depending on type
 * - Status transitions through opening/closing states
 * - Obstruction detection halts operation
 */
export class DoorRealisticBehavior extends BaseDeviceBehavior {
	private static readonly DOOR_TRAVEL_TIME_MS = 5000;
	private static readonly GARAGE_TRAVEL_TIME_MS = 8000;

	getType(): string {
		return 'door-realistic';
	}

	getSupportedCategory(): DeviceCategory {
		return DeviceCategory.DOOR;
	}

	onPropertyChanged(
		device: SimulatorDeviceEntity,
		event: PropertyChangeEvent,
		state: DeviceBehaviorState,
	): ScheduledPropertyUpdate[] {
		const updates: ScheduledPropertyUpdate[] = [];

		if (event.channelCategory === ChannelCategory.DOOR) {
			if (event.propertyCategory === PropertyCategory.COMMAND) {
				const command = event.value as string;
				const isOpening = command === 'open';
				const travelTime = this.getTravelTime(state);

				// Cancel existing transitions
				this.cancelTransitions(state, ChannelCategory.DOOR, PropertyCategory.STATUS);

				if (command === 'stop') {
					updates.push({
						channelCategory: ChannelCategory.DOOR,
						propertyCategory: PropertyCategory.STATUS,
						targetValue: 'stopped',
						delayMs: 0,
						durationMs: 0,
					});
				} else {
					// Set status to opening/closing immediately
					updates.push({
						channelCategory: ChannelCategory.DOOR,
						propertyCategory: PropertyCategory.STATUS,
						targetValue: isOpening ? 'opening' : 'closing',
						delayMs: 0,
						durationMs: 0,
					});

					// Set final status after travel time
					updates.push({
						channelCategory: ChannelCategory.DOOR,
						propertyCategory: PropertyCategory.STATUS,
						targetValue: isOpening ? 'opened' : 'closed',
						delayMs: travelTime,
						durationMs: 0,
					});
				}
			}
		}

		return updates;
	}

	private getTravelTime(state: DeviceBehaviorState): number {
		const doorType = this.getStateValue(state, 'doorType', 'door') as string;
		return doorType === 'garage'
			? DoorRealisticBehavior.GARAGE_TRAVEL_TIME_MS
			: DoorRealisticBehavior.DOOR_TRAVEL_TIME_MS;
	}
}

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
 * Simulates motorized door:
 * - Open/close takes ~5 seconds
 * - Status transitions through opening/closing states
 */
export class DoorRealisticBehavior extends BaseDeviceBehavior {
	private static readonly TRAVEL_TIME_MS = 5000;

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
				const travelTime = DoorRealisticBehavior.TRAVEL_TIME_MS;

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
}

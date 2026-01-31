import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { SimulatorDeviceEntity } from '../entities/devices-simulator.entity';

import {
	BaseDeviceBehavior,
	DeviceBehaviorState,
	PropertyChangeEvent,
	ScheduledPropertyUpdate,
} from './device-behavior.interface';

/**
 * Realistic lock behavior.
 *
 * Simulates real smart lock response times:
 * - Lock/unlock: 1-2 second mechanical delay before confirming state
 * - Battery drain per operation (~0.1% per lock/unlock cycle)
 */
export class LockRealisticBehavior extends BaseDeviceBehavior {
	private static readonly LOCK_ACTION_DELAY_MS = 1500;
	private static readonly BATTERY_DRAIN_PER_ACTION = 0.1;

	getType(): string {
		return 'lock-realistic';
	}

	getSupportedCategory(): DeviceCategory {
		return DeviceCategory.LOCK;
	}

	onPropertyChanged(
		device: SimulatorDeviceEntity,
		event: PropertyChangeEvent,
		state: DeviceBehaviorState,
	): ScheduledPropertyUpdate[] {
		const updates: ScheduledPropertyUpdate[] = [];

		if (event.channelCategory === ChannelCategory.LOCK) {
			if (event.propertyCategory === PropertyCategory.ON) {
				// Lock on/off command → delayed confirmation via status
				this.cancelTransitions(state, ChannelCategory.LOCK, PropertyCategory.STATUS);

				const targetStatus = event.value === true ? 'locked' : 'unlocked';

				updates.push({
					channelCategory: ChannelCategory.LOCK,
					propertyCategory: PropertyCategory.STATUS,
					targetValue: targetStatus,
					delayMs: LockRealisticBehavior.LOCK_ACTION_DELAY_MS,
					durationMs: 0,
				});

				// Simulate battery drain on each action
				if (this.hasChannel(device, ChannelCategory.BATTERY)) {
					const currentBattery = this.getOrInitStateFromDevice(
						state, 'battery', device, ChannelCategory.BATTERY, PropertyCategory.PERCENTAGE, 100,
					);
					const newBattery = Math.max(0, currentBattery - LockRealisticBehavior.BATTERY_DRAIN_PER_ACTION);
					this.setStateValue(state, 'battery', newBattery);

					this.cancelTransitions(state, ChannelCategory.BATTERY, PropertyCategory.PERCENTAGE);
					updates.push({
						channelCategory: ChannelCategory.BATTERY,
						propertyCategory: PropertyCategory.PERCENTAGE,
						targetValue: Math.round(newBattery),
						delayMs: LockRealisticBehavior.LOCK_ACTION_DELAY_MS,
						durationMs: 0,
					});
				}
			}
		}

		return updates;
	}
}

import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { SimulatorDeviceEntity } from '../entities/devices-simulator.entity';

import {
	BaseDeviceBehavior,
	DeviceBehaviorState,
	PropertyChangeEvent,
	ScheduledPropertyUpdate,
} from './device-behavior.interface';

/**
 * Realistic television behavior.
 *
 * Simulates real TV response times:
 * - Power on/off: delayed ACTIVE state change after boot/shutdown
 *
 * Note: The platform persists property values immediately on command, so
 * behaviors only schedule updates to *different* properties that reflect
 * the device's resulting operational state.
 */
export class TelevisionDelayedBehavior extends BaseDeviceBehavior {
	private static readonly POWER_ON_DELAY_MS = 3000;
	private static readonly POWER_OFF_DELAY_MS = 800;

	getType(): string {
		return 'television-delayed';
	}

	getSupportedCategory(): DeviceCategory {
		return DeviceCategory.TELEVISION;
	}

	onPropertyChanged(
		_device: SimulatorDeviceEntity,
		event: PropertyChangeEvent,
		state: DeviceBehaviorState,
	): ScheduledPropertyUpdate[] {
		const updates: ScheduledPropertyUpdate[] = [];

		if (event.channelCategory === ChannelCategory.TELEVISION) {
			if (event.propertyCategory === PropertyCategory.ON) {
				const turningOn = event.value === true;
				const delay = turningOn
					? TelevisionDelayedBehavior.POWER_ON_DELAY_MS
					: TelevisionDelayedBehavior.POWER_OFF_DELAY_MS;

				// Schedule the ACTIVE state change after boot/shutdown delay
				this.cancelTransitions(state, ChannelCategory.TELEVISION, PropertyCategory.ACTIVE);
				updates.push({
					channelCategory: ChannelCategory.TELEVISION,
					propertyCategory: PropertyCategory.ACTIVE,
					targetValue: turningOn,
					delayMs: delay,
					durationMs: 0,
				});
			}
		}

		return updates;
	}
}

import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { SimulatorDeviceEntity } from '../entities/devices-simulator.entity';

import {
	BaseDeviceBehavior,
	DeviceBehaviorState,
	PropertyChangeEvent,
	ScheduledPropertyUpdate,
} from './device-behavior.interface';

/**
 * Realistic projector behavior.
 *
 * Simulates real projector response times:
 * - Power on/off: delayed ACTIVE state change after warm-up/cool-down
 *
 * Note: The platform persists property values immediately on command, so
 * behaviors only schedule updates to *different* properties that reflect
 * the device's resulting operational state.
 */
export class ProjectorDelayedBehavior extends BaseDeviceBehavior {
	private static readonly POWER_ON_DELAY_MS = 5000;
	private static readonly POWER_OFF_DELAY_MS = 2000;

	getType(): string {
		return 'projector-delayed';
	}

	getSupportedCategory(): DeviceCategory {
		return DeviceCategory.PROJECTOR;
	}

	onPropertyChanged(
		_device: SimulatorDeviceEntity,
		event: PropertyChangeEvent,
		state: DeviceBehaviorState,
	): ScheduledPropertyUpdate[] {
		const updates: ScheduledPropertyUpdate[] = [];

		if (event.channelCategory === ChannelCategory.PROJECTOR) {
			if (event.propertyCategory === PropertyCategory.ON) {
				const turningOn = event.value === true;
				const delay = turningOn
					? ProjectorDelayedBehavior.POWER_ON_DELAY_MS
					: ProjectorDelayedBehavior.POWER_OFF_DELAY_MS;

				// Schedule the ACTIVE state change after warm-up/cool-down delay
				this.cancelTransitions(state, ChannelCategory.PROJECTOR, PropertyCategory.ACTIVE);
				updates.push({
					channelCategory: ChannelCategory.PROJECTOR,
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

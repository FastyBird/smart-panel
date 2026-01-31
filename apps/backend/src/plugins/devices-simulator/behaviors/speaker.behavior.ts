import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { SimulatorDeviceEntity } from '../entities/devices-simulator.entity';

import {
	BaseDeviceBehavior,
	DeviceBehaviorState,
	PropertyChangeEvent,
	ScheduledPropertyUpdate,
} from './device-behavior.interface';

/**
 * Realistic speaker behavior.
 *
 * Simulates smart speaker response times:
 * - Power off: stops media playback after shutdown delay
 *
 * Note: The platform persists property values immediately on command, so
 * behaviors only schedule updates to *different* properties that reflect
 * the device's resulting operational state.
 */
export class SpeakerRealisticBehavior extends BaseDeviceBehavior {
	private static readonly POWER_OFF_DELAY_MS = 500;

	getType(): string {
		return 'speaker-realistic';
	}

	getSupportedCategory(): DeviceCategory {
		return DeviceCategory.SPEAKER;
	}

	onPropertyChanged(
		device: SimulatorDeviceEntity,
		event: PropertyChangeEvent,
		state: DeviceBehaviorState,
	): ScheduledPropertyUpdate[] {
		const updates: ScheduledPropertyUpdate[] = [];

		// When speaker is deactivated, stop media playback after shutdown delay
		if (event.channelCategory === ChannelCategory.SPEAKER && event.propertyCategory === PropertyCategory.ACTIVE) {
			if (event.value === false && this.hasChannel(device, ChannelCategory.MEDIA_PLAYBACK)) {
				this.cancelTransitions(state, ChannelCategory.MEDIA_PLAYBACK, PropertyCategory.STATUS);
				updates.push({
					channelCategory: ChannelCategory.MEDIA_PLAYBACK,
					propertyCategory: PropertyCategory.STATUS,
					targetValue: 'stopped',
					delayMs: SpeakerRealisticBehavior.POWER_OFF_DELAY_MS,
					durationMs: 0,
				});
			}
		}

		return updates;
	}
}

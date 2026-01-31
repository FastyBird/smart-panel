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
 * - Power on: 2-4 second boot delay before confirming ON state
 * - Power off: 0.5-1 second delay before confirming OFF state
 * - Source switching: 1-2 second delay for input change
 * - Volume changes: near-instant but with small delay for OSD
 */
export class TelevisionDelayedBehavior extends BaseDeviceBehavior {
	private static readonly POWER_ON_DELAY_MS = 3000;
	private static readonly POWER_OFF_DELAY_MS = 800;
	private static readonly SOURCE_SWITCH_DELAY_MS = 1500;
	private static readonly VOLUME_DELAY_MS = 200;

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

				// Cancel any pending power transitions
				this.cancelTransitions(state, ChannelCategory.TELEVISION, PropertyCategory.ON);

				// Schedule the confirmed state after delay
				updates.push({
					channelCategory: ChannelCategory.TELEVISION,
					propertyCategory: PropertyCategory.ON,
					targetValue: turningOn,
					delayMs: delay,
					durationMs: 0,
				});

				// If turning on, also schedule active state
				if (turningOn) {
					this.cancelTransitions(state, ChannelCategory.TELEVISION, PropertyCategory.ACTIVE);
					updates.push({
						channelCategory: ChannelCategory.TELEVISION,
						propertyCategory: PropertyCategory.ACTIVE,
						targetValue: true,
						delayMs: delay,
						durationMs: 0,
					});
				} else {
					this.cancelTransitions(state, ChannelCategory.TELEVISION, PropertyCategory.ACTIVE);
					updates.push({
						channelCategory: ChannelCategory.TELEVISION,
						propertyCategory: PropertyCategory.ACTIVE,
						targetValue: false,
						delayMs: delay,
						durationMs: 0,
					});
				}
			}

			if (event.propertyCategory === PropertyCategory.SOURCE) {
				this.cancelTransitions(state, ChannelCategory.TELEVISION, PropertyCategory.SOURCE);

				updates.push({
					channelCategory: ChannelCategory.TELEVISION,
					propertyCategory: PropertyCategory.SOURCE,
					targetValue: event.value,
					delayMs: TelevisionDelayedBehavior.SOURCE_SWITCH_DELAY_MS,
					durationMs: 0,
				});
			}
		}

		// Speaker/volume changes
		if (event.channelCategory === ChannelCategory.SPEAKER) {
			if (event.propertyCategory === PropertyCategory.VOLUME) {
				this.cancelTransitions(state, ChannelCategory.SPEAKER, PropertyCategory.VOLUME);

				updates.push({
					channelCategory: ChannelCategory.SPEAKER,
					propertyCategory: PropertyCategory.VOLUME,
					targetValue: event.value,
					delayMs: TelevisionDelayedBehavior.VOLUME_DELAY_MS,
					durationMs: 0,
				});
			}

			if (event.propertyCategory === PropertyCategory.MUTE) {
				this.cancelTransitions(state, ChannelCategory.SPEAKER, PropertyCategory.MUTE);

				updates.push({
					channelCategory: ChannelCategory.SPEAKER,
					propertyCategory: PropertyCategory.MUTE,
					targetValue: event.value,
					delayMs: TelevisionDelayedBehavior.VOLUME_DELAY_MS,
					durationMs: 0,
				});
			}
		}

		return updates;
	}
}

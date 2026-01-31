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
 * - Power on/off: ~1.5s boot/shutdown delay
 * - Volume changes: small delay for OSD response (~200ms)
 * - Source switching: ~1s delay for input change
 * - Media playback state changes: near-instant but with small confirmation delay
 */
export class SpeakerRealisticBehavior extends BaseDeviceBehavior {
	private static readonly POWER_ON_DELAY_MS = 1500;
	private static readonly POWER_OFF_DELAY_MS = 500;
	private static readonly VOLUME_DELAY_MS = 200;
	private static readonly SOURCE_SWITCH_DELAY_MS = 1000;
	private static readonly PLAYBACK_DELAY_MS = 300;

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

		// Speaker channel - power and volume
		if (event.channelCategory === ChannelCategory.SPEAKER) {
			if (event.propertyCategory === PropertyCategory.ACTIVE) {
				const turningOn = event.value === true;
				const delay = turningOn
					? SpeakerRealisticBehavior.POWER_ON_DELAY_MS
					: SpeakerRealisticBehavior.POWER_OFF_DELAY_MS;

				this.cancelTransitions(state, ChannelCategory.SPEAKER, PropertyCategory.ACTIVE);
				updates.push({
					channelCategory: ChannelCategory.SPEAKER,
					propertyCategory: PropertyCategory.ACTIVE,
					targetValue: turningOn,
					delayMs: delay,
					durationMs: 0,
				});
			}

			if (event.propertyCategory === PropertyCategory.VOLUME) {
				this.cancelTransitions(state, ChannelCategory.SPEAKER, PropertyCategory.VOLUME);
				updates.push({
					channelCategory: ChannelCategory.SPEAKER,
					propertyCategory: PropertyCategory.VOLUME,
					targetValue: event.value,
					delayMs: SpeakerRealisticBehavior.VOLUME_DELAY_MS,
					durationMs: 0,
				});
			}

			if (event.propertyCategory === PropertyCategory.MUTE) {
				this.cancelTransitions(state, ChannelCategory.SPEAKER, PropertyCategory.MUTE);
				updates.push({
					channelCategory: ChannelCategory.SPEAKER,
					propertyCategory: PropertyCategory.MUTE,
					targetValue: event.value,
					delayMs: SpeakerRealisticBehavior.VOLUME_DELAY_MS,
					durationMs: 0,
				});
			}
		}

		// Media input - source switching
		if (event.channelCategory === ChannelCategory.MEDIA_INPUT) {
			if (event.propertyCategory === PropertyCategory.SOURCE) {
				this.cancelTransitions(state, ChannelCategory.MEDIA_INPUT, PropertyCategory.SOURCE);
				updates.push({
					channelCategory: ChannelCategory.MEDIA_INPUT,
					propertyCategory: PropertyCategory.SOURCE,
					targetValue: event.value,
					delayMs: SpeakerRealisticBehavior.SOURCE_SWITCH_DELAY_MS,
					durationMs: 0,
				});
			}
		}

		// Media playback
		if (event.channelCategory === ChannelCategory.MEDIA_PLAYBACK) {
			if (event.propertyCategory === PropertyCategory.STATUS) {
				this.cancelTransitions(state, ChannelCategory.MEDIA_PLAYBACK, PropertyCategory.STATUS);
				updates.push({
					channelCategory: ChannelCategory.MEDIA_PLAYBACK,
					propertyCategory: PropertyCategory.STATUS,
					targetValue: event.value,
					delayMs: SpeakerRealisticBehavior.PLAYBACK_DELAY_MS,
					durationMs: 0,
				});
			}
		}

		return updates;
	}
}

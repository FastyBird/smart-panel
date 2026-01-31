import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { SimulatorDeviceEntity } from '../entities/devices-simulator.entity';

import {
	BaseDeviceBehavior,
	BehaviorTickResult,
	DeviceBehaviorState,
	PropertyChangeEvent,
	ScheduledPropertyUpdate,
} from './device-behavior.interface';

/**
 * Realistic window covering behavior.
 *
 * Simulates real motorized blinds/shades:
 * - Full travel takes 10-15 seconds (motor speed)
 * - Status changes through opening/closing states before reaching target
 * - Stop command halts at current position
 */
export class WindowCoveringRealisticBehavior extends BaseDeviceBehavior {
	private static readonly FULL_TRAVEL_TIME_MS = 12000;

	getType(): string {
		return 'window-covering-realistic';
	}

	getSupportedCategory(): DeviceCategory {
		return DeviceCategory.WINDOW_COVERING;
	}

	onPropertyChanged(
		device: SimulatorDeviceEntity,
		event: PropertyChangeEvent,
		state: DeviceBehaviorState,
	): ScheduledPropertyUpdate[] {
		const updates: ScheduledPropertyUpdate[] = [];

		if (event.channelCategory === ChannelCategory.WINDOW_COVERING) {
			if (event.propertyCategory === PropertyCategory.COMMAND) {
				const command = event.value as string;
				const currentPosition = this.getStateValue(state, 'position', 0) as number;

				if (command === 'stop') {
					// Cancel all transitions and set status to stopped
					this.cancelTransitions(state, ChannelCategory.WINDOW_COVERING, PropertyCategory.POSITION);
					this.cancelTransitions(state, ChannelCategory.WINDOW_COVERING, PropertyCategory.STATUS);

					updates.push({
						channelCategory: ChannelCategory.WINDOW_COVERING,
						propertyCategory: PropertyCategory.STATUS,
						targetValue: 'stopped',
						delayMs: 0,
						durationMs: 0,
					});
				} else {
					const targetPosition = command === 'open' ? 100 : 0;
					const distance = Math.abs(targetPosition - currentPosition);
					const travelTime = Math.round(
						(distance / 100) * WindowCoveringRealisticBehavior.FULL_TRAVEL_TIME_MS,
					);

					this.scheduleTravel(state, updates, currentPosition, targetPosition, travelTime);
				}
			}

			if (event.propertyCategory === PropertyCategory.POSITION) {
				const targetPosition = event.value as number;
				const currentPosition = this.getStateValue(state, 'position', 0) as number;
				const distance = Math.abs(targetPosition - currentPosition);
				const travelTime = Math.round(
					(distance / 100) * WindowCoveringRealisticBehavior.FULL_TRAVEL_TIME_MS,
				);

				this.scheduleTravel(state, updates, currentPosition, targetPosition, travelTime);
			}
		}

		return updates;
	}

	override tick(
		device: SimulatorDeviceEntity,
		state: DeviceBehaviorState,
		now: number,
	): BehaviorTickResult[] {
		const results = super.tick(device, state, now);

		for (const result of results) {
			if (
				result.channelCategory === ChannelCategory.WINDOW_COVERING &&
				result.propertyCategory === PropertyCategory.POSITION
			) {
				this.setStateValue(state, 'position', result.value);
			}
		}

		return results;
	}

	private scheduleTravel(
		state: DeviceBehaviorState,
		updates: ScheduledPropertyUpdate[],
		currentPosition: number,
		targetPosition: number,
		travelTime: number,
	): void {
		const isOpening = targetPosition > currentPosition;

		// Cancel existing transitions
		this.cancelTransitions(state, ChannelCategory.WINDOW_COVERING, PropertyCategory.POSITION);
		this.cancelTransitions(state, ChannelCategory.WINDOW_COVERING, PropertyCategory.STATUS);

		// Set status to opening/closing immediately
		updates.push({
			channelCategory: ChannelCategory.WINDOW_COVERING,
			propertyCategory: PropertyCategory.STATUS,
			targetValue: isOpening ? 'opening' : 'closing',
			delayMs: 0,
			durationMs: 0,
		});

		// Gradual position change
		updates.push({
			channelCategory: ChannelCategory.WINDOW_COVERING,
			propertyCategory: PropertyCategory.POSITION,
			targetValue: targetPosition,
			startValue: currentPosition,
			delayMs: 0,
			durationMs: travelTime,
		});

		// Set status to opened/closed when done
		updates.push({
			channelCategory: ChannelCategory.WINDOW_COVERING,
			propertyCategory: PropertyCategory.STATUS,
			targetValue: targetPosition >= 100 ? 'opened' : targetPosition <= 0 ? 'closed' : 'stopped',
			delayMs: travelTime,
			durationMs: 0,
		});
	}
}

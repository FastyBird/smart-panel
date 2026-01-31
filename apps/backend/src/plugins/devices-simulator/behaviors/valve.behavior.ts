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
 * Realistic valve behavior.
 *
 * Simulates real motorized valve response:
 * - Open/close takes 2-5 seconds (motorized valve travel time)
 * - Position gradually changes during open/close
 * - Flow rate changes based on valve position
 */
export class ValveRealisticBehavior extends BaseDeviceBehavior {
	private static readonly VALVE_TRAVEL_TIME_MS = 3000;

	getType(): string {
		return 'valve-realistic';
	}

	getSupportedCategory(): DeviceCategory {
		return DeviceCategory.VALVE;
	}

	onPropertyChanged(
		device: SimulatorDeviceEntity,
		event: PropertyChangeEvent,
		state: DeviceBehaviorState,
	): ScheduledPropertyUpdate[] {
		const updates: ScheduledPropertyUpdate[] = [];

		if (event.channelCategory === ChannelCategory.VALVE) {
			if (event.propertyCategory === PropertyCategory.ON) {
				const opening = event.value === true;
				const currentPosition = this.getStateValue(state, 'position', opening ? 0 : 100) as number;
				const targetPosition = opening ? 100 : 0;

				this.setStateValue(state, 'targetPosition', targetPosition);

				// Gradual position change
				this.cancelTransitions(state, ChannelCategory.VALVE, PropertyCategory.PERCENTAGE);
				updates.push({
					channelCategory: ChannelCategory.VALVE,
					propertyCategory: PropertyCategory.PERCENTAGE,
					targetValue: targetPosition,
					startValue: currentPosition,
					delayMs: 0,
					durationMs: ValveRealisticBehavior.VALVE_TRAVEL_TIME_MS,
				});
			}

			// Direct position command
			if (event.propertyCategory === PropertyCategory.PERCENTAGE) {
				const targetPosition = event.value as number;
				const currentPosition = this.getStateValue(state, 'position', 0) as number;

				this.setStateValue(state, 'targetPosition', targetPosition);

				this.cancelTransitions(state, ChannelCategory.VALVE, PropertyCategory.PERCENTAGE);
				updates.push({
					channelCategory: ChannelCategory.VALVE,
					propertyCategory: PropertyCategory.PERCENTAGE,
					targetValue: targetPosition,
					startValue: currentPosition,
					delayMs: 0,
					durationMs: ValveRealisticBehavior.VALVE_TRAVEL_TIME_MS,
				});
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
		const additional: BehaviorTickResult[] = [];

		// Track position in state and update flow rate
		for (const result of results) {
			if (
				result.channelCategory === ChannelCategory.VALVE &&
				result.propertyCategory === PropertyCategory.PERCENTAGE
			) {
				this.setStateValue(state, 'position', result.value);

				// Simulate flow rate proportional to valve position
				if (this.hasChannel(device, ChannelCategory.FLOW)) {
					const maxFlow = 5.0; // m³/h
					const flowRate = Math.round(((result.value as number) / 100) * maxFlow * 10) / 10;
					additional.push({
						channelCategory: ChannelCategory.FLOW,
						propertyCategory: PropertyCategory.RATE,
						value: flowRate,
					});
				}
			}
		}

		return results.concat(additional);
	}
}

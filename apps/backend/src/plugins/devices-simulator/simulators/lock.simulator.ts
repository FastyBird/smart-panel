import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { SimulatorDeviceEntity } from '../entities/devices-simulator.entity';

import { BaseDeviceSimulator, SimulatedPropertyValue } from './device-simulator.interface';
import { SimulationContext } from './simulation-context';

/**
 * Simulator for smart lock devices
 * Simulates realistic lock behavior based on time of day and activity patterns.
 */
export class LockSimulator extends BaseDeviceSimulator {
	getSupportedCategory(): DeviceCategory {
		return DeviceCategory.LOCK;
	}

	simulate(
		device: SimulatorDeviceEntity,
		context: SimulationContext,
		previousValues?: Map<string, string | number | boolean>,
	): SimulatedPropertyValue[] {
		const values: SimulatedPropertyValue[] = [];

		// Lock channel
		if (this.hasChannel(device, ChannelCategory.LOCK)) {
			values.push(...this.simulateLock(context, previousValues));
		}

		// Battery channel
		if (this.hasChannel(device, ChannelCategory.BATTERY)) {
			values.push(...this.simulateBattery(previousValues));
		}

		return values;
	}

	/**
	 * Simulate lock state
	 */
	private simulateLock(
		context: SimulationContext,
		_previousValues?: Map<string, string | number | boolean>,
	): SimulatedPropertyValue[] {
		const values: SimulatedPropertyValue[] = [];

		// Lock is usually locked, especially at night
		let lockProbability: number;

		if (context.hour >= 22 || context.hour < 7) {
			lockProbability = 0.99; // Almost always locked at night
		} else if (context.hour >= 7 && context.hour < 9) {
			lockProbability = 0.7; // Morning - may be unlocked for departures
		} else if (context.hour >= 9 && context.hour < 17) {
			lockProbability = 0.9; // Daytime - usually locked
		} else {
			lockProbability = 0.8; // Evening - may be unlocked for arrivals
		}

		const isLocked = Math.random() < lockProbability;

		values.push({
			channelCategory: ChannelCategory.LOCK,
			propertyCategory: PropertyCategory.LOCKED,
			value: isLocked,
		});

		// Fault status (very rare)
		values.push({
			channelCategory: ChannelCategory.LOCK,
			propertyCategory: PropertyCategory.FAULT,
			value: Math.random() < 0.001, // 0.1% chance of fault
		});

		// Tampered status (very rare security event)
		values.push({
			channelCategory: ChannelCategory.LOCK,
			propertyCategory: PropertyCategory.TAMPERED,
			value: Math.random() < 0.0001, // 0.01% chance
		});

		return values;
	}

	/**
	 * Simulate battery level
	 */
	private simulateBattery(previousValues?: Map<string, string | number | boolean>): SimulatedPropertyValue[] {
		const prevBattery = this.getPreviousValue(
			previousValues,
			ChannelCategory.BATTERY,
			PropertyCategory.PERCENTAGE,
			100,
		) as number;

		// Battery decreases slowly
		const decrease = Math.random() * 0.02 + 0.005;
		let newBattery = prevBattery - decrease;

		// Reset if too low (simulating battery replacement)
		if (newBattery < 10) {
			newBattery = 100;
		}

		return [
			{
				channelCategory: ChannelCategory.BATTERY,
				propertyCategory: PropertyCategory.PERCENTAGE,
				value: Math.round(newBattery),
			},
		];
	}
}

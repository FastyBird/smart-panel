import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { SimulatorDeviceEntity } from '../entities/devices-simulator.entity';

import { BaseDeviceSimulator, SimulatedPropertyValue } from './device-simulator.interface';
import { SimulationContext } from './simulation-context';

/**
 * Simulator for smart lock devices
 * Simulates realistic lock behavior based on time of day and activity patterns.
 */
export class LockSimulator extends BaseDeviceSimulator {
	// Track raw battery values per device to accumulate small decreases without rounding loss
	private rawBatteryValues: Map<string, number> = new Map();

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
			values.push(...this.simulateBattery(device.id, previousValues));
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
	 * Uses internal raw value tracking to accumulate small decreases without rounding loss.
	 */
	private simulateBattery(
		deviceId: string,
		previousValues?: Map<string, string | number | boolean>,
	): SimulatedPropertyValue[] {
		// Get raw battery value (unrounded) from internal tracking, or initialize from previousValues
		let rawBattery = this.rawBatteryValues.get(deviceId);
		if (rawBattery === undefined) {
			// Initialize from stored value (which is rounded) or default to 100
			rawBattery = this.getPreviousValue(
				previousValues,
				ChannelCategory.BATTERY,
				PropertyCategory.PERCENTAGE,
				100,
			) as number;
		}

		// Battery decreases slowly (0.005-0.025% per update cycle)
		const decrease = Math.random() * 0.02 + 0.005;
		rawBattery -= decrease;

		// Reset if too low (simulating battery replacement)
		if (rawBattery < 10) {
			rawBattery = 100;
		}

		// Store the raw (unrounded) value for next cycle
		this.rawBatteryValues.set(deviceId, rawBattery);

		return [
			{
				channelCategory: ChannelCategory.BATTERY,
				propertyCategory: PropertyCategory.PERCENTAGE,
				value: Math.round(rawBattery),
			},
		];
	}
}

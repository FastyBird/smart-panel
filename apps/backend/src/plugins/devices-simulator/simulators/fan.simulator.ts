import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { SimulatorDeviceEntity } from '../entities/devices-simulator.entity';

import { BaseDeviceSimulator, SimulatedPropertyValue } from './device-simulator.interface';
import { SimulationContext } from './simulation-context';

/**
 * Simulator for fan devices
 * Simulates realistic fan behavior based on temperature and time of day.
 */
export class FanSimulator extends BaseDeviceSimulator {
	getSupportedCategory(): DeviceCategory {
		return DeviceCategory.FAN;
	}

	simulate(
		device: SimulatorDeviceEntity,
		context: SimulationContext,
		previousValues?: Map<string, string | number | boolean>,
	): SimulatedPropertyValue[] {
		const values: SimulatedPropertyValue[] = [];

		// Determine if fan should be on
		const shouldRun = this.shouldFanRun(context);

		// Fan channel
		if (this.hasChannel(device, ChannelCategory.FAN)) {
			values.push(...this.simulateFan(context, shouldRun, previousValues));
		}

		return values;
	}

	/**
	 * Determine if fan should be running
	 */
	private shouldFanRun(context: SimulationContext): boolean {
		// Fans more likely when warm
		if (context.outdoorTemperature > 28) {
			return Math.random() < 0.9;
		}
		if (context.outdoorTemperature > 24) {
			return Math.random() < 0.6;
		}
		if (context.outdoorTemperature > 20) {
			return Math.random() < 0.3;
		}
		return Math.random() < 0.1;
	}

	/**
	 * Simulate fan channel
	 */
	private simulateFan(
		context: SimulationContext,
		shouldRun: boolean,
		previousValues?: Map<string, string | number | boolean>,
	): SimulatedPropertyValue[] {
		const values: SimulatedPropertyValue[] = [];

		values.push({
			channelCategory: ChannelCategory.FAN,
			propertyCategory: PropertyCategory.ON,
			value: shouldRun,
		});

		if (!shouldRun) {
			return values;
		}

		// Speed based on temperature
		let speed: number;
		if (context.outdoorTemperature > 30) {
			speed = 90; // Max speed
		} else if (context.outdoorTemperature > 26) {
			speed = 70;
		} else if (context.outdoorTemperature > 22) {
			speed = 50;
		} else {
			speed = 30;
		}

		// Add variation and smooth transition
		const prevSpeed = this.getPreviousValue(
			previousValues,
			ChannelCategory.FAN,
			PropertyCategory.SPEED,
			speed,
		) as number;
		speed = Math.round(this.smoothTransition(prevSpeed, speed, 10));

		values.push({
			channelCategory: ChannelCategory.FAN,
			propertyCategory: PropertyCategory.SPEED,
			value: this.clamp(speed, 0, 100),
		});

		// Oscillation/swing
		values.push({
			channelCategory: ChannelCategory.FAN,
			propertyCategory: PropertyCategory.SWING,
			value: Math.random() < 0.5, // 50% chance swing is on
		});

		// Direction (some fans have reversible direction)
		const direction = Math.random() < 0.9 ? 'forward' : 'reverse';
		values.push({
			channelCategory: ChannelCategory.FAN,
			propertyCategory: PropertyCategory.DIRECTION,
			value: direction,
		});

		return values;
	}
}

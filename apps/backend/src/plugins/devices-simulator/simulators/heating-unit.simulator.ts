import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { SimulatorDeviceEntity } from '../entities/devices-simulator.entity';

import { BaseDeviceSimulator, SimulatedPropertyValue } from './device-simulator.interface';
import { SimulationContext } from './simulation-context';

/**
 * Simulator for heating unit devices
 * Simulates realistic heater behavior including temperature control and power consumption.
 */
export class HeatingUnitSimulator extends BaseDeviceSimulator {
	getSupportedCategory(): DeviceCategory {
		return DeviceCategory.HEATING_UNIT;
	}

	simulate(
		device: SimulatorDeviceEntity,
		context: SimulationContext,
		previousValues?: Map<string, string | number | boolean>,
	): SimulatedPropertyValue[] {
		const values: SimulatedPropertyValue[] = [];

		// Determine if heater should be running
		const shouldRun = this.shouldHeaterRun(context);
		const targetTemp = this.determineTargetTemperature(context);

		// Heater channel
		if (this.hasChannel(device, ChannelCategory.HEATER)) {
			values.push(...this.simulateHeater(shouldRun, targetTemp));
		}

		// Temperature channel
		if (this.hasChannel(device, ChannelCategory.TEMPERATURE)) {
			values.push(...this.simulateTemperature(context, previousValues, shouldRun, targetTemp));
		}

		// Fan channel (if heater has fan)
		if (this.hasChannel(device, ChannelCategory.FAN)) {
			values.push(...this.simulateFan(shouldRun));
		}

		// Electrical power channel
		if (this.hasChannel(device, ChannelCategory.ELECTRICAL_POWER)) {
			values.push(...this.simulatePower(shouldRun, context, previousValues, targetTemp));
		}

		return values;
	}

	/**
	 * Determine if heater should be running
	 */
	private shouldHeaterRun(context: SimulationContext): boolean {
		// Heater runs when it's cold
		if (context.outdoorTemperature < 5) {
			return Math.random() < 0.9; // Very likely on
		}
		if (context.outdoorTemperature < 12) {
			return Math.random() < 0.7;
		}
		if (context.outdoorTemperature < 18) {
			return Math.random() < 0.3;
		}
		return Math.random() < 0.05; // Rarely on when warm
	}

	/**
	 * Determine target temperature
	 */
	private determineTargetTemperature(context: SimulationContext): number {
		const hour = context.hour;

		// Night setback (cooler at night)
		if (hour >= 23 || hour < 6) {
			return 18;
		}
		// Morning warm-up
		if (hour >= 6 && hour < 8) {
			return 21;
		}
		// Daytime comfort
		return 21;
	}

	/**
	 * Simulate heater channel
	 */
	private simulateHeater(shouldRun: boolean, targetTemp: number): SimulatedPropertyValue[] {
		const values: SimulatedPropertyValue[] = [];

		values.push({
			channelCategory: ChannelCategory.HEATER,
			propertyCategory: PropertyCategory.ON,
			value: shouldRun,
		});

		values.push({
			channelCategory: ChannelCategory.HEATER,
			propertyCategory: PropertyCategory.ACTIVE,
			value: shouldRun,
		});

		values.push({
			channelCategory: ChannelCategory.HEATER,
			propertyCategory: PropertyCategory.TEMPERATURE,
			value: targetTemp,
		});

		return values;
	}

	/**
	 * Simulate temperature
	 */
	private simulateTemperature(
		context: SimulationContext,
		previousValues: Map<string, string | number | boolean> | undefined,
		shouldRun: boolean,
		targetTemp: number,
	): SimulatedPropertyValue[] {
		// Base indoor temperature influenced by outdoor
		const outdoorInfluence = shouldRun ? 0.05 : 0.2;
		const baseIndoor = 18 + (context.outdoorTemperature - 18) * outdoorInfluence;

		// Temperature target
		const effectiveTarget = shouldRun ? targetTemp : Math.max(baseIndoor, 15);

		const prevTemp = this.getPreviousValue(
			previousValues,
			ChannelCategory.TEMPERATURE,
			PropertyCategory.TEMPERATURE,
			baseIndoor,
		) as number;

		// Heating changes temperature
		const maxChange = shouldRun ? 0.4 : 0.15;
		const currentTemp = this.smoothTransition(prevTemp, effectiveTarget, maxChange);
		const finalTemp = this.addNoise(currentTemp, 0.2, 1);

		return [
			{
				channelCategory: ChannelCategory.TEMPERATURE,
				propertyCategory: PropertyCategory.TEMPERATURE,
				value: this.clamp(finalTemp, 5, 35),
			},
		];
	}

	/**
	 * Simulate fan (if present)
	 */
	private simulateFan(shouldRun: boolean): SimulatedPropertyValue[] {
		const values: SimulatedPropertyValue[] = [];

		values.push({
			channelCategory: ChannelCategory.FAN,
			propertyCategory: PropertyCategory.ON,
			value: shouldRun,
		});

		if (shouldRun) {
			// Fan speed when heating
			values.push({
				channelCategory: ChannelCategory.FAN,
				propertyCategory: PropertyCategory.SPEED,
				value: Math.round(50 + Math.random() * 30),
			});
		}

		return values;
	}

	/**
	 * Simulate power consumption
	 */
	private simulatePower(
		shouldRun: boolean,
		context: SimulationContext,
		previousValues: Map<string, string | number | boolean> | undefined,
		targetTemp: number,
	): SimulatedPropertyValue[] {
		if (!shouldRun) {
			return [
				{
					channelCategory: ChannelCategory.ELECTRICAL_POWER,
					propertyCategory: PropertyCategory.POWER,
					value: 2, // Standby
				},
			];
		}

		// Get current room temperature
		const roomTemp = this.getPreviousValue(
			previousValues,
			ChannelCategory.TEMPERATURE,
			PropertyCategory.TEMPERATURE,
			18,
		) as number;

		// Power proportional to temperature difference
		const tempDiff = targetTemp - roomTemp;
		const maxPower = 2000; // Max 2kW heater

		let power: number;
		if (tempDiff > 3) {
			// Far from target - full power
			power = maxPower;
		} else if (tempDiff > 0) {
			// Close to target - proportional power
			power = (tempDiff / 3) * maxPower;
		} else {
			// At or above target - minimal power
			power = 100;
		}

		// Add variation
		power = Math.round(power + (Math.random() - 0.5) * 100);

		return [
			{
				channelCategory: ChannelCategory.ELECTRICAL_POWER,
				propertyCategory: PropertyCategory.POWER,
				value: Math.max(0, power),
			},
		];
	}
}

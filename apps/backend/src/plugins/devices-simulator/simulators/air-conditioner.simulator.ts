import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { SimulatorDeviceEntity } from '../entities/devices-simulator.entity';

import { BaseDeviceSimulator, SimulatedPropertyValue } from './device-simulator.interface';
import { SimulationContext } from './simulation-context';

/**
 * AC operating modes
 */
type ACMode = 'auto' | 'cooling' | 'heating' | 'fan_only' | 'dehumidify';

/**
 * Simulator for air conditioner devices
 * Simulates realistic AC behavior including cooling, heating, fan operation.
 */
export class AirConditionerSimulator extends BaseDeviceSimulator {
	getSupportedCategory(): DeviceCategory {
		return DeviceCategory.AIR_CONDITIONER;
	}

	simulate(
		device: SimulatorDeviceEntity,
		context: SimulationContext,
		previousValues?: Map<string, string | number | boolean>,
	): SimulatedPropertyValue[] {
		const values: SimulatedPropertyValue[] = [];

		// Determine if AC should be running based on conditions
		const shouldRun = this.shouldACRun(context);
		const mode = this.determineMode(context);
		const targetTemp = this.determineTargetTemperature(context, mode);

		// Cooler channel
		if (this.hasChannel(device, ChannelCategory.COOLER)) {
			values.push(...this.simulateCooler(context, previousValues, shouldRun, mode, targetTemp));
		}

		// Fan channel
		if (this.hasChannel(device, ChannelCategory.FAN)) {
			values.push(...this.simulateFan(shouldRun, mode, previousValues));
		}

		// Temperature channel (current room temperature)
		if (this.hasChannel(device, ChannelCategory.TEMPERATURE)) {
			values.push(...this.simulateTemperature(context, previousValues, shouldRun, mode, targetTemp));
		}

		// Humidity channel
		if (this.hasChannel(device, ChannelCategory.HUMIDITY)) {
			values.push(...this.simulateHumidity(context, previousValues, shouldRun, mode));
		}

		// Electrical power channel
		if (this.hasChannel(device, ChannelCategory.ELECTRICAL_POWER)) {
			values.push(...this.simulatePower(shouldRun, mode));
		}

		return values;
	}

	/**
	 * Determine if AC should be running based on context
	 */
	private shouldACRun(context: SimulationContext): boolean {
		// AC more likely to run when outdoor temp is extreme
		if (context.season === 'summer' && context.outdoorTemperature > 25) {
			return Math.random() < 0.8;
		}
		if (context.season === 'winter' && context.outdoorTemperature < 10) {
			return Math.random() < 0.7;
		}
		// Moderate seasons - less need
		return Math.random() < 0.3;
	}

	/**
	 * Determine operating mode based on conditions
	 */
	private determineMode(context: SimulationContext): ACMode {
		if (context.season === 'summer' || context.outdoorTemperature > 25) {
			return 'cooling';
		}
		if (context.season === 'winter' || context.outdoorTemperature < 15) {
			return 'heating';
		}
		// Spring/autumn - auto mode
		return 'auto';
	}

	/**
	 * Determine target temperature based on mode and time
	 */
	private determineTargetTemperature(context: SimulationContext, mode: ACMode): number {
		const hour = context.hour;

		// Base target temperatures
		let target: number;
		if (mode === 'cooling') {
			target = 24; // Cooling target
		} else if (mode === 'heating') {
			target = 21; // Heating target
		} else {
			target = 22; // Auto mode
		}

		// Adjust for time of day
		if (hour >= 23 || hour < 6) {
			// Night - slightly cooler for sleeping
			target -= 1;
		} else if (hour >= 6 && hour < 9) {
			// Morning - slightly warmer
			target += 0.5;
		}

		return target;
	}

	/**
	 * Simulate cooler channel (main AC control)
	 */
	private simulateCooler(
		context: SimulationContext,
		previousValues: Map<string, string | number | boolean> | undefined,
		shouldRun: boolean,
		mode: ACMode,
		targetTemp: number,
	): SimulatedPropertyValue[] {
		const values: SimulatedPropertyValue[] = [];

		// On state
		values.push({
			channelCategory: ChannelCategory.COOLER,
			propertyCategory: PropertyCategory.ON,
			value: shouldRun,
		});

		// Active state (actually cooling/heating)
		values.push({
			channelCategory: ChannelCategory.COOLER,
			propertyCategory: PropertyCategory.ACTIVE,
			value: shouldRun,
		});

		// Mode
		values.push({
			channelCategory: ChannelCategory.COOLER,
			propertyCategory: PropertyCategory.MODE,
			value: mode,
		});

		// Target temperature
		values.push({
			channelCategory: ChannelCategory.COOLER,
			propertyCategory: PropertyCategory.TEMPERATURE,
			value: targetTemp,
		});

		return values;
	}

	/**
	 * Simulate fan operation
	 */
	private simulateFan(
		shouldRun: boolean,
		mode: ACMode,
		_previousValues?: Map<string, string | number | boolean>,
	): SimulatedPropertyValue[] {
		const values: SimulatedPropertyValue[] = [];

		// Fan on when AC running
		values.push({
			channelCategory: ChannelCategory.FAN,
			propertyCategory: PropertyCategory.ON,
			value: shouldRun,
		});

		if (!shouldRun) {
			return values;
		}

		// Fan speed based on mode
		let speed: number;
		if (mode === 'cooling' || mode === 'heating') {
			speed = 70; // Higher speed when actively cooling/heating
		} else if (mode === 'dehumidify') {
			speed = 40;
		} else {
			speed = 50;
		}

		// Add some variation
		speed = this.clamp(Math.round(speed + (Math.random() - 0.5) * 20), 0, 100);

		values.push({
			channelCategory: ChannelCategory.FAN,
			propertyCategory: PropertyCategory.SPEED,
			value: speed,
		});

		// Swing mode (oscillation)
		values.push({
			channelCategory: ChannelCategory.FAN,
			propertyCategory: PropertyCategory.SWING,
			value: Math.random() < 0.6, // 60% chance swing is on
		});

		return values;
	}

	/**
	 * Simulate room temperature (affected by AC operation)
	 */
	private simulateTemperature(
		context: SimulationContext,
		previousValues: Map<string, string | number | boolean> | undefined,
		shouldRun: boolean,
		mode: ACMode,
		targetTemp: number,
	): SimulatedPropertyValue[] {
		// Base indoor temperature (influenced by outdoor)
		const outdoorInfluence = shouldRun ? 0.05 : 0.15;
		const baseIndoor = 21 + (context.outdoorTemperature - 21) * outdoorInfluence;

		// If AC running, temperature moves toward target
		let effectiveTarget: number;
		if (shouldRun) {
			effectiveTarget = targetTemp;
		} else {
			// Without AC, temperature drifts toward outdoor
			effectiveTarget = baseIndoor;
		}

		const prevTemp = this.getPreviousValue(
			previousValues,
			ChannelCategory.TEMPERATURE,
			PropertyCategory.MEASURED,
			baseIndoor,
		) as number;

		// AC changes temperature faster than natural drift
		const maxChange = shouldRun ? 0.5 : 0.2;
		const currentTemp = this.smoothTransition(prevTemp, effectiveTarget, maxChange);
		const finalTemp = this.addNoise(currentTemp, 0.2, 1);

		return [
			{
				channelCategory: ChannelCategory.TEMPERATURE,
				propertyCategory: PropertyCategory.MEASURED,
				value: this.clamp(finalTemp, 10, 40),
			},
		];
	}

	/**
	 * Simulate humidity (affected by AC operation)
	 */
	private simulateHumidity(
		context: SimulationContext,
		previousValues: Map<string, string | number | boolean> | undefined,
		shouldRun: boolean,
		mode: ACMode,
	): SimulatedPropertyValue[] {
		// AC typically reduces humidity, especially in cooling/dehumidify mode
		let targetHumidity: number;

		if (shouldRun && (mode === 'cooling' || mode === 'dehumidify')) {
			targetHumidity = 40; // AC removes moisture
		} else {
			// Natural indoor humidity
			targetHumidity = context.outdoorHumidity * 0.8; // Indoor slightly lower
		}

		const prevHumidity = this.getPreviousValue(
			previousValues,
			ChannelCategory.HUMIDITY,
			PropertyCategory.MEASURED,
			targetHumidity,
		) as number;

		const currentHumidity = this.smoothTransition(prevHumidity, targetHumidity, 2);
		const finalHumidity = this.addNoise(currentHumidity, 3, 0);

		return [
			{
				channelCategory: ChannelCategory.HUMIDITY,
				propertyCategory: PropertyCategory.MEASURED,
				value: this.clamp(Math.round(finalHumidity), 20, 90),
			},
		];
	}

	/**
	 * Simulate power consumption
	 */
	private simulatePower(shouldRun: boolean, mode: ACMode): SimulatedPropertyValue[] {
		if (!shouldRun) {
			return [
				{
					channelCategory: ChannelCategory.ELECTRICAL_POWER,
					propertyCategory: PropertyCategory.POWER,
					value: 5, // Standby power
				},
			];
		}

		// Power consumption based on mode
		let basePower: number;
		switch (mode) {
			case 'cooling':
				basePower = 1500; // Watts
				break;
			case 'heating':
				basePower = 1800;
				break;
			case 'dehumidify':
				basePower = 800;
				break;
			case 'fan_only':
				basePower = 100;
				break;
			default:
				basePower = 1200;
		}

		// Add variation
		const power = Math.round(basePower + (Math.random() - 0.5) * 200);

		return [
			{
				channelCategory: ChannelCategory.ELECTRICAL_POWER,
				propertyCategory: PropertyCategory.POWER,
				value: power,
			},
		];
	}
}

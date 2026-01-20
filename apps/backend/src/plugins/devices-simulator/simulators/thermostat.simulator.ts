import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { SimulatorDeviceEntity } from '../entities/devices-simulator.entity';

import { BaseDeviceSimulator, SimulatedPropertyValue } from './device-simulator.interface';
import { SimulationContext } from './simulation-context';

/**
 * Thermostat modes (internal simulation state)
 */
type ThermostatMode = 'off' | 'heat' | 'cool' | 'auto';

/**
 * Simulator for thermostat devices
 * Simulates realistic thermostat behavior with scheduling and temperature control.
 */
export class ThermostatSimulator extends BaseDeviceSimulator {
	getSupportedCategory(): DeviceCategory {
		return DeviceCategory.THERMOSTAT;
	}

	simulate(
		device: SimulatorDeviceEntity,
		context: SimulationContext,
		previousValues?: Map<string, string | number | boolean>,
	): SimulatedPropertyValue[] {
		const values: SimulatedPropertyValue[] = [];

		const mode = this.determineMode(context);
		const targetTemp = this.determineTargetTemperature(context, mode);
		const isActive = this.shouldBeActive(context, previousValues, targetTemp);

		// Thermostat channel
		if (this.hasChannel(device, ChannelCategory.THERMOSTAT)) {
			values.push(...this.simulateThermostat());
		}

		// Heater channel - controls heating mode
		if (this.hasChannel(device, ChannelCategory.HEATER)) {
			values.push(...this.simulateHeater(mode, targetTemp, isActive));
		}

		// Cooler channel - controls cooling mode
		if (this.hasChannel(device, ChannelCategory.COOLER)) {
			values.push(...this.simulateCooler(mode, targetTemp, isActive));
		}

		// Temperature channel (current reading)
		if (this.hasChannel(device, ChannelCategory.TEMPERATURE)) {
			values.push(...this.simulateTemperature(context, previousValues, isActive, mode, targetTemp));
		}

		// Humidity channel
		if (this.hasChannel(device, ChannelCategory.HUMIDITY)) {
			values.push(...this.simulateHumidity(context, previousValues));
		}

		return values;
	}

	/**
	 * Determine thermostat mode based on season (internal simulation state)
	 */
	private determineMode(context: SimulationContext): ThermostatMode {
		switch (context.season) {
			case 'winter':
				return 'heat';
			case 'summer':
				return 'cool';
			default:
				return 'auto';
		}
	}

	/**
	 * Determine target temperature based on time and mode
	 * Implements typical schedule: lower at night, higher during occupied hours
	 */
	private determineTargetTemperature(context: SimulationContext, mode: ThermostatMode): number {
		const hour = context.hour;

		// Typical thermostat schedule
		interface SchedulePoint {
			heat: number;
			cool: number;
		}

		let schedule: SchedulePoint;

		if (hour >= 23 || hour < 6) {
			// Night setback
			schedule = { heat: 17, cool: 26 };
		} else if (hour >= 6 && hour < 8) {
			// Morning warm-up
			schedule = { heat: 20, cool: 24 };
		} else if (hour >= 8 && hour < 17) {
			// Daytime (may be away)
			schedule = { heat: 19, cool: 25 };
		} else if (hour >= 17 && hour < 23) {
			// Evening comfort
			schedule = { heat: 21, cool: 23 };
		} else {
			schedule = { heat: 20, cool: 24 };
		}

		// Return appropriate target based on mode
		switch (mode) {
			case 'heat':
				return schedule.heat;
			case 'cool':
				return schedule.cool;
			case 'auto':
				// In auto, aim for comfortable middle
				return (schedule.heat + schedule.cool) / 2;
			default:
				return 20;
		}
	}

	/**
	 * Determine if heating/cooling should be active
	 */
	private shouldBeActive(
		context: SimulationContext,
		previousValues: Map<string, string | number | boolean> | undefined,
		targetTemp: number,
	): boolean {
		const currentTemp = this.getPreviousValue(
			previousValues,
			ChannelCategory.TEMPERATURE,
			PropertyCategory.MEASURED,
			20,
		) as number;

		const mode = this.determineMode(context);

		// Hysteresis: don't cycle on/off at exact target
		const hysteresis = 0.5;

		if (mode === 'heat') {
			return currentTemp < targetTemp - hysteresis;
		} else if (mode === 'cool') {
			return currentTemp > targetTemp + hysteresis;
		} else {
			// Auto mode
			if (currentTemp < targetTemp - hysteresis) {
				return true; // Heat
			}
			if (currentTemp > targetTemp + hysteresis) {
				return true; // Cool
			}
			return false;
		}
	}

	/**
	 * Simulate thermostat channel
	 * Only outputs the locked property (the only remaining property in thermostat channel)
	 */
	private simulateThermostat(): SimulatedPropertyValue[] {
		// Note: The thermostat channel now only has the "locked" property
		// Temperature setpoints are managed via heater/cooler channels
		// Mode/active state is derived from heater/cooler ON states
		return [];
	}

	/**
	 * Simulate heater channel
	 * Controls heating mode - ON when mode is 'heat' or 'auto'
	 */
	private simulateHeater(mode: ThermostatMode, targetTemp: number, isActive: boolean): SimulatedPropertyValue[] {
		const values: SimulatedPropertyValue[] = [];

		// Heater is ON when mode is heat or auto
		const heaterOn = mode === 'heat' || mode === 'auto';

		values.push({
			channelCategory: ChannelCategory.HEATER,
			propertyCategory: PropertyCategory.ON,
			value: heaterOn,
		});

		// Heater status (actively heating)
		values.push({
			channelCategory: ChannelCategory.HEATER,
			propertyCategory: PropertyCategory.STATUS,
			value: heaterOn && isActive && (mode === 'heat' || mode === 'auto'),
		});

		// Heating setpoint temperature
		values.push({
			channelCategory: ChannelCategory.HEATER,
			propertyCategory: PropertyCategory.TEMPERATURE,
			value: mode === 'cool' ? targetTemp - 3 : targetTemp,
		});

		return values;
	}

	/**
	 * Simulate cooler channel
	 * Controls cooling mode - ON when mode is 'cool' or 'auto'
	 */
	private simulateCooler(mode: ThermostatMode, targetTemp: number, isActive: boolean): SimulatedPropertyValue[] {
		const values: SimulatedPropertyValue[] = [];

		// Cooler is ON when mode is cool or auto
		const coolerOn = mode === 'cool' || mode === 'auto';

		values.push({
			channelCategory: ChannelCategory.COOLER,
			propertyCategory: PropertyCategory.ON,
			value: coolerOn,
		});

		// Cooler status (actively cooling)
		values.push({
			channelCategory: ChannelCategory.COOLER,
			propertyCategory: PropertyCategory.STATUS,
			value: coolerOn && isActive && (mode === 'cool' || mode === 'auto'),
		});

		// Cooling setpoint temperature
		values.push({
			channelCategory: ChannelCategory.COOLER,
			propertyCategory: PropertyCategory.TEMPERATURE,
			value: mode === 'heat' ? targetTemp + 3 : targetTemp,
		});

		return values;
	}

	/**
	 * Simulate temperature reading
	 */
	private simulateTemperature(
		context: SimulationContext,
		previousValues: Map<string, string | number | boolean> | undefined,
		isActive: boolean,
		mode: ThermostatMode,
		targetTemp: number,
	): SimulatedPropertyValue[] {
		// Base temperature influenced by outdoor
		const outdoorInfluence = isActive ? 0.05 : 0.15;
		const baseIndoor = 20 + (context.outdoorTemperature - 20) * outdoorInfluence;

		const prevTemp = this.getPreviousValue(
			previousValues,
			ChannelCategory.TEMPERATURE,
			PropertyCategory.MEASURED,
			baseIndoor,
		) as number;

		let effectiveTarget: number;
		if (isActive) {
			effectiveTarget = targetTemp;
		} else {
			// Drift toward natural temperature
			effectiveTarget = baseIndoor;
		}

		// Temperature changes based on active state
		const maxChange = isActive ? 0.3 : 0.1;
		const currentTemp = this.smoothTransition(prevTemp, effectiveTarget, maxChange);
		const finalTemp = this.addNoise(currentTemp, 0.15, 1);

		return [
			{
				channelCategory: ChannelCategory.TEMPERATURE,
				propertyCategory: PropertyCategory.MEASURED,
				value: this.clamp(finalTemp, 5, 40),
			},
		];
	}

	/**
	 * Simulate humidity reading
	 */
	private simulateHumidity(
		context: SimulationContext,
		previousValues: Map<string, string | number | boolean> | undefined,
	): SimulatedPropertyValue[] {
		// Indoor humidity target based on season
		const targetHumidity = {
			winter: 35, // Dry from heating
			spring: 45,
			summer: 50,
			autumn: 45,
		};

		const target = targetHumidity[context.season];

		const prevHumidity = this.getPreviousValue(
			previousValues,
			ChannelCategory.HUMIDITY,
			PropertyCategory.MEASURED,
			target,
		) as number;

		const currentHumidity = this.smoothTransition(prevHumidity, target, 1.5);
		const finalHumidity = this.addNoise(currentHumidity, 2, 0);

		return [
			{
				channelCategory: ChannelCategory.HUMIDITY,
				propertyCategory: PropertyCategory.MEASURED,
				value: this.clamp(Math.round(finalHumidity), 15, 85),
			},
		];
	}
}

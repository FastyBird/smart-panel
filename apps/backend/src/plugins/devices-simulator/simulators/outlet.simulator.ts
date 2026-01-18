import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { SimulatorDeviceEntity } from '../entities/devices-simulator.entity';

import { BaseDeviceSimulator, SimulatedPropertyValue } from './device-simulator.interface';
import { SimulationContext } from './simulation-context';

/**
 * Simulator for smart outlet/plug devices
 * Simulates realistic outlet behavior with power monitoring.
 */
export class OutletSimulator extends BaseDeviceSimulator {
	getSupportedCategory(): DeviceCategory {
		return DeviceCategory.OUTLET;
	}

	simulate(
		device: SimulatorDeviceEntity,
		context: SimulationContext,
		previousValues?: Map<string, string | number | boolean>,
	): SimulatedPropertyValue[] {
		const values: SimulatedPropertyValue[] = [];

		// Determine if outlet should be on
		const isOn = this.shouldBeOn(context);

		// Outlet channel
		if (this.hasChannel(device, ChannelCategory.OUTLET)) {
			values.push(...this.simulateOutlet(isOn));
		}

		// Electrical power channel
		if (this.hasChannel(device, ChannelCategory.ELECTRICAL_POWER)) {
			values.push(...this.simulatePower(isOn, previousValues));
		}

		// Electrical energy channel (consumption tracking)
		if (this.hasChannel(device, ChannelCategory.ELECTRICAL_ENERGY)) {
			values.push(...this.simulateEnergy(isOn, previousValues));
		}

		return values;
	}

	/**
	 * Determine if outlet should be on based on time
	 */
	private shouldBeOn(context: SimulationContext): boolean {
		const hour = context.hour;

		// Different probability based on time
		if (hour >= 7 && hour <= 23) {
			// Active hours - likely on
			return Math.random() < 0.7;
		} else {
			// Night - lower probability
			return Math.random() < 0.3;
		}
	}

	/**
	 * Simulate outlet channel
	 */
	private simulateOutlet(isOn: boolean): SimulatedPropertyValue[] {
		const values: SimulatedPropertyValue[] = [];

		values.push({
			channelCategory: ChannelCategory.OUTLET,
			propertyCategory: PropertyCategory.ON,
			value: isOn,
		});

		// In use status (something is plugged in and drawing power)
		values.push({
			channelCategory: ChannelCategory.OUTLET,
			propertyCategory: PropertyCategory.IN_USE,
			value: isOn && Math.random() < 0.9, // 90% chance in use when on
		});

		return values;
	}

	/**
	 * Simulate power consumption
	 */
	private simulatePower(
		isOn: boolean,
		_previousValues?: Map<string, string | number | boolean>,
	): SimulatedPropertyValue[] {
		const values: SimulatedPropertyValue[] = [];

		if (!isOn) {
			values.push({
				channelCategory: ChannelCategory.ELECTRICAL_POWER,
				propertyCategory: PropertyCategory.POWER,
				value: 0,
			});
			return values;
		}

		// Simulate various appliance power draws
		// Common ranges: LED bulb (10W), Fan (50W), TV (100W), Computer (200W), Heater (1500W)
		const appliances = [
			{ power: 10, weight: 0.3 }, // LED bulb
			{ power: 50, weight: 0.2 }, // Fan
			{ power: 100, weight: 0.2 }, // TV
			{ power: 200, weight: 0.15 }, // Computer
			{ power: 500, weight: 0.1 }, // Medium appliance
			{ power: 1000, weight: 0.05 }, // High power appliance
		];

		// Pick a random appliance type (weighted)
		const rand = Math.random();
		let cumWeight = 0;
		let basePower = 100;

		for (const appliance of appliances) {
			cumWeight += appliance.weight;
			if (rand <= cumWeight) {
				basePower = appliance.power;
				break;
			}
		}

		// Add variation
		const power = Math.round(basePower + (Math.random() - 0.5) * basePower * 0.2);

		values.push({
			channelCategory: ChannelCategory.ELECTRICAL_POWER,
			propertyCategory: PropertyCategory.POWER,
			value: Math.max(0, power),
		});

		// Voltage (typically 110V or 220V depending on region)
		values.push({
			channelCategory: ChannelCategory.ELECTRICAL_POWER,
			propertyCategory: PropertyCategory.VOLTAGE,
			value: Math.round(230 + (Math.random() - 0.5) * 10), // ~230V Europe
		});

		// Current (I = P/V)
		const voltage = 230;
		const current = power / voltage;
		values.push({
			channelCategory: ChannelCategory.ELECTRICAL_POWER,
			propertyCategory: PropertyCategory.CURRENT,
			value: Math.round(current * 100) / 100,
		});

		return values;
	}

	/**
	 * Simulate energy consumption (cumulative)
	 */
	private simulateEnergy(
		isOn: boolean,
		previousValues?: Map<string, string | number | boolean>,
	): SimulatedPropertyValue[] {
		const prevEnergy = this.getPreviousValue(
			previousValues,
			ChannelCategory.ELECTRICAL_ENERGY,
			PropertyCategory.CONSUMPTION,
			0,
		) as number;

		// Add energy based on power and time (assume 5 second update interval)
		let energyIncrement = 0;
		if (isOn) {
			// Random power between 50-200W, converted to kWh for 5 seconds
			const avgPower = 100 + Math.random() * 100;
			energyIncrement = (avgPower * 5) / 3600000; // W to kWh for 5 seconds
		}

		const newEnergy = Math.round((prevEnergy + energyIncrement) * 1000) / 1000;

		return [
			{
				channelCategory: ChannelCategory.ELECTRICAL_ENERGY,
				propertyCategory: PropertyCategory.CONSUMPTION,
				value: newEnergy,
			},
		];
	}
}

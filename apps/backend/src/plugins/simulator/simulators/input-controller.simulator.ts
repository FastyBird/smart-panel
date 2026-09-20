import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { SimulatorDeviceEntity } from '../entities/simulator.entity';

import { BaseDeviceSimulator, SimulatedPropertyValue } from './device-simulator.interface';
import { SimulationContext } from './simulation-context';

/**
 * Simulator for input controller devices (e.g. multi-button wall remotes, input modules)
 * Simulates button detected state, binary input state transitions, analog readings, and battery levels.
 */
export class InputControllerSimulator extends BaseDeviceSimulator {
	private rawBatteryValues: Map<string, number> = new Map();

	getSupportedCategory(): DeviceCategory {
		return DeviceCategory.INPUT_CONTROLLER;
	}

	simulate(
		device: SimulatorDeviceEntity,
		context: SimulationContext,
		previousValues?: Map<string, string | number | boolean>,
	): SimulatedPropertyValue[] {
		const values: SimulatedPropertyValue[] = [];

		values.push(...this.simulateInputChannels(device, context, previousValues));

		if (this.hasChannel(device, ChannelCategory.BATTERY)) {
			values.push(...this.simulateBattery(device.id, previousValues));
		}

		return values;
	}

	/**
	 * Simulate battery drain over time
	 */
	private simulateBattery(
		deviceId: string,
		previousValues?: Map<string, string | number | boolean>,
	): SimulatedPropertyValue[] {
		let rawBattery = this.rawBatteryValues.get(deviceId);
		if (rawBattery === undefined) {
			rawBattery = this.getPreviousValue(
				previousValues,
				ChannelCategory.BATTERY,
				PropertyCategory.PERCENTAGE,
				100,
			) as number;
		}

		const decrease = Math.random() * 0.02 + 0.005;
		rawBattery -= decrease;

		if (rawBattery < 10) {
			rawBattery = 100;
		}

		this.rawBatteryValues.set(deviceId, rawBattery);

		const rounded = Math.round(rawBattery);
		const values: SimulatedPropertyValue[] = [
			{
				channelCategory: ChannelCategory.BATTERY,
				propertyCategory: PropertyCategory.PERCENTAGE,
				value: rounded,
			},
		];

		let status = 'normal';
		if (rounded <= 15) {
			status = 'critical';
		} else if (rounded <= 25) {
			status = 'low';
		}

		values.push({
			channelCategory: ChannelCategory.BATTERY,
			propertyCategory: PropertyCategory.STATUS,
			value: status,
		});

		return values;
	}
}

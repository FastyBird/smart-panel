import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { SimulatorDeviceEntity } from '../entities/devices-simulator.entity';

import {
	BaseDeviceBehavior,
	DeviceBehaviorState,
	PropertyChangeEvent,
	ScheduledPropertyUpdate,
} from './device-behavior.interface';

/**
 * Realistic thermostat behavior.
 *
 * When a user sets a target temperature (via heater/cooler channels), the current
 * temperature gradually approaches the target over time, simulating real HVAC physics.
 *
 * - Heating rate: ~0.5°C per minute (30s tick = ~0.25°C per tick)
 * - Cooling rate: ~0.3°C per minute
 * - Overshoots target slightly before settling
 * - Activates/deactivates heater/cooler status based on convergence
 */
export class ThermostatRealisticBehavior extends BaseDeviceBehavior {
	private static readonly HEAT_RATE_PER_MINUTE = 0.5;
	private static readonly COOL_RATE_PER_MINUTE = 0.3;
	private static readonly OVERSHOOT = 0.3;
	private static readonly SETTLING_THRESHOLD = 0.2;

	getType(): string {
		return 'thermostat-realistic';
	}

	getSupportedCategory(): DeviceCategory {
		return DeviceCategory.THERMOSTAT;
	}

	onPropertyChanged(
		device: SimulatorDeviceEntity,
		event: PropertyChangeEvent,
		state: DeviceBehaviorState,
	): ScheduledPropertyUpdate[] {
		const updates: ScheduledPropertyUpdate[] = [];

		// React to target temperature changes on heater or cooler channels
		if (
			event.propertyCategory === PropertyCategory.TEMPERATURE &&
			(event.channelCategory === ChannelCategory.HEATER || event.channelCategory === ChannelCategory.COOLER)
		) {
			const targetTemp = event.value as number;
			const currentTemp = (this.getStateValue(state, 'currentTemp', 20) as number);
			const diff = Math.abs(targetTemp - currentTemp);

			if (diff < ThermostatRealisticBehavior.SETTLING_THRESHOLD) {
				return updates;
			}

			const isHeating = targetTemp > currentTemp;
			const ratePerMinute = isHeating
				? ThermostatRealisticBehavior.HEAT_RATE_PER_MINUTE
				: ThermostatRealisticBehavior.COOL_RATE_PER_MINUTE;

			// Calculate duration for the temperature to reach target
			const durationMinutes = diff / ratePerMinute;
			const durationMs = Math.round(durationMinutes * 60 * 1000);

			// Store the target in state for tick processing
			this.setStateValue(state, 'targetTemp', targetTemp);
			this.setStateValue(state, 'isHeating', isHeating);

			// Cancel any existing temperature transitions
			this.cancelTransitions(state, ChannelCategory.TEMPERATURE, PropertyCategory.TEMPERATURE);

			// Schedule gradual temperature change
			updates.push({
				channelCategory: ChannelCategory.TEMPERATURE,
				propertyCategory: PropertyCategory.TEMPERATURE,
				targetValue: targetTemp,
				startValue: currentTemp,
				delayMs: 0,
				durationMs,
			});

			// Immediately activate the heater/cooler status
			if (isHeating && this.hasChannel(device, ChannelCategory.HEATER)) {
				this.cancelTransitions(state, ChannelCategory.HEATER, PropertyCategory.STATUS);
				updates.push({
					channelCategory: ChannelCategory.HEATER,
					propertyCategory: PropertyCategory.STATUS,
					targetValue: true,
					delayMs: 0,
					durationMs: 0,
				});
				// Schedule deactivation when target is reached
				updates.push({
					channelCategory: ChannelCategory.HEATER,
					propertyCategory: PropertyCategory.STATUS,
					targetValue: false,
					delayMs: durationMs,
					durationMs: 0,
				});
			}

			if (!isHeating && this.hasChannel(device, ChannelCategory.COOLER)) {
				this.cancelTransitions(state, ChannelCategory.COOLER, PropertyCategory.STATUS);
				updates.push({
					channelCategory: ChannelCategory.COOLER,
					propertyCategory: PropertyCategory.STATUS,
					targetValue: true,
					delayMs: 0,
					durationMs: 0,
				});
				updates.push({
					channelCategory: ChannelCategory.COOLER,
					propertyCategory: PropertyCategory.STATUS,
					targetValue: false,
					delayMs: durationMs,
					durationMs: 0,
				});
			}
		}

		// React to heater/cooler on/off toggle
		if (
			event.propertyCategory === PropertyCategory.ON &&
			(event.channelCategory === ChannelCategory.HEATER || event.channelCategory === ChannelCategory.COOLER)
		) {
			const isOn = event.value === true;

			if (!isOn) {
				// Turned off - cancel all temperature transitions and deactivate status
				this.cancelTransitions(state, ChannelCategory.TEMPERATURE, PropertyCategory.TEMPERATURE);
				this.cancelTransitions(state, event.channelCategory, PropertyCategory.STATUS);

				updates.push({
					channelCategory: event.channelCategory,
					propertyCategory: PropertyCategory.STATUS,
					targetValue: false,
					delayMs: 0,
					durationMs: 0,
				});
			}
		}

		return updates;
	}

	override tick(
		device: SimulatorDeviceEntity,
		state: DeviceBehaviorState,
		now: number,
	): import('./device-behavior.interface').BehaviorTickResult[] {
		const results = super.tick(device, state, now);

		// Track current temperature in state from tick results
		for (const result of results) {
			if (
				result.channelCategory === ChannelCategory.TEMPERATURE &&
				result.propertyCategory === PropertyCategory.TEMPERATURE
			) {
				this.setStateValue(state, 'currentTemp', result.value);
			}
		}

		return results;
	}
}

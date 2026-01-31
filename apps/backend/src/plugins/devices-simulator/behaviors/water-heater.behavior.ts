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
 * Realistic water heater behavior.
 *
 * Simulates real water heater physics:
 * - Water temperature rises slowly (~1°C per minute when heating)
 * - Temperature drops slowly when idle (~0.2°C per minute)
 * - Heater status reflects active heating state
 * - Power consumption tracked during active heating
 */
export class WaterHeaterRealisticBehavior extends BaseDeviceBehavior {
	private static readonly HEAT_RATE_PER_MINUTE = 1.0;
	private static readonly COOL_RATE_PER_MINUTE = 0.2;
	private static readonly SETTLING_THRESHOLD = 0.5;
	private static readonly HEATER_POWER_WATTS = 2000;

	getType(): string {
		return 'water-heater-realistic';
	}

	getSupportedCategory(): DeviceCategory {
		return DeviceCategory.WATER_HEATER;
	}

	onPropertyChanged(
		device: SimulatorDeviceEntity,
		event: PropertyChangeEvent,
		state: DeviceBehaviorState,
	): ScheduledPropertyUpdate[] {
		const updates: ScheduledPropertyUpdate[] = [];

		// React to heater target temperature
		if (event.channelCategory === ChannelCategory.HEATER) {
			if (event.propertyCategory === PropertyCategory.TEMPERATURE) {
				const targetTemp = event.value as number;
				this.setStateValue(state, 'targetTemp', targetTemp);
				this.scheduleHeating(device, state, updates);
			}

			if (event.propertyCategory === PropertyCategory.ON) {
				const isOn = event.value === true;
				this.setStateValue(state, 'heaterOn', isOn);

				if (!isOn) {
					this.cancelTransitions(state, ChannelCategory.TEMPERATURE, PropertyCategory.TEMPERATURE);
					this.cancelTransitions(state, ChannelCategory.HEATER, PropertyCategory.STATUS);

					updates.push({
						channelCategory: ChannelCategory.HEATER,
						propertyCategory: PropertyCategory.STATUS,
						targetValue: false,
						delayMs: 0,
						durationMs: 0,
					});
				} else {
					this.scheduleHeating(device, state, updates);
				}
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

		for (const result of results) {
			if (
				result.channelCategory === ChannelCategory.TEMPERATURE &&
				result.propertyCategory === PropertyCategory.TEMPERATURE
			) {
				this.setStateValue(state, 'currentTemp', result.value);
			}
		}

		// Report power consumption while heating
		const isHeating = state.activeUpdates.some(
			(u) =>
				u.channelCategory === ChannelCategory.TEMPERATURE &&
				u.propertyCategory === PropertyCategory.TEMPERATURE,
		);

		if (isHeating && this.hasChannel(device, ChannelCategory.ELECTRICAL_POWER)) {
			results.push({
				channelCategory: ChannelCategory.ELECTRICAL_POWER,
				propertyCategory: PropertyCategory.POWER,
				value: WaterHeaterRealisticBehavior.HEATER_POWER_WATTS,
			});
		} else if (!isHeating && this.hasChannel(device, ChannelCategory.ELECTRICAL_POWER)) {
			results.push({
				channelCategory: ChannelCategory.ELECTRICAL_POWER,
				propertyCategory: PropertyCategory.POWER,
				value: 0,
			});
		}

		return results;
	}

	private scheduleHeating(
		device: SimulatorDeviceEntity,
		state: DeviceBehaviorState,
		updates: ScheduledPropertyUpdate[],
	): void {
		const heaterOn = this.getStateValue(state, 'heaterOn', false) as boolean;
		if (!heaterOn) return;

		const targetTemp = this.getStateValue(state, 'targetTemp', 50) as number;
		const currentTemp = this.getStateValue(state, 'currentTemp', 20) as number;
		const diff = targetTemp - currentTemp;

		if (Math.abs(diff) < WaterHeaterRealisticBehavior.SETTLING_THRESHOLD) {
			return;
		}

		const isHeating = diff > 0;
		const rate = isHeating
			? WaterHeaterRealisticBehavior.HEAT_RATE_PER_MINUTE
			: WaterHeaterRealisticBehavior.COOL_RATE_PER_MINUTE;
		const durationMs = Math.round((Math.abs(diff) / rate) * 60 * 1000);

		this.cancelTransitions(state, ChannelCategory.TEMPERATURE, PropertyCategory.TEMPERATURE);

		if (this.hasChannel(device, ChannelCategory.TEMPERATURE)) {
			updates.push({
				channelCategory: ChannelCategory.TEMPERATURE,
				propertyCategory: PropertyCategory.TEMPERATURE,
				targetValue: targetTemp,
				startValue: currentTemp,
				delayMs: 0,
				durationMs,
			});
		}

		// Activate heater status
		this.cancelTransitions(state, ChannelCategory.HEATER, PropertyCategory.STATUS);
		updates.push({
			channelCategory: ChannelCategory.HEATER,
			propertyCategory: PropertyCategory.STATUS,
			targetValue: true,
			delayMs: 0,
			durationMs: 0,
		});

		// Deactivate when done
		updates.push({
			channelCategory: ChannelCategory.HEATER,
			propertyCategory: PropertyCategory.STATUS,
			targetValue: false,
			delayMs: durationMs,
			durationMs: 0,
		});
	}
}

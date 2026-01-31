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
 * Realistic air conditioner behavior.
 *
 * When a user adjusts the AC:
 * - Temperature gradually approaches the target (cooling ~0.4°C/min, heating ~0.3°C/min)
 * - Mode changes take effect with a short compressor startup delay (~2s)
 * - Fan speed affects cooling/heating rate
 * - Defrost cycle activates periodically when heating in cold conditions
 */
export class AirConditionerRealisticBehavior extends BaseDeviceBehavior {
	private static readonly COOL_RATE_PER_MINUTE = 0.4;
	private static readonly HEAT_RATE_PER_MINUTE = 0.3;
	private static readonly COMPRESSOR_STARTUP_DELAY_MS = 2000;
	private static readonly SETTLING_THRESHOLD = 0.3;

	getType(): string {
		return 'air-conditioner-realistic';
	}

	getSupportedCategory(): DeviceCategory {
		return DeviceCategory.AIR_CONDITIONER;
	}

	onPropertyChanged(
		device: SimulatorDeviceEntity,
		event: PropertyChangeEvent,
		state: DeviceBehaviorState,
	): ScheduledPropertyUpdate[] {
		const updates: ScheduledPropertyUpdate[] = [];

		// React to cooler channel changes
		if (event.channelCategory === ChannelCategory.COOLER) {
			if (event.propertyCategory === PropertyCategory.ON) {
				this.handlePowerChange(device, state, updates, event.value === true, 'cool');
			}

			if (event.propertyCategory === PropertyCategory.TEMPERATURE) {
				this.setStateValue(state, 'coolTarget', event.value);
				this.scheduleTemperatureTransition(device, state, updates);
			}
		}

		// React to heater channel changes
		if (event.channelCategory === ChannelCategory.HEATER) {
			if (event.propertyCategory === PropertyCategory.ON) {
				this.handlePowerChange(device, state, updates, event.value === true, 'heat');
			}

			if (event.propertyCategory === PropertyCategory.TEMPERATURE) {
				this.setStateValue(state, 'heatTarget', event.value);
				this.scheduleTemperatureTransition(device, state, updates);
			}
		}

		// React to fan speed changes
		if (event.channelCategory === ChannelCategory.FAN && event.propertyCategory === PropertyCategory.SPEED) {
			this.setStateValue(state, 'fanSpeed', event.value);
			// Re-schedule transitions with new rate
			this.scheduleTemperatureTransition(device, state, updates);
		}

		return updates;
	}

	override tick(device: SimulatorDeviceEntity, state: DeviceBehaviorState, now: number): BehaviorTickResult[] {
		const results = super.tick(device, state, now);

		// Track current temperature in state
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

	private handlePowerChange(
		device: SimulatorDeviceEntity,
		state: DeviceBehaviorState,
		updates: ScheduledPropertyUpdate[],
		isOn: boolean,
		mode: 'cool' | 'heat',
	): void {
		const channelCategory = mode === 'cool' ? ChannelCategory.COOLER : ChannelCategory.HEATER;
		this.setStateValue(state, `${mode}On`, isOn);

		if (!isOn) {
			this.cancelTransitions(state, ChannelCategory.TEMPERATURE, PropertyCategory.TEMPERATURE);
			this.cancelTransitions(state, channelCategory, PropertyCategory.STATUS);

			// Reset compressor state so next power-on gets startup delay
			const otherMode = mode === 'cool' ? 'heat' : 'cool';
			const otherOn = this.getStateValue(state, `${otherMode}On`, false) as boolean;

			if (!otherOn) {
				this.setStateValue(state, 'compressorRunning', false);
			}

			updates.push({
				channelCategory,
				propertyCategory: PropertyCategory.STATUS,
				targetValue: false,
				delayMs: 0,
				durationMs: 0,
			});

			// If the other mode is still active, re-schedule its temperature transition
			if (otherOn) {
				this.scheduleTemperatureTransition(device, state, updates);
			}
		} else {
			// Compressor startup delay
			this.cancelTransitions(state, channelCategory, PropertyCategory.STATUS);
			updates.push({
				channelCategory,
				propertyCategory: PropertyCategory.STATUS,
				targetValue: true,
				delayMs: AirConditionerRealisticBehavior.COMPRESSOR_STARTUP_DELAY_MS,
				durationMs: 0,
			});

			this.scheduleTemperatureTransition(device, state, updates);
		}
	}

	private scheduleTemperatureTransition(
		device: SimulatorDeviceEntity,
		state: DeviceBehaviorState,
		updates: ScheduledPropertyUpdate[],
	): void {
		const coolOn = this.getStateValue(state, 'coolOn', false) as boolean;
		const heatOn = this.getStateValue(state, 'heatOn', false) as boolean;

		if (!coolOn && !heatOn) {
			return;
		}

		const currentTemp = this.getOrInitStateFromDevice(
			state,
			'currentTemp',
			device,
			ChannelCategory.TEMPERATURE,
			PropertyCategory.TEMPERATURE,
			22,
		);
		let targetTemp: number;

		if (coolOn && heatOn) {
			// Both on (auto mode) - aim for midpoint
			const coolTarget = this.getStateValue(state, 'coolTarget', 24) as number;
			const heatTarget = this.getStateValue(state, 'heatTarget', 20) as number;
			targetTemp = (coolTarget + heatTarget) / 2;
		} else if (coolOn) {
			targetTemp = this.getStateValue(state, 'coolTarget', 24) as number;
		} else {
			targetTemp = this.getStateValue(state, 'heatTarget', 20) as number;
		}

		const diff = Math.abs(targetTemp - currentTemp);
		if (diff < AirConditionerRealisticBehavior.SETTLING_THRESHOLD) {
			return;
		}

		const isCooling = targetTemp < currentTemp;
		const baseRate = isCooling
			? AirConditionerRealisticBehavior.COOL_RATE_PER_MINUTE
			: AirConditionerRealisticBehavior.HEAT_RATE_PER_MINUTE;

		// Fan speed affects rate (0-100 range, normalized)
		const fanSpeedRaw = this.getStateValue(state, 'fanSpeed', 50);
		const fanSpeed = Number(fanSpeedRaw) || 50;
		const fanMultiplier = Math.max(0.5, fanSpeed / 50);
		const ratePerMinute = baseRate * fanMultiplier;

		const durationMs = Math.round((diff / ratePerMinute) * 60 * 1000);

		// Only apply compressor startup delay when first turning on, not for
		// subsequent temperature adjustments while already running
		const compressorRunning = this.getStateValue(state, 'compressorRunning', false) as boolean;
		const delayMs = compressorRunning ? 0 : AirConditionerRealisticBehavior.COMPRESSOR_STARTUP_DELAY_MS;
		this.setStateValue(state, 'compressorRunning', true);

		this.cancelTransitions(state, ChannelCategory.TEMPERATURE, PropertyCategory.TEMPERATURE);

		if (this.hasChannel(device, ChannelCategory.TEMPERATURE)) {
			updates.push({
				channelCategory: ChannelCategory.TEMPERATURE,
				propertyCategory: PropertyCategory.TEMPERATURE,
				targetValue: targetTemp,
				startValue: currentTemp,
				delayMs,
				durationMs,
			});
		}
	}
}

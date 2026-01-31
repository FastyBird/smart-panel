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
 * Realistic humidifier behavior.
 *
 * When a user sets a target humidity or turns the humidifier on/off:
 * - Humidity gradually approaches the target (~2% per minute)
 * - Mist level affects the rate of change
 * - Water tank level slowly decreases while running
 * - Status reflects whether actively humidifying
 */
export class HumidifierRealisticBehavior extends BaseDeviceBehavior {
	private static readonly BASE_HUMIDITY_RATE_PER_MINUTE = 2;
	private static readonly WATER_CONSUMPTION_PER_MINUTE = 0.5;
	private static readonly SETTLING_THRESHOLD = 1;

	getType(): string {
		return 'humidifier-realistic';
	}

	getSupportedCategory(): DeviceCategory {
		return DeviceCategory.AIR_HUMIDIFIER;
	}

	onPropertyChanged(
		device: SimulatorDeviceEntity,
		event: PropertyChangeEvent,
		state: DeviceBehaviorState,
	): ScheduledPropertyUpdate[] {
		const updates: ScheduledPropertyUpdate[] = [];

		if (event.channelCategory === ChannelCategory.HUMIDIFIER) {
			// React to on/off
			if (event.propertyCategory === PropertyCategory.ON) {
				const isOn = event.value === true;

				this.setStateValue(state, 'isOn', isOn);

				if (!isOn) {
					// Stop all humidity transitions
					this.cancelTransitions(state, ChannelCategory.HUMIDITY, PropertyCategory.HUMIDITY);
					this.cancelTransitions(state, ChannelCategory.HUMIDIFIER, PropertyCategory.STATUS);

					updates.push({
						channelCategory: ChannelCategory.HUMIDIFIER,
						propertyCategory: PropertyCategory.STATUS,
						targetValue: false,
						delayMs: 500,
						durationMs: 0,
					});
				} else {
					// Start humidifying toward target
					this.scheduleHumidityTransition(device, state, updates);
				}
			}

			// React to target humidity change
			if (event.propertyCategory === PropertyCategory.HUMIDITY) {
				const targetHumidity = event.value as number;
				this.setStateValue(state, 'targetHumidity', targetHumidity);

				const isOn = this.getStateValue(state, 'isOn', false);
				if (isOn) {
					this.scheduleHumidityTransition(device, state, updates);
				}
			}

			// React to mist level change
			if (event.propertyCategory === PropertyCategory.MIST_LEVEL) {
				this.setStateValue(state, 'mistLevel', event.value);
			}
		}

		return updates;
	}

	override tick(device: SimulatorDeviceEntity, state: DeviceBehaviorState, now: number): BehaviorTickResult[] {
		const results = super.tick(device, state, now);

		// Track current humidity in state
		for (const result of results) {
			if (
				result.channelCategory === ChannelCategory.HUMIDITY &&
				result.propertyCategory === PropertyCategory.HUMIDITY
			) {
				this.setStateValue(state, 'currentHumidity', result.value);
			}
		}

		// Simulate water tank depletion while running
		const isOn = this.getStateValue(state, 'isOn', false);
		if (isOn && state.activeUpdates.length > 0) {
			const waterLevel = this.getStateValue(state, 'waterLevel', 100) as number;
			const lastTick = this.getStateValue(state, 'lastWaterTick', now) as number;
			const elapsedMinutes = (now - lastTick) / 60000;

			if (elapsedMinutes > 0) {
				const newLevel = Math.max(
					0,
					waterLevel - elapsedMinutes * HumidifierRealisticBehavior.WATER_CONSUMPTION_PER_MINUTE,
				);
				this.setStateValue(state, 'waterLevel', newLevel);
				this.setStateValue(state, 'lastWaterTick', now);

				if (this.hasChannel(device, ChannelCategory.HUMIDIFIER)) {
					results.push({
						channelCategory: ChannelCategory.HUMIDIFIER,
						propertyCategory: PropertyCategory.WATER_TANK_LEVEL,
						value: Math.round(newLevel),
					});

					if (newLevel <= 0) {
						// Cancel active humidity transition since we can't humidify without water
						this.cancelTransitions(state, ChannelCategory.HUMIDITY, PropertyCategory.HUMIDITY);
						this.setStateValue(state, 'isOn', false);

						results.push({
							channelCategory: ChannelCategory.HUMIDIFIER,
							propertyCategory: PropertyCategory.WATER_TANK_EMPTY,
							value: true,
						});
						results.push({
							channelCategory: ChannelCategory.HUMIDIFIER,
							propertyCategory: PropertyCategory.STATUS,
							value: false,
						});
					}
				}
			}
		}

		return results;
	}

	private scheduleHumidityTransition(
		device: SimulatorDeviceEntity,
		state: DeviceBehaviorState,
		updates: ScheduledPropertyUpdate[],
	): void {
		const targetHumidity = this.getStateValue(state, 'targetHumidity', 50) as number;
		const currentHumidity = this.getOrInitStateFromDevice(
			state,
			'currentHumidity',
			device,
			ChannelCategory.HUMIDITY,
			PropertyCategory.HUMIDITY,
			40,
		);
		const diff = Math.abs(targetHumidity - currentHumidity);

		if (diff < HumidifierRealisticBehavior.SETTLING_THRESHOLD) {
			return;
		}

		const mistLevel = this.getStateValue(state, 'mistLevel', 50) as number;
		const rateMultiplier = mistLevel / 50; // 50 is "normal" speed
		const ratePerMinute = HumidifierRealisticBehavior.BASE_HUMIDITY_RATE_PER_MINUTE * Math.max(0.5, rateMultiplier);
		const durationMs = Math.round((diff / ratePerMinute) * 60 * 1000);

		// Cancel existing humidity transitions
		this.cancelTransitions(state, ChannelCategory.HUMIDITY, PropertyCategory.HUMIDITY);

		if (this.hasChannel(device, ChannelCategory.HUMIDITY)) {
			updates.push({
				channelCategory: ChannelCategory.HUMIDITY,
				propertyCategory: PropertyCategory.HUMIDITY,
				targetValue: targetHumidity,
				startValue: currentHumidity,
				delayMs: 0,
				durationMs,
			});
		}

		// Activate status
		this.cancelTransitions(state, ChannelCategory.HUMIDIFIER, PropertyCategory.STATUS);
		updates.push({
			channelCategory: ChannelCategory.HUMIDIFIER,
			propertyCategory: PropertyCategory.STATUS,
			targetValue: true,
			delayMs: 0,
			durationMs: 0,
		});

		// Deactivate status when done
		updates.push({
			channelCategory: ChannelCategory.HUMIDIFIER,
			propertyCategory: PropertyCategory.STATUS,
			targetValue: false,
			delayMs: durationMs,
			durationMs: 0,
		});

		this.setStateValue(state, 'lastWaterTick', Date.now());
	}
}

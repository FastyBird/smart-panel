import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { SimulatorDeviceEntity } from '../entities/devices-simulator.entity';

import { BaseDeviceSimulator, SimulatedPropertyValue } from './device-simulator.interface';
import { SimulationContext } from './simulation-context';

/**
 * Simulator for window covering (blinds, shades, curtains) devices
 * Simulates realistic position based on time of day and light conditions.
 */
export class WindowCoveringSimulator extends BaseDeviceSimulator {
	getSupportedCategory(): DeviceCategory {
		return DeviceCategory.WINDOW_COVERING;
	}

	simulate(
		device: SimulatorDeviceEntity,
		context: SimulationContext,
		previousValues?: Map<string, string | number | boolean>,
	): SimulatedPropertyValue[] {
		const values: SimulatedPropertyValue[] = [];

		// Window covering channel
		if (this.hasChannel(device, ChannelCategory.WINDOW_COVERING)) {
			values.push(...this.simulateWindowCovering(context, previousValues));
		}

		return values;
	}

	/**
	 * Simulate window covering state
	 */
	private simulateWindowCovering(
		context: SimulationContext,
		previousValues?: Map<string, string | number | boolean>,
	): SimulatedPropertyValue[] {
		const values: SimulatedPropertyValue[] = [];

		// Determine target position based on time and light
		const targetPosition = this.determineTargetPosition(context);

		const prevPosition = this.getPreviousValue(
			previousValues,
			ChannelCategory.WINDOW_COVERING,
			PropertyCategory.POSITION,
			targetPosition,
		) as number;

		// Smooth transition (blinds move slowly)
		const currentPosition = Math.round(this.smoothTransition(prevPosition, targetPosition, 5));

		values.push({
			channelCategory: ChannelCategory.WINDOW_COVERING,
			propertyCategory: PropertyCategory.POSITION,
			value: this.clamp(currentPosition, 0, 100),
		});

		// Tilt angle (for venetian blinds)
		const tiltTarget = this.determineTiltAngle(context);
		const prevTilt = this.getPreviousValue(
			previousValues,
			ChannelCategory.WINDOW_COVERING,
			PropertyCategory.TILT,
			tiltTarget,
		) as number;
		const currentTilt = Math.round(this.smoothTransition(prevTilt, tiltTarget, 10));

		values.push({
			channelCategory: ChannelCategory.WINDOW_COVERING,
			propertyCategory: PropertyCategory.TILT,
			value: this.clamp(currentTilt, 0, 100),
		});

		// Obstruction detected (rare)
		values.push({
			channelCategory: ChannelCategory.WINDOW_COVERING,
			propertyCategory: PropertyCategory.OBSTRUCTION,
			value: Math.random() < 0.001,
		});

		return values;
	}

	/**
	 * Determine target position based on time of day
	 * 0 = closed, 100 = fully open
	 */
	private determineTargetPosition(context: SimulationContext): number {
		const hour = context.hour;

		// Privacy and light control patterns
		if (hour >= 23 || hour < 6) {
			return 0; // Closed at night for privacy
		} else if (hour >= 6 && hour < 8) {
			return 30; // Partial open in morning
		} else if (hour >= 8 && hour < 11) {
			return 70; // Open for morning light
		} else if (hour >= 11 && hour < 15) {
			// Midday - depends on season (close in summer to block heat)
			return context.season === 'summer' ? 40 : 80;
		} else if (hour >= 15 && hour < 18) {
			return 60; // Afternoon
		} else if (hour >= 18 && hour < 21) {
			return 40; // Evening - some privacy
		} else {
			return 20; // Late evening
		}
	}

	/**
	 * Determine tilt angle for venetian blinds
	 * 0 = closed (horizontal), 50 = neutral, 100 = fully tilted
	 */
	private determineTiltAngle(context: SimulationContext): number {
		const hour = context.hour;

		// Tilt to control light direction
		if (context.isNight) {
			return 0; // Closed at night
		} else if (hour >= 6 && hour < 10) {
			return 70; // Angled to let in morning sun
		} else if (hour >= 10 && hour < 14) {
			return 30; // More closed to block direct midday sun
		} else if (hour >= 14 && hour < 18) {
			return 60; // Angled for afternoon light
		} else {
			return 50; // Neutral
		}
	}
}

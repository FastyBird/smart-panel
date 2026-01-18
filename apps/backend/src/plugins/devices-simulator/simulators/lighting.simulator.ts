import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { SimulatorDeviceEntity } from '../entities/devices-simulator.entity';

import { BaseDeviceSimulator, SimulatedPropertyValue } from './device-simulator.interface';
import { SimulationContext } from './simulation-context';

/**
 * Simulator for lighting devices
 * Simulates realistic lighting behavior based on time of day and activity patterns.
 */
export class LightingSimulator extends BaseDeviceSimulator {
	getSupportedCategory(): DeviceCategory {
		return DeviceCategory.LIGHTING;
	}

	simulate(
		device: SimulatorDeviceEntity,
		context: SimulationContext,
		previousValues?: Map<string, string | number | boolean>,
	): SimulatedPropertyValue[] {
		const values: SimulatedPropertyValue[] = [];

		if (this.hasChannel(device, ChannelCategory.LIGHT)) {
			values.push(...this.simulateLight(device, context, previousValues));
		}

		return values;
	}

	/**
	 * Simulate light state, brightness, and color
	 */
	private simulateLight(
		device: SimulatorDeviceEntity,
		context: SimulationContext,
		previousValues?: Map<string, string | number | boolean>,
	): SimulatedPropertyValue[] {
		const values: SimulatedPropertyValue[] = [];

		// Determine if light should be on based on time and activity
		const isOn = this.shouldLightBeOn(context);
		values.push({
			channelCategory: ChannelCategory.LIGHT,
			propertyCategory: PropertyCategory.ON,
			value: isOn,
		});

		if (!isOn) {
			return values;
		}

		// Brightness based on time of day
		if (this.hasProperty(device, ChannelCategory.LIGHT, PropertyCategory.BRIGHTNESS)) {
			const brightness = this.calculateBrightness(context, previousValues);
			values.push({
				channelCategory: ChannelCategory.LIGHT,
				propertyCategory: PropertyCategory.BRIGHTNESS,
				value: brightness,
			});
		}

		// Color temperature (warmer in evening, cooler during day)
		if (this.hasProperty(device, ChannelCategory.LIGHT, PropertyCategory.COLOR_TEMPERATURE)) {
			const colorTemp = this.calculateColorTemperature(context);
			values.push({
				channelCategory: ChannelCategory.LIGHT,
				propertyCategory: PropertyCategory.COLOR_TEMPERATURE,
				value: colorTemp,
			});
		}

		// RGB color (if supported) - occasional color changes
		if (this.hasProperty(device, ChannelCategory.LIGHT, PropertyCategory.COLOR_RED)) {
			const { red, green, blue } = this.calculateRGBColor(context, previousValues);

			values.push({
				channelCategory: ChannelCategory.LIGHT,
				propertyCategory: PropertyCategory.COLOR_RED,
				value: red,
			});
			values.push({
				channelCategory: ChannelCategory.LIGHT,
				propertyCategory: PropertyCategory.COLOR_GREEN,
				value: green,
			});
			values.push({
				channelCategory: ChannelCategory.LIGHT,
				propertyCategory: PropertyCategory.COLOR_BLUE,
				value: blue,
			});
		}

		// Hue and saturation (if supported)
		if (this.hasProperty(device, ChannelCategory.LIGHT, PropertyCategory.HUE)) {
			// Warm hue in evening (around 30°), neutral during day
			const hue = context.hour >= 18 || context.hour <= 6 ? 30 : 45;
			values.push({
				channelCategory: ChannelCategory.LIGHT,
				propertyCategory: PropertyCategory.HUE,
				value: hue,
			});
		}

		if (this.hasProperty(device, ChannelCategory.LIGHT, PropertyCategory.SATURATION)) {
			// Low saturation for natural white light
			const saturation = context.hour >= 18 || context.hour <= 6 ? 30 : 10;
			values.push({
				channelCategory: ChannelCategory.LIGHT,
				propertyCategory: PropertyCategory.SATURATION,
				value: saturation,
			});
		}

		return values;
	}

	/**
	 * Determine if light should be on based on time and activity patterns
	 */
	private shouldLightBeOn(context: SimulationContext): boolean {
		const hour = context.hour;

		// Different probabilities for different times
		if (hour >= 23 || hour < 6) {
			// Late night/early morning - mostly off
			return Math.random() < 0.1;
		} else if (hour >= 6 && hour < 8) {
			// Early morning - waking up
			return Math.random() < 0.7;
		} else if (hour >= 8 && hour < 17) {
			// Daytime - depends on natural light
			return context.isNight ? Math.random() < 0.8 : Math.random() < 0.2;
		} else if (hour >= 17 && hour < 20) {
			// Evening - high probability on
			return Math.random() < 0.85;
		} else {
			// Late evening - moderate
			return Math.random() < 0.6;
		}
	}

	/**
	 * Calculate brightness based on time of day
	 */
	private calculateBrightness(
		context: SimulationContext,
		previousValues?: Map<string, string | number | boolean>,
	): number {
		const hour = context.hour;
		let targetBrightness: number;

		if (hour >= 6 && hour < 9) {
			// Morning - gradually increasing
			targetBrightness = 60 + (hour - 6) * 10;
		} else if (hour >= 9 && hour < 17) {
			// Daytime - lower if natural light available
			targetBrightness = context.isNight ? 80 : 40;
		} else if (hour >= 17 && hour < 20) {
			// Evening - bright
			targetBrightness = 90;
		} else if (hour >= 20 && hour < 22) {
			// Late evening - dimming
			targetBrightness = 70;
		} else if (hour >= 22 || hour < 6) {
			// Night - dim if on
			targetBrightness = 30;
		} else {
			targetBrightness = 70;
		}

		const prevBrightness = this.getPreviousValue(
			previousValues,
			ChannelCategory.LIGHT,
			PropertyCategory.BRIGHTNESS,
			targetBrightness,
		) as number;

		return Math.round(this.smoothTransition(prevBrightness, targetBrightness, 10));
	}

	/**
	 * Calculate color temperature based on time (Kelvin)
	 * Lower = warmer (2700K), Higher = cooler (6500K)
	 */
	private calculateColorTemperature(context: SimulationContext): number {
		const hour = context.hour;

		// Warm light in morning and evening, cooler during day
		if (hour >= 6 && hour < 9) {
			// Morning - warm to wake up gently
			return 2700 + (hour - 6) * 300;
		} else if (hour >= 9 && hour < 17) {
			// Daytime - neutral to cool
			return 4000 + Math.random() * 500;
		} else if (hour >= 17 && hour < 20) {
			// Evening - transitioning warmer
			return 4000 - (hour - 17) * 400;
		} else {
			// Night - very warm for relaxation
			return 2700;
		}
	}

	/**
	 * Calculate RGB color values
	 */
	private calculateRGBColor(
		context: SimulationContext,
		previousValues?: Map<string, string | number | boolean>,
	): { red: number; green: number; blue: number } {
		// Usually warm white, occasionally colorful

		// 80% of the time, simulate warm white based on color temperature
		if (Math.random() < 0.8) {
			const colorTemp = this.calculateColorTemperature(context);
			return this.kelvinToRGB(colorTemp);
		}

		// Occasionally use previous values (keeping a color)
		const prevRed = this.getPreviousValue(
			previousValues,
			ChannelCategory.LIGHT,
			PropertyCategory.COLOR_RED,
			255,
		) as number;
		const prevGreen = this.getPreviousValue(
			previousValues,
			ChannelCategory.LIGHT,
			PropertyCategory.COLOR_GREEN,
			200,
		) as number;
		const prevBlue = this.getPreviousValue(
			previousValues,
			ChannelCategory.LIGHT,
			PropertyCategory.COLOR_BLUE,
			150,
		) as number;

		// Small random variations
		return {
			red: this.clamp(Math.round(prevRed + (Math.random() - 0.5) * 10), 0, 255),
			green: this.clamp(Math.round(prevGreen + (Math.random() - 0.5) * 10), 0, 255),
			blue: this.clamp(Math.round(prevBlue + (Math.random() - 0.5) * 10), 0, 255),
		};
	}

	/**
	 * Convert Kelvin color temperature to RGB (approximation)
	 */
	private kelvinToRGB(kelvin: number): { red: number; green: number; blue: number } {
		const temp = kelvin / 100;
		let red: number, green: number, blue: number;

		// Red calculation
		if (temp <= 66) {
			red = 255;
		} else {
			red = temp - 60;
			red = 329.698727446 * Math.pow(red, -0.1332047592);
			red = this.clamp(red, 0, 255);
		}

		// Green calculation
		if (temp <= 66) {
			green = temp;
			green = 99.4708025861 * Math.log(green) - 161.1195681661;
		} else {
			green = temp - 60;
			green = 288.1221695283 * Math.pow(green, -0.0755148492);
		}
		green = this.clamp(green, 0, 255);

		// Blue calculation
		if (temp >= 66) {
			blue = 255;
		} else if (temp <= 19) {
			blue = 0;
		} else {
			blue = temp - 10;
			blue = 138.5177312231 * Math.log(blue) - 305.0447927307;
			blue = this.clamp(blue, 0, 255);
		}

		return {
			red: Math.round(red),
			green: Math.round(green),
			blue: Math.round(blue),
		};
	}
}

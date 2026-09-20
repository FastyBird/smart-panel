import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { SimulatorDeviceEntity } from '../entities/simulator.entity';

import { SimulationContext } from './simulation-context';

/**
 * Represents a simulated property value update
 */
export interface SimulatedPropertyValue {
	channelId?: string;
	channelCategory: ChannelCategory;
	propertyCategory: PropertyCategory;
	value: string | number | boolean;
}

/**
 * Interface for device simulators that generate realistic values
 */
export interface IDeviceSimulator {
	/**
	 * Get the device category this simulator handles
	 */
	getSupportedCategory(): DeviceCategory;

	/**
	 * Check if this simulator supports the given device
	 */
	supportsDevice(device: SimulatorDeviceEntity): boolean;

	/**
	 * Generate realistic property values for the device
	 * @param device The device to simulate
	 * @param context Environmental context for simulation
	 * @param previousValues Previous property values (for smooth transitions)
	 */
	simulate(
		device: SimulatorDeviceEntity,
		context: SimulationContext,
		previousValues?: Map<string, string | number | boolean>,
	): SimulatedPropertyValue[];
}

/**
 * Base abstract class for device simulators with common utilities
 */
export abstract class BaseDeviceSimulator implements IDeviceSimulator {
	abstract getSupportedCategory(): DeviceCategory;

	supportsDevice(device: SimulatorDeviceEntity): boolean {
		return device.category === this.getSupportedCategory();
	}

	abstract simulate(
		device: SimulatorDeviceEntity,
		context: SimulationContext,
		previousValues?: Map<string, string | number | boolean>,
	): SimulatedPropertyValue[];

	/**
	 * Generate a value that smoothly transitions from the previous value
	 * @param previousValue Previous value
	 * @param targetValue Target value to approach
	 * @param maxChange Maximum change per update
	 */
	protected smoothTransition(previousValue: number, targetValue: number, maxChange: number): number {
		const diff = targetValue - previousValue;
		const change = Math.max(-maxChange, Math.min(maxChange, diff));
		return Math.round((previousValue + change) * 10) / 10;
	}

	/**
	 * Add realistic noise/variation to a value
	 * @param value Base value
	 * @param noiseRange Range of noise (±noiseRange/2)
	 * @param decimals Number of decimal places
	 */
	protected addNoise(value: number, noiseRange: number, decimals: number = 1): number {
		const noise = (Math.random() - 0.5) * noiseRange;
		const factor = Math.pow(10, decimals);
		return Math.round((value + noise) * factor) / factor;
	}

	/**
	 * Clamp a value within min/max bounds
	 */
	protected clamp(value: number, min: number, max: number): number {
		return Math.max(min, Math.min(max, value));
	}

	/**
	 * Get a property key for the previousValues map
	 */
	protected getPropertyKey(channelCategory: ChannelCategory, propertyCategory: PropertyCategory): string {
		return `${channelCategory}:${propertyCategory}`;
	}

	/**
	 * Get previous value from the map
	 */
	protected getPreviousValue(
		previousValues: Map<string, string | number | boolean> | undefined,
		channelCategory: ChannelCategory,
		propertyCategory: PropertyCategory,
		defaultValue: string | number | boolean,
	): string | number | boolean {
		if (!previousValues) return defaultValue;
		const key = this.getPropertyKey(channelCategory, propertyCategory);
		return previousValues.get(key) ?? defaultValue;
	}

	/**
	 * Check if device has a specific channel
	 */
	protected hasChannel(device: SimulatorDeviceEntity, category: ChannelCategory): boolean {
		return device.channels?.some((ch) => ch.category === category) ?? false;
	}

	/**
	 * Check if channel has a specific property
	 */
	protected hasProperty(
		device: SimulatorDeviceEntity,
		channelCategory: ChannelCategory,
		propertyCategory: PropertyCategory,
	): boolean {
		const channel = device.channels?.find((ch) => ch.category === channelCategory);
		return channel?.properties?.some((p) => p.category === propertyCategory) ?? false;
	}

	/**
	 * Simulate hardware input channels (button detected/active, binary_input state/active, analog_input value/active)
	 * if present on the device. Iterates all concrete matching channels preserving channel identity.
	 */
	protected simulateInputChannels(
		device: SimulatorDeviceEntity,
		context: SimulationContext,
		previousValues?: Map<string, string | number | boolean>,
	): SimulatedPropertyValue[] {
		const values: SimulatedPropertyValue[] = [];
		const isActivityTime = !context.isNight && context.hour >= 7 && context.hour <= 22;

		const buttonChannels = device.channels?.filter((ch) => ch.category === ChannelCategory.BUTTON) ?? [];
		for (const channel of buttonChannels) {
			const hasDetected = channel.properties?.some((p) => p.category === PropertyCategory.DETECTED);
			const hasActive = channel.properties?.some((p) => p.category === PropertyCategory.ACTIVE);

			if (hasDetected) {
				const detected = isActivityTime && Math.random() < 0.05;
				values.push({
					channelId: channel.id,
					channelCategory: ChannelCategory.BUTTON,
					propertyCategory: PropertyCategory.DETECTED,
					value: detected,
				});
			}
			if (hasActive) {
				values.push({
					channelId: channel.id,
					channelCategory: ChannelCategory.BUTTON,
					propertyCategory: PropertyCategory.ACTIVE,
					value: true,
				});
			}
		}

		const binaryInputChannels = device.channels?.filter((ch) => ch.category === ChannelCategory.BINARY_INPUT) ?? [];
		for (const channel of binaryInputChannels) {
			const hasState = channel.properties?.some((p) => p.category === PropertyCategory.STATE);
			const hasActive = channel.properties?.some((p) => p.category === PropertyCategory.ACTIVE);

			if (hasState) {
				const prevKey = channel.id ? `${channel.id}:${PropertyCategory.STATE}` : undefined;
				const prev =
					prevKey && previousValues?.has(prevKey)
						? previousValues.get(prevKey)
						: this.getPreviousValue(previousValues, ChannelCategory.BINARY_INPUT, PropertyCategory.STATE, false);
				const shouldToggle = isActivityTime && Math.random() < 0.1;
				const state = shouldToggle ? !prev : prev;
				values.push({
					channelId: channel.id,
					channelCategory: ChannelCategory.BINARY_INPUT,
					propertyCategory: PropertyCategory.STATE,
					value: Boolean(state),
				});
			}
			if (hasActive) {
				values.push({
					channelId: channel.id,
					channelCategory: ChannelCategory.BINARY_INPUT,
					propertyCategory: PropertyCategory.ACTIVE,
					value: true,
				});
			}
		}

		const analogInputChannels = device.channels?.filter((ch) => ch.category === ChannelCategory.ANALOG_INPUT) ?? [];
		for (const channel of analogInputChannels) {
			const hasValue = channel.properties?.some((p) => p.category === PropertyCategory.VALUE);
			const hasActive = channel.properties?.some((p) => p.category === PropertyCategory.ACTIVE);

			if (hasValue) {
				const prevKey = channel.id ? `${channel.id}:${PropertyCategory.VALUE}` : undefined;
				const prevRaw =
					prevKey && previousValues?.has(prevKey)
						? previousValues.get(prevKey)
						: this.getPreviousValue(previousValues, ChannelCategory.ANALOG_INPUT, PropertyCategory.VALUE, 5.0);
				const prev = Number(prevRaw);
				const target = isActivityTime ? 7.5 : 2.5;
				const value = this.smoothTransition(prev, target, 0.5);
				values.push({
					channelId: channel.id,
					channelCategory: ChannelCategory.ANALOG_INPUT,
					propertyCategory: PropertyCategory.VALUE,
					value,
				});
			}
			if (hasActive) {
				values.push({
					channelId: channel.id,
					channelCategory: ChannelCategory.ANALOG_INPUT,
					propertyCategory: PropertyCategory.ACTIVE,
					value: true,
				});
			}
		}

		return values;
	}
}

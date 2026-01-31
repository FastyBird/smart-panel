import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { SimulatorDeviceEntity } from '../entities/devices-simulator.entity';

/**
 * Represents a property change event from a user command
 */
export interface PropertyChangeEvent {
	deviceId: string;
	channelCategory: ChannelCategory;
	propertyCategory: PropertyCategory;
	value: string | number | boolean;
	previousValue?: string | number | boolean;
}

/**
 * Represents a scheduled property update to be applied after a delay or gradually
 */
export interface ScheduledPropertyUpdate {
	channelCategory: ChannelCategory;
	propertyCategory: PropertyCategory;
	targetValue: string | number | boolean;
	/** Delay in ms before this update starts (e.g., TV power-on delay) */
	delayMs: number;
	/** Duration in ms over which to transition (0 = instant after delay) */
	durationMs: number;
	/** Starting value for gradual transitions */
	startValue?: number;
}

/**
 * Internal state tracked per device by the behavior manager
 */
export interface DeviceBehaviorState {
	/** Active scheduled updates for this device */
	activeUpdates: ActivePropertyTransition[];
	/** Arbitrary state the behavior can store (e.g., target temp, mode) */
	data: Map<string, string | number | boolean>;
}

/**
 * An in-progress property transition
 */
export interface ActivePropertyTransition {
	channelCategory: ChannelCategory;
	propertyCategory: PropertyCategory;
	targetValue: string | number | boolean;
	startValue?: number;
	startTime: number;
	delayMs: number;
	durationMs: number;
}

/**
 * Result of a tick operation - property values to apply
 */
export interface BehaviorTickResult {
	channelCategory: ChannelCategory;
	propertyCategory: PropertyCategory;
	value: string | number | boolean;
}

/**
 * Interface for device behaviors that react to user commands with realistic responses.
 *
 * Unlike simulators (which generate autonomous time-based values), behaviors
 * react to user interactions and produce delayed/gradual responses that mimic
 * real device physics.
 */
export interface IDeviceBehavior {
	/**
	 * Unique type identifier for this behavior (e.g., "thermostat-realistic", "television-delayed")
	 */
	getType(): string;

	/**
	 * Device category this behavior applies to
	 */
	getSupportedCategory(): DeviceCategory;

	/**
	 * Called when a user changes a property on a device managed by this behavior.
	 * Returns scheduled updates that should be applied over time.
	 */
	onPropertyChanged(
		device: SimulatorDeviceEntity,
		event: PropertyChangeEvent,
		state: DeviceBehaviorState,
	): ScheduledPropertyUpdate[];

	/**
	 * Called on each simulation tick to compute current values for active transitions.
	 * Returns property values that should be applied now.
	 */
	tick(
		device: SimulatorDeviceEntity,
		state: DeviceBehaviorState,
		now: number,
	): BehaviorTickResult[];
}

/**
 * Base class with common utilities for device behaviors
 */
export abstract class BaseDeviceBehavior implements IDeviceBehavior {
	abstract getType(): string;
	abstract getSupportedCategory(): DeviceCategory;

	abstract onPropertyChanged(
		device: SimulatorDeviceEntity,
		event: PropertyChangeEvent,
		state: DeviceBehaviorState,
	): ScheduledPropertyUpdate[];

	tick(
		device: SimulatorDeviceEntity,
		state: DeviceBehaviorState,
		now: number,
	): BehaviorTickResult[] {
		const results: BehaviorTickResult[] = [];
		const completed: number[] = [];

		for (let i = 0; i < state.activeUpdates.length; i++) {
			const transition = state.activeUpdates[i];
			const elapsed = now - transition.startTime;

			// Not yet started (still in delay period)
			if (elapsed < transition.delayMs) {
				continue;
			}

			const activeElapsed = elapsed - transition.delayMs;

			// Instant update (no duration)
			if (transition.durationMs === 0) {
				results.push({
					channelCategory: transition.channelCategory,
					propertyCategory: transition.propertyCategory,
					value: transition.targetValue,
				});
				completed.push(i);
				continue;
			}

			// Gradual transition
			if (typeof transition.targetValue === 'number' && transition.startValue !== undefined) {
				const progress = Math.min(1, activeElapsed / transition.durationMs);
				const eased = this.easeInOut(progress);
				const currentValue = transition.startValue + (transition.targetValue - transition.startValue) * eased;
				const rounded = Math.round(currentValue * 10) / 10;

				results.push({
					channelCategory: transition.channelCategory,
					propertyCategory: transition.propertyCategory,
					value: rounded,
				});

				if (progress >= 1) {
					completed.push(i);
				}
			} else {
				// Non-numeric: apply immediately after delay
				results.push({
					channelCategory: transition.channelCategory,
					propertyCategory: transition.propertyCategory,
					value: transition.targetValue,
				});
				completed.push(i);
			}
		}

		// Remove completed transitions (iterate in reverse to preserve indices)
		for (let i = completed.length - 1; i >= 0; i--) {
			state.activeUpdates.splice(completed[i], 1);
		}

		return results;
	}

	/**
	 * Ease-in-out curve for smooth transitions
	 */
	protected easeInOut(t: number): number {
		return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
	}

	/**
	 * Check if device has a specific channel
	 */
	protected hasChannel(device: SimulatorDeviceEntity, category: ChannelCategory): boolean {
		return device.channels?.some((ch) => ch.category === category) ?? false;
	}

	/**
	 * Get current value from behavior state data
	 */
	protected getStateValue(
		state: DeviceBehaviorState,
		key: string,
		defaultValue: string | number | boolean,
	): string | number | boolean {
		return state.data.get(key) ?? defaultValue;
	}

	/**
	 * Set value in behavior state data
	 */
	protected setStateValue(state: DeviceBehaviorState, key: string, value: string | number | boolean): void {
		state.data.set(key, value);
	}

	/**
	 * Cancel any existing transitions for a specific property
	 */
	protected cancelTransitions(
		state: DeviceBehaviorState,
		channelCategory: ChannelCategory,
		propertyCategory: PropertyCategory,
	): void {
		state.activeUpdates = state.activeUpdates.filter(
			(u) => !(u.channelCategory === channelCategory && u.propertyCategory === propertyCategory),
		);
	}

	/**
	 * Read a property value from the device entity's channel properties.
	 * Returns the fallback if the channel/property is not found or has no value.
	 */
	protected getDevicePropertyValue(
		device: SimulatorDeviceEntity,
		channelCategory: ChannelCategory,
		propertyCategory: PropertyCategory,
		fallback: number,
	): number {
		const channel = device.channels?.find((ch) => ch.category === channelCategory);

		if (channel) {
			const prop = channel.properties?.find((p) => p.category === propertyCategory);

			if (prop?.value?.value != null) {
				const val = Number(prop.value.value);

				if (!isNaN(val)) {
					return val;
				}
			}
		}

		return fallback;
	}

	/**
	 * Get a state value, initializing it from the device's actual property value
	 * if not yet tracked. This prevents hardcoded defaults from overwriting real values.
	 */
	protected getOrInitStateFromDevice(
		state: DeviceBehaviorState,
		key: string,
		device: SimulatorDeviceEntity,
		channelCategory: ChannelCategory,
		propertyCategory: PropertyCategory,
		fallback: number,
	): number {
		if (!state.data.has(key)) {
			const actual = this.getDevicePropertyValue(device, channelCategory, propertyCategory, fallback);
			state.data.set(key, actual);

			return actual;
		}

		return state.data.get(key) as number;
	}
}

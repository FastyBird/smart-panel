import { Injectable, OnModuleDestroy } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import {
	ActivePropertyTransition,
	BehaviorTickResult,
	DeviceBehaviorState,
	IDeviceBehavior,
	PropertyChangeEvent,
} from '../behaviors';
import { DEVICES_SIMULATOR_PLUGIN_NAME, DEVICES_SIMULATOR_TYPE } from '../devices-simulator.constants';
import { SimulatorDeviceEntity } from '../entities/devices-simulator.entity';

/**
 * Manages device behaviors - reactive simulation logic that responds to user commands.
 *
 * Each simulator device can optionally have a behavior assigned. When properties change
 * on that device (via user commands from the panel), the behavior schedules realistic
 * follow-up changes (e.g., gradual temperature convergence, delayed TV power-on).
 *
 * The manager maintains per-device state and processes ticks to apply scheduled updates.
 */
@Injectable()
export class DeviceBehaviorManagerService implements OnModuleDestroy {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_SIMULATOR_PLUGIN_NAME,
		'DeviceBehaviorManagerService',
	);

	/** All registered behavior types */
	private readonly behaviors: Map<string, IDeviceBehavior> = new Map();

	/** Default behavior type per device category */
	private readonly categoryDefaults: Map<DeviceCategory, string> = new Map();

	/** Device ID → assigned behavior type */
	private readonly deviceBehaviorAssignments: Map<string, string> = new Map();

	/** Device ID → behavior state */
	private readonly deviceStates: Map<string, DeviceBehaviorState> = new Map();

	/** Tick timer */
	private tickTimer: ReturnType<typeof setInterval> | null = null;
	private tickInProgress = false;
	private tickIntervalMs = 5000;

	constructor(
		private readonly devicesService: DevicesService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
	) {}

	/**
	 * Register a behavior type. Can register multiple behaviors per category.
	 */
	registerBehavior(behavior: IDeviceBehavior, isDefault = false): void {
		this.behaviors.set(behavior.getType(), behavior);

		if (isDefault) {
			this.categoryDefaults.set(behavior.getSupportedCategory(), behavior.getType());
		}

		this.logger.debug(
			`Registered behavior: ${behavior.getType()} for ${behavior.getSupportedCategory()}${isDefault ? ' (default)' : ''}`,
		);
	}

	/**
	 * Assign a behavior to a specific device
	 */
	assignBehavior(deviceId: string, behaviorType: string): boolean {
		const behavior = this.behaviors.get(behaviorType);

		if (!behavior) {
			this.logger.warn(`Unknown behavior type: ${behaviorType}`);
			return false;
		}

		this.deviceBehaviorAssignments.set(deviceId, behaviorType);
		this.logger.debug(`Assigned behavior ${behaviorType} to device ${deviceId}`);

		return true;
	}

	/**
	 * Remove behavior assignment from a device
	 */
	unassignBehavior(deviceId: string): void {
		this.deviceBehaviorAssignments.delete(deviceId);
		this.deviceStates.delete(deviceId);
	}

	/**
	 * Get the behavior for a device (explicit assignment or category default)
	 */
	getBehaviorForDevice(device: SimulatorDeviceEntity): IDeviceBehavior | null {
		// Only "realistic" devices get behavior-based simulation
		if (device.behaviorMode !== 'realistic') {
			return null;
		}

		// Check explicit assignment first
		const assignedType = this.deviceBehaviorAssignments.get(device.id);
		if (assignedType) {
			return this.behaviors.get(assignedType) ?? null;
		}

		// Fall back to category default
		const defaultType = this.categoryDefaults.get(device.category);
		if (defaultType) {
			return this.behaviors.get(defaultType) ?? null;
		}

		return null;
	}

	/**
	 * Check if a device has an active behavior (explicit or default)
	 */
	hasBehavior(device: SimulatorDeviceEntity): boolean {
		return this.getBehaviorForDevice(device) !== null;
	}

	/**
	 * Get or create state for a device
	 */
	private getOrCreateState(deviceId: string): DeviceBehaviorState {
		let state = this.deviceStates.get(deviceId);

		if (!state) {
			state = {
				activeUpdates: [],
				data: new Map(),
			};
			this.deviceStates.set(deviceId, state);
		}

		return state;
	}

	/**
	 * Called when a property changes on a simulator device (from user command).
	 * Dispatches to the device's behavior and schedules follow-up updates.
	 */
	handlePropertyChange(
		device: SimulatorDeviceEntity,
		channelCategory: ChannelCategory,
		propertyCategory: PropertyCategory,
		value: string | number | boolean,
		previousValue?: string | number | boolean,
	): void {
		const behavior = this.getBehaviorForDevice(device);

		if (!behavior) {
			return;
		}

		const state = this.getOrCreateState(device.id);

		const event: PropertyChangeEvent = {
			deviceId: device.id,
			channelCategory,
			propertyCategory,
			value,
			previousValue,
		};

		try {
			const scheduledUpdates = behavior.onPropertyChanged(device, event, state);

			if (scheduledUpdates.length === 0) {
				return;
			}

			const now = Date.now();

			for (const update of scheduledUpdates) {
				const transition: ActivePropertyTransition = {
					channelCategory: update.channelCategory,
					propertyCategory: update.propertyCategory,
					targetValue: update.targetValue,
					startValue: update.startValue,
					startTime: now,
					delayMs: update.delayMs,
					durationMs: update.durationMs,
				};

				state.activeUpdates.push(transition);
			}

			this.logger.debug(
				`Behavior ${behavior.getType()} scheduled ${scheduledUpdates.length} updates for device ${device.id}`,
			);

			// Ensure tick timer is running if we have active transitions
			this.ensureTickTimer();
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			this.logger.error(`Error in behavior ${behavior.getType()} for device ${device.id}: ${message}`);
		}
	}

	/**
	 * Process all active behavior transitions. Called periodically by tick timer.
	 */
	async processTick(): Promise<{ devicesProcessed: number; propertiesUpdated: number }> {
		if (this.tickInProgress) {
			return { devicesProcessed: 0, propertiesUpdated: 0 };
		}

		this.tickInProgress = true;

		const now = Date.now();
		let devicesProcessed = 0;
		let propertiesUpdated = 0;

		try {
			for (const [deviceId, state] of this.deviceStates.entries()) {
				if (state.activeUpdates.length === 0) {
					continue;
				}

				try {
					const device = await this.devicesService.findOne<SimulatorDeviceEntity>(
						deviceId,
						DEVICES_SIMULATOR_TYPE,
					);

					if (!device) {
						this.deviceStates.delete(deviceId);
						continue;
					}

					const behavior = this.getBehaviorForDevice(device);

					if (!behavior) {
						// Device no longer has an active behavior (e.g., mode changed to 'default')
						// Clean up stale state to prevent tick timer from running indefinitely
						this.deviceStates.delete(deviceId);
						continue;
					}

					const results = behavior.tick(device, state, now);

					if (results.length > 0) {
						devicesProcessed++;
						const updated = await this.applyBehaviorResults(device, results);
						propertiesUpdated += updated;
					}
				} catch (error: unknown) {
					const message = error instanceof Error ? error.message : 'Unknown error';
					this.logger.error(`Error processing tick for device ${deviceId}: ${message}`);
				}
			}

			// Stop tick timer if no active transitions remain
			if (!this.hasActiveTransitions()) {
				this.stopTickTimer();
			}
		} finally {
			this.tickInProgress = false;
		}

		return { devicesProcessed, propertiesUpdated };
	}

	/**
	 * Apply behavior tick results to device properties
	 */
	private async applyBehaviorResults(device: SimulatorDeviceEntity, results: BehaviorTickResult[]): Promise<number> {
		let updated = 0;

		for (const result of results) {
			const channel = device.channels?.find((ch) => ch.category === result.channelCategory);

			if (!channel) {
				continue;
			}

			const property = channel.properties?.find((p) => p.category === result.propertyCategory);

			if (!property) {
				continue;
			}

			try {
				await this.channelsPropertiesService.update(property.id, {
					type: property.type,
					value: result.value,
				});
				updated++;
			} catch (error: unknown) {
				const message = error instanceof Error ? error.message : 'Unknown error';
				this.logger.warn(`Failed to apply behavior result for property ${property.id}: ${message}`);
			}
		}

		return updated;
	}

	/**
	 * Check if any device has active transitions
	 */
	hasActiveTransitions(): boolean {
		for (const state of this.deviceStates.values()) {
			if (state.activeUpdates.length > 0) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Set the tick interval for processing behavior updates
	 */
	setTickInterval(intervalMs: number): void {
		this.tickIntervalMs = intervalMs;

		if (this.tickTimer) {
			this.stopTickTimer();
			this.ensureTickTimer();
		}
	}

	/**
	 * Start the tick timer if not already running
	 */
	private ensureTickTimer(): void {
		if (this.tickTimer) {
			return;
		}

		this.tickTimer = setInterval(() => {
			void this.processTick();
		}, this.tickIntervalMs);

		this.logger.debug(`Behavior tick timer started (${this.tickIntervalMs}ms interval)`);
	}

	/**
	 * Stop the tick timer
	 */
	stopTickTimer(): void {
		if (this.tickTimer) {
			clearInterval(this.tickTimer);
			this.tickTimer = null;
			this.logger.debug('Behavior tick timer stopped');
		}
	}

	/**
	 * Get list of registered behavior types
	 */
	getRegisteredBehaviors(): Array<{ type: string; category: DeviceCategory; isDefault: boolean }> {
		const result: Array<{ type: string; category: DeviceCategory; isDefault: boolean }> = [];

		for (const [type, behavior] of this.behaviors.entries()) {
			const category = behavior.getSupportedCategory();
			const isDefault = this.categoryDefaults.get(category) === type;
			result.push({ type, category, isDefault });
		}

		return result;
	}

	/**
	 * Get the count of devices with active transitions
	 */
	getActiveDeviceCount(): number {
		let count = 0;

		for (const state of this.deviceStates.values()) {
			if (state.activeUpdates.length > 0) {
				count++;
			}
		}

		return count;
	}

	/**
	 * Clear all state (for testing or reset)
	 */
	clearAll(): void {
		this.stopTickTimer();
		this.deviceStates.clear();
		this.deviceBehaviorAssignments.clear();
		this.logger.debug('All behavior state cleared');
	}

	/**
	 * Clean up on module destroy
	 */
	onModuleDestroy(): void {
		this.stopTickTimer();
	}
}

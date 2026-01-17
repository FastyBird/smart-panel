import { Injectable, OnModuleDestroy } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { ChannelCategory, PropertyCategory } from '../../devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { IDevicePropertyData } from '../../devices/platforms/device.platform';
import { DevicesService } from '../../devices/services/devices.service';
import { PlatformRegistryService } from '../../devices/services/platform.registry.service';
import { SPACES_MODULE_NAME } from '../spaces.constants';

import {
	ClimateStateSnapshot,
	CoverStateSnapshot,
	LightStateSnapshot,
	SpaceContextSnapshot,
} from './space-context-snapshot.service';
import { SpacesService } from './spaces.service';

/**
 * Represents a single undo entry with the snapshot before an intent was executed.
 */
export interface UndoEntry {
	/** Unique identifier for this undo entry */
	id: string;
	/** Space ID this entry belongs to */
	spaceId: string;
	/** Timestamp when the snapshot was captured */
	capturedAt: Date;
	/** The snapshot of space state before the intent was executed */
	snapshot: SpaceContextSnapshot;
	/** Description of the action that was performed */
	actionDescription: string;
	/** Type of intent that was executed (lighting, climate, covers) */
	intentCategory: 'lighting' | 'climate' | 'covers';
}

/**
 * Result of an undo operation.
 */
export interface UndoResult {
	success: boolean;
	restoredDevices: number;
	failedDevices: number;
	message: string;
}

/**
 * Configuration for the undo history service.
 */
interface UndoHistoryConfig {
	/** Maximum number of undo entries per space */
	maxEntriesPerSpace: number;
	/** Time in milliseconds before an entry expires */
	entryTtlMs: number;
}

/**
 * Default configuration for lightweight undo.
 * - Only 1 entry per space (most recent action only)
 * - Entries expire after 5 minutes
 */
const DEFAULT_CONFIG: UndoHistoryConfig = {
	maxEntriesPerSpace: 1,
	entryTtlMs: 5 * 60 * 1000, // 5 minutes
};

/**
 * SpaceUndoHistoryService provides lightweight undo functionality for space intents.
 *
 * Key features:
 * - In-memory storage (no persistence)
 * - Automatic expiration of old entries
 * - Configurable stack depth (default: 1 entry per space)
 * - Restores device states by replaying property commands
 *
 * Design decisions:
 * - Lightweight: single entry per space by default
 * - In-memory: entries are lost on restart (acceptable for "undo recent action" use case)
 * - Time-limited: entries expire after 5 minutes to avoid stale state restoration
 */
@Injectable()
export class SpaceUndoHistoryService implements OnModuleDestroy {
	private readonly logger = createExtensionLogger(SPACES_MODULE_NAME, 'SpaceUndoHistoryService');
	private readonly config: UndoHistoryConfig = DEFAULT_CONFIG;

	/** In-memory storage: spaceId -> array of undo entries (newest first) */
	private readonly undoStacks = new Map<string, UndoEntry[]>();

	/** Timer for periodic cleanup of expired entries */
	private cleanupTimer: NodeJS.Timeout | null = null;

	constructor(
		private readonly spacesService: SpacesService,
		private readonly devicesService: DevicesService,
		private readonly platformRegistryService: PlatformRegistryService,
	) {
		// Start periodic cleanup every minute
		this.cleanupTimer = setInterval(() => this.cleanupExpiredEntries(), 60 * 1000);
	}

	onModuleDestroy() {
		if (this.cleanupTimer) {
			clearInterval(this.cleanupTimer);
			this.cleanupTimer = null;
		}
	}

	/**
	 * Get the configured TTL for undo entries in milliseconds.
	 * Use this to calculate expiration times consistently.
	 */
	getEntryTtlMs(): number {
		return this.config.entryTtlMs;
	}

	/**
	 * Push a snapshot onto the undo stack for a space.
	 * Call this BEFORE executing an intent to capture the "before" state.
	 *
	 * @param snapshot - The context snapshot captured before the intent
	 * @param actionDescription - Human-readable description of the action
	 * @param intentCategory - The category of intent being executed
	 * @returns The created undo entry
	 */
	pushSnapshot(
		snapshot: SpaceContextSnapshot,
		actionDescription: string,
		intentCategory: 'lighting' | 'climate' | 'covers',
	): UndoEntry {
		const entry: UndoEntry = {
			id: this.generateId(),
			spaceId: snapshot.spaceId,
			capturedAt: new Date(),
			snapshot,
			actionDescription,
			intentCategory,
		};

		// Get or create stack for this space
		let stack = this.undoStacks.get(snapshot.spaceId);

		if (!stack) {
			stack = [];
			this.undoStacks.set(snapshot.spaceId, stack);
		}

		// Add new entry at the beginning (newest first)
		stack.unshift(entry);

		// Trim to max size
		while (stack.length > this.config.maxEntriesPerSpace) {
			stack.pop();
		}

		return entry;
	}

	/**
	 * Check if an undo entry is available for a space.
	 *
	 * @param spaceId - The space ID
	 * @returns The most recent valid undo entry, or null if none available
	 */
	peekUndoEntry(spaceId: string): UndoEntry | null {
		const stack = this.undoStacks.get(spaceId);

		if (!stack || stack.length === 0) {
			return null;
		}

		// Get the most recent entry
		const entry = stack[0];

		// Check if it's expired
		if (this.isExpired(entry)) {
			// Remove expired entry
			stack.shift();

			if (stack.length === 0) {
				this.undoStacks.delete(spaceId);
			}

			return null;
		}

		return entry;
	}

	/**
	 * Pop and execute the most recent undo entry for a space.
	 * Restores device states to the captured snapshot.
	 *
	 * @param spaceId - The space ID
	 * @returns Result of the undo operation
	 */
	async executeUndo(spaceId: string): Promise<UndoResult> {
		const entry = this.peekUndoEntry(spaceId);

		if (!entry) {
			return {
				success: false,
				restoredDevices: 0,
				failedDevices: 0,
				message: 'No undo entry available',
			};
		}

		// Remove the entry from the stack (it's being consumed)
		const stack = this.undoStacks.get(spaceId);

		if (stack) {
			stack.shift();

			if (stack.length === 0) {
				this.undoStacks.delete(spaceId);
			}
		}

		// Restore the state based on the snapshot
		const result = await this.restoreSnapshot(entry.snapshot);

		this.logger.log(
			`Undo executed spaceId=${spaceId} restored=${result.restoredDevices} failed=${result.failedDevices}`,
		);

		return result;
	}

	/**
	 * Clear all undo entries for a space.
	 *
	 * @param spaceId - The space ID
	 */
	clearSpace(spaceId: string): void {
		this.undoStacks.delete(spaceId);
	}

	/**
	 * Restore device states from a snapshot.
	 * Restores lighting, climate, and covers state.
	 */
	private async restoreSnapshot(snapshot: SpaceContextSnapshot): Promise<UndoResult> {
		let restoredDevices = 0;
		let failedDevices = 0;

		// Restore lighting state
		for (const lightState of snapshot.lighting.lights) {
			const success = await this.restoreLightState(lightState);

			if (success) {
				restoredDevices++;
			} else {
				failedDevices++;
			}
		}

		// Restore climate state
		const climateResult = await this.restoreClimateState(snapshot.climate);

		if (climateResult.restored) {
			restoredDevices++;
		} else if (climateResult.failed) {
			failedDevices++;
		}
		// If neither restored nor failed, climate was not applicable (no thermostat/no setpoint change)

		// Restore covers state
		for (const coverState of snapshot.covers.covers) {
			const success = await this.restoreCoverState(coverState);

			if (success) {
				restoredDevices++;
			} else {
				failedDevices++;
			}
		}

		return {
			success: failedDevices === 0 || restoredDevices > 0,
			restoredDevices,
			failedDevices,
			message: `Restored ${restoredDevices} device(s)`,
		};
	}

	/**
	 * Restore a single light's state from a snapshot.
	 */
	private async restoreLightState(lightState: LightStateSnapshot): Promise<boolean> {
		try {
			// Get the device with full relations
			const device = await this.devicesService.getOneOrThrow(lightState.deviceId);
			const channel = device.channels?.find((ch) => ch.id === lightState.channelId);

			if (!channel) {
				this.logger.warn(`Channel not found deviceId=${lightState.deviceId} channelId=${lightState.channelId}`);

				return false;
			}

			const platform = this.platformRegistryService.get(device);

			if (!platform) {
				this.logger.warn(`No platform for device id=${device.id}`);

				return false;
			}

			const commands = this.buildLightRestoreCommands(device, channel, lightState);

			if (commands.length === 0) {
				return true;
			}

			const success = await platform.processBatch(commands);

			if (!success) {
				this.logger.error(`Failed to restore light state deviceId=${device.id}`);

				return false;
			}

			return true;
		} catch (error) {
			this.logger.error(`Error restoring light state deviceId=${lightState.deviceId}: ${error}`);

			return false;
		}
	}

	/**
	 * Restore climate state from a snapshot.
	 * Returns { restored: true } if setpoint was restored,
	 * { failed: true } if restoration failed,
	 * { restored: false, failed: false } if no restoration was needed.
	 */
	private async restoreClimateState(climate: ClimateStateSnapshot): Promise<{ restored: boolean; failed: boolean }> {
		// Skip if no climate devices or no setpoint capability
		if (!climate.hasClimate || !climate.canSetSetpoint || !climate.primaryThermostatId) {
			return { restored: false, failed: false };
		}

		// Skip if no target temperature was captured
		if (climate.targetTemperature === null) {
			return { restored: false, failed: false };
		}

		try {
			// Get the thermostat device with full relations
			const device = await this.devicesService.getOneOrThrow(climate.primaryThermostatId);

			// Find the setpoint channel and property
			const setpointChannel = device.channels?.find(
				(ch) =>
					ch.category === ChannelCategory.THERMOSTAT ||
					ch.category === ChannelCategory.HEATER ||
					ch.category === ChannelCategory.COOLER,
			);

			if (!setpointChannel) {
				this.logger.warn(`No setpoint channel found for thermostat deviceId=${device.id}`);

				return { restored: false, failed: true };
			}

			const setpointProperty = setpointChannel.properties?.find((p) => p.category === PropertyCategory.TEMPERATURE);

			if (!setpointProperty) {
				this.logger.warn(`No setpoint property found for thermostat deviceId=${device.id}`);

				return { restored: false, failed: true };
			}

			const platform = this.platformRegistryService.get(device);

			if (!platform) {
				this.logger.warn(`No platform for thermostat device id=${device.id}`);

				return { restored: false, failed: true };
			}

			const command: IDevicePropertyData = {
				device,
				channel: setpointChannel,
				property: setpointProperty,
				value: climate.targetTemperature,
			};

			const success = await platform.processBatch([command]);

			if (!success) {
				this.logger.error(`Failed to restore climate state deviceId=${device.id}`);

				return { restored: false, failed: true };
			}

			return { restored: true, failed: false };
		} catch (error) {
			this.logger.error(`Error restoring climate state thermostatId=${climate.primaryThermostatId}: ${error}`);

			return { restored: false, failed: true };
		}
	}

	/**
	 * Restore a single cover's state from a snapshot.
	 */
	private async restoreCoverState(coverState: CoverStateSnapshot): Promise<boolean> {
		// Skip if no position to restore
		if (coverState.position === null) {
			return true;
		}

		try {
			// Get the device with full relations
			const device = await this.devicesService.getOneOrThrow(coverState.deviceId);
			const channel = device.channels?.find((ch) => ch.id === coverState.channelId);

			if (!channel) {
				this.logger.warn(`Channel not found deviceId=${coverState.deviceId} channelId=${coverState.channelId}`);

				return false;
			}

			const platform = this.platformRegistryService.get(device);

			if (!platform) {
				this.logger.warn(`No platform for device id=${device.id}`);

				return false;
			}

			// Find the position property
			const positionProperty = this.findProperty(channel, PropertyCategory.POSITION);

			if (!positionProperty) {
				this.logger.warn(`No position property found for cover deviceId=${device.id} channelId=${channel.id}`);

				return false;
			}

			const command: IDevicePropertyData = {
				device,
				channel,
				property: positionProperty,
				value: coverState.position,
			};

			const success = await platform.processBatch([command]);

			if (!success) {
				this.logger.error(`Failed to restore cover state deviceId=${device.id}`);

				return false;
			}

			return true;
		} catch (error) {
			this.logger.error(`Error restoring cover state deviceId=${coverState.deviceId}: ${error}`);

			return false;
		}
	}

	/**
	 * Build commands to restore a light to its snapshot state.
	 */
	private buildLightRestoreCommands(
		device: DeviceEntity,
		channel: ChannelEntity,
		lightState: LightStateSnapshot,
	): IDevicePropertyData[] {
		const commands: IDevicePropertyData[] = [];

		// Find properties
		const onProperty = this.findProperty(channel, PropertyCategory.ON);
		const brightnessProperty = this.findProperty(channel, PropertyCategory.BRIGHTNESS);
		const colorTempProperty = this.findProperty(channel, PropertyCategory.COLOR_TEMPERATURE);
		const colorRedProperty = this.findProperty(channel, PropertyCategory.COLOR_RED);
		const colorGreenProperty = this.findProperty(channel, PropertyCategory.COLOR_GREEN);
		const colorBlueProperty = this.findProperty(channel, PropertyCategory.COLOR_BLUE);

		// Restore on/off state
		if (onProperty) {
			commands.push({
				device,
				channel,
				property: onProperty,
				value: lightState.isOn,
			});
		}

		// Restore brightness if the light was on and has brightness
		if (lightState.isOn && lightState.brightness !== null && brightnessProperty) {
			commands.push({
				device,
				channel,
				property: brightnessProperty,
				value: lightState.brightness,
			});
		}

		// Restore color temperature if available
		if (lightState.isOn && lightState.colorTemperature !== null && colorTempProperty) {
			commands.push({
				device,
				channel,
				property: colorTempProperty,
				value: lightState.colorTemperature,
			});
		}

		// Restore color if available (from hex string)
		if (
			lightState.isOn &&
			lightState.color &&
			lightState.color.startsWith('#') &&
			colorRedProperty &&
			colorGreenProperty &&
			colorBlueProperty
		) {
			const rgb = this.hexToRgb(lightState.color);

			if (rgb) {
				commands.push(
					{ device, channel, property: colorRedProperty, value: rgb.r },
					{ device, channel, property: colorGreenProperty, value: rgb.g },
					{ device, channel, property: colorBlueProperty, value: rgb.b },
				);
			}
		}

		return commands;
	}

	/**
	 * Find a property by category in a channel.
	 */
	private findProperty(channel: ChannelEntity, category: PropertyCategory): ChannelPropertyEntity | null {
		return channel.properties?.find((p) => p.category === category) ?? null;
	}

	/**
	 * Convert hex color string to RGB values.
	 */
	private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
		const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);

		if (!result) {
			return null;
		}

		return {
			r: parseInt(result[1], 16),
			g: parseInt(result[2], 16),
			b: parseInt(result[3], 16),
		};
	}

	/**
	 * Check if an undo entry has expired.
	 */
	private isExpired(entry: UndoEntry): boolean {
		const age = Date.now() - entry.capturedAt.getTime();

		return age > this.config.entryTtlMs;
	}

	/**
	 * Clean up expired entries from all stacks.
	 */
	private cleanupExpiredEntries(): void {
		let cleanedCount = 0;

		for (const [spaceId, stack] of this.undoStacks.entries()) {
			// Filter out expired entries
			const validEntries = stack.filter((entry) => !this.isExpired(entry));

			if (validEntries.length !== stack.length) {
				cleanedCount += stack.length - validEntries.length;

				if (validEntries.length === 0) {
					this.undoStacks.delete(spaceId);
				} else {
					this.undoStacks.set(spaceId, validEntries);
				}
			}
		}

		if (cleanedCount > 0) {
			// Intentionally empty - reserved for future logging
		}
	}

	/**
	 * Generate a unique ID for an undo entry.
	 */
	private generateId(): string {
		return `undo-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
	}
}

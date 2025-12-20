import { Injectable, Logger } from '@nestjs/common';

import { IDevicePlatform, IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import {
	DEVICES_WLED_TYPE,
	WLED_CHANNEL_IDENTIFIERS,
	WLED_LIGHT_PROPERTY_IDENTIFIERS,
	WLED_NIGHTLIGHT_PROPERTY_IDENTIFIERS,
	WLED_SEGMENT_PROPERTY_IDENTIFIERS,
	WLED_SYNC_PROPERTY_IDENTIFIERS,
	specBrightnessToWled,
} from '../devices-wled.constants';
import { WledCommandException } from '../devices-wled.exceptions';
import { WledChannelEntity, WledChannelPropertyEntity, WledDeviceEntity } from '../entities/devices-wled.entity';
import { WledNightlightUpdate, WledStateUpdateExtended, WledUdpSyncUpdate } from '../interfaces/wled.interface';
import { WledClientAdapterService } from '../services/wled-client-adapter.service';

export type IWledDevicePropertyData = IDevicePropertyData & {
	device: WledDeviceEntity;
	channel: WledChannelEntity;
	property: WledChannelPropertyEntity;
};

/**
 * WLED Device Platform
 *
 * Handles property write commands by delegating to WLED device API.
 */
@Injectable()
export class WledDevicePlatform implements IDevicePlatform {
	private readonly logger = new Logger(WledDevicePlatform.name);

	constructor(private readonly wledAdapter: WledClientAdapterService) {}

	getType(): string {
		return DEVICES_WLED_TYPE;
	}

	async process({ device, channel, property, value }: IWledDevicePropertyData): Promise<boolean> {
		return this.processBatch([{ device, channel, property, value }]);
	}

	async processBatch(updates: Array<IWledDevicePropertyData>): Promise<boolean> {
		const device = updates[0].device;

		if (!(device instanceof WledDeviceEntity)) {
			this.logger.error('[WLED][PLATFORM] Failed to update device property, invalid device provided');
			return false;
		}

		// Check if device is enabled
		if (!device.enabled) {
			this.logger.debug(`[WLED][PLATFORM] Device ${device.identifier} is disabled, ignoring command`);
			return false;
		}

		// Get the WLED device from the adapter
		const registeredDevice = this.wledAdapter.getDeviceByIdentifier(device.identifier);

		if (!registeredDevice) {
			this.logger.warn(
				`[WLED][PLATFORM] WLED device not found in adapter: ${device.identifier}, device may be offline`,
			);
			return false;
		}

		if (!registeredDevice.connected) {
			this.logger.warn(`[WLED][PLATFORM] WLED device is not connected: ${device.identifier}`);
			return false;
		}

		// Group updates by channel for batch processing
		const byChannel = new Map<
			string,
			{
				channel: WledChannelEntity;
				props: Map<string, { property: WledChannelPropertyEntity; value: string | number | boolean }>;
			}
		>();

		for (const u of updates) {
			const key = u.channel.id;
			let entry = byChannel.get(key);

			if (!entry) {
				entry = {
					channel: u.channel,
					props: new Map(),
				};
				byChannel.set(key, entry);
			}

			entry.props.set(u.property.id, { property: u.property, value: u.value });
		}

		const results: boolean[] = [];

		// Process each channel's property updates
		for (const { channel, props } of byChannel.values()) {
			try {
				const success = await this.executeCommand(device, channel, Array.from(props.values()), registeredDevice.host);
				results.push(success);
			} catch (error) {
				const err = error as Error;

				this.logger.error('[WLED][PLATFORM] Error processing property update', {
					message: err.message,
					stack: err.stack,
				});

				results.push(false);
			}
		}

		// Return true only if all updates succeeded
		const allSucceeded = results.every((r) => r === true);

		if (!allSucceeded) {
			this.logger.warn(`[WLED][PLATFORM] Some properties failed to update for device id=${device.id}`);
		} else {
			this.logger.log(`[WLED][PLATFORM] Successfully processed all property updates for device id=${device.id}`);
		}

		return allSucceeded;
	}

	/**
	 * Execute command on a WLED device based on channel and properties
	 */
	private async executeCommand(
		device: WledDeviceEntity,
		channel: WledChannelEntity,
		propertyUpdates: Array<{ property: WledChannelPropertyEntity; value: string | number | boolean }>,
		host: string,
	): Promise<boolean> {
		const channelId = channel.identifier || '';

		// Handle different channel types
		if (channelId === WLED_CHANNEL_IDENTIFIERS.LIGHT) {
			return this.executeMainLightCommand(device, propertyUpdates, host);
		} else if (channelId === WLED_CHANNEL_IDENTIFIERS.NIGHTLIGHT) {
			return this.executeNightlightCommand(device, propertyUpdates, host);
		} else if (channelId === WLED_CHANNEL_IDENTIFIERS.SYNC) {
			return this.executeSyncCommand(device, propertyUpdates, host);
		} else if (channelId.startsWith(WLED_CHANNEL_IDENTIFIERS.SEGMENT + '_')) {
			// Extract segment ID from channel identifier (e.g., "segment_0" -> 0)
			const segmentId = parseInt(channelId.split('_')[1], 10);
			if (!isNaN(segmentId)) {
				return this.executeSegmentCommand(device, segmentId, propertyUpdates, host);
			}
		}

		this.logger.debug(`[WLED][PLATFORM] Ignoring command for unhandled channel: ${channelId}`);
		return false;
	}

	/**
	 * Execute main light channel command
	 */
	private async executeMainLightCommand(
		device: WledDeviceEntity,
		propertyUpdates: Array<{ property: WledChannelPropertyEntity; value: string | number | boolean }>,
		host: string,
	): Promise<boolean> {
		try {
			// Get current colors from segment 0 to avoid resetting unchanged components
			const registeredDevice = this.wledAdapter.getDevice(host);
			const currentColors = registeredDevice?.context?.state?.segments?.[0]?.colors?.[0] ?? [0, 0, 0];

			const stateUpdate = this.buildMainLightStateUpdate(propertyUpdates, currentColors);

			if (Object.keys(stateUpdate).length === 0) {
				this.logger.debug('[WLED][PLATFORM] No valid properties to update');
				return false;
			}

			this.logger.log(`[WLED][PLATFORM] Sending state update to ${device.identifier}: ${JSON.stringify(stateUpdate)}`);

			const success = await this.wledAdapter.updateStateExtended(host, stateUpdate);

			if (success) {
				this.logger.debug(`[WLED][PLATFORM] Successfully updated device ${device.identifier}`);
			}

			return success;
		} catch (error) {
			throw new WledCommandException(
				device.identifier,
				'main light update',
				error instanceof Error ? error.message : String(error),
			);
		}
	}

	/**
	 * Execute nightlight channel command
	 * Converts spec-compliant values to WLED format (brightness 0-100% -> 0-255)
	 */
	private async executeNightlightCommand(
		device: WledDeviceEntity,
		propertyUpdates: Array<{ property: WledChannelPropertyEntity; value: string | number | boolean }>,
		host: string,
	): Promise<boolean> {
		try {
			const nightlightUpdate: WledNightlightUpdate = {};

			for (const { property, value } of propertyUpdates) {
				switch (property.identifier) {
					case WLED_NIGHTLIGHT_PROPERTY_IDENTIFIERS.ON:
						nightlightUpdate.on = this.coerceBoolean(value);
						break;
					case WLED_NIGHTLIGHT_PROPERTY_IDENTIFIERS.DURATION:
						nightlightUpdate.duration = this.coerceNumber(value, 1, 255);
						break;
					case WLED_NIGHTLIGHT_PROPERTY_IDENTIFIERS.MODE:
						nightlightUpdate.mode = this.coerceNumber(value, 0, 3);
						break;
					case WLED_NIGHTLIGHT_PROPERTY_IDENTIFIERS.TARGET_BRIGHTNESS:
						// Convert spec brightness (0-100%) to WLED brightness (0-255)
						nightlightUpdate.targetBrightness = specBrightnessToWled(this.coerceNumber(value, 0, 100));
						break;
				}
			}

			if (Object.keys(nightlightUpdate).length === 0) {
				return false;
			}

			this.logger.log(`[WLED][PLATFORM] Sending nightlight update to ${device.identifier}`);
			return await this.wledAdapter.setNightlight(host, nightlightUpdate);
		} catch (error) {
			throw new WledCommandException(
				device.identifier,
				'nightlight update',
				error instanceof Error ? error.message : String(error),
			);
		}
	}

	/**
	 * Execute sync channel command
	 */
	private async executeSyncCommand(
		device: WledDeviceEntity,
		propertyUpdates: Array<{ property: WledChannelPropertyEntity; value: string | number | boolean }>,
		host: string,
	): Promise<boolean> {
		try {
			const syncUpdate: WledUdpSyncUpdate = {};

			for (const { property, value } of propertyUpdates) {
				switch (property.identifier) {
					case WLED_SYNC_PROPERTY_IDENTIFIERS.SEND:
						syncUpdate.send = this.coerceBoolean(value);
						break;
					case WLED_SYNC_PROPERTY_IDENTIFIERS.RECEIVE:
						syncUpdate.receive = this.coerceBoolean(value);
						break;
				}
			}

			if (Object.keys(syncUpdate).length === 0) {
				return false;
			}

			this.logger.log(`[WLED][PLATFORM] Sending sync update to ${device.identifier}`);
			return await this.wledAdapter.setUdpSync(host, syncUpdate);
		} catch (error) {
			throw new WledCommandException(
				device.identifier,
				'sync update',
				error instanceof Error ? error.message : String(error),
			);
		}
	}

	/**
	 * Execute segment-specific command
	 * Converts spec-compliant values to WLED format (brightness 0-100% -> 0-255)
	 */
	private async executeSegmentCommand(
		device: WledDeviceEntity,
		segmentId: number,
		propertyUpdates: Array<{ property: WledChannelPropertyEntity; value: string | number | boolean }>,
		host: string,
	): Promise<boolean> {
		try {
			// Get current colors from the segment to avoid resetting unchanged components
			const registeredDevice = this.wledAdapter.getDevice(host);
			const currentSegmentColors = registeredDevice?.context?.state?.segments?.find((s) => s.id === segmentId)
				?.colors?.[0] ?? [0, 0, 0];

			const segmentUpdate: Partial<{
				on: boolean;
				brightness: number;
				colors: number[][];
				effect: number;
				effectSpeed: number;
				effectIntensity: number;
				palette: number;
				reverse: boolean;
				mirror: boolean;
			}> = {};

			let hasColorUpdate = false;
			// Initialize with current colors to avoid resetting unchanged components
			const colors: number[] = [
				currentSegmentColors[0] ?? 0,
				currentSegmentColors[1] ?? 0,
				currentSegmentColors[2] ?? 0,
			];

			for (const { property, value } of propertyUpdates) {
				switch (property.identifier) {
					case WLED_SEGMENT_PROPERTY_IDENTIFIERS.ON:
						segmentUpdate.on = this.coerceBoolean(value);
						break;
					case WLED_SEGMENT_PROPERTY_IDENTIFIERS.BRIGHTNESS:
						// Convert spec brightness (0-100%) to WLED brightness (0-255)
						segmentUpdate.brightness = specBrightnessToWled(this.coerceNumber(value, 0, 100));
						break;
					case WLED_SEGMENT_PROPERTY_IDENTIFIERS.COLOR_RED:
						colors[0] = this.coerceNumber(value, 0, 255);
						hasColorUpdate = true;
						break;
					case WLED_SEGMENT_PROPERTY_IDENTIFIERS.COLOR_GREEN:
						colors[1] = this.coerceNumber(value, 0, 255);
						hasColorUpdate = true;
						break;
					case WLED_SEGMENT_PROPERTY_IDENTIFIERS.COLOR_BLUE:
						colors[2] = this.coerceNumber(value, 0, 255);
						hasColorUpdate = true;
						break;
					case WLED_SEGMENT_PROPERTY_IDENTIFIERS.EFFECT:
						segmentUpdate.effect = this.coerceNumber(value, 0, 255);
						break;
					case WLED_SEGMENT_PROPERTY_IDENTIFIERS.EFFECT_SPEED:
						segmentUpdate.effectSpeed = this.coerceNumber(value, 0, 255);
						break;
					case WLED_SEGMENT_PROPERTY_IDENTIFIERS.EFFECT_INTENSITY:
						segmentUpdate.effectIntensity = this.coerceNumber(value, 0, 255);
						break;
					case WLED_SEGMENT_PROPERTY_IDENTIFIERS.PALETTE:
						segmentUpdate.palette = this.coerceNumber(value, 0, 255);
						break;
					case WLED_SEGMENT_PROPERTY_IDENTIFIERS.REVERSE:
						segmentUpdate.reverse = this.coerceBoolean(value);
						break;
					case WLED_SEGMENT_PROPERTY_IDENTIFIERS.MIRROR:
						segmentUpdate.mirror = this.coerceBoolean(value);
						break;
				}
			}

			if (hasColorUpdate) {
				segmentUpdate.colors = [colors];
			}

			if (Object.keys(segmentUpdate).length === 0) {
				return false;
			}

			this.logger.log(`[WLED][PLATFORM] Sending segment ${segmentId} update to ${device.identifier}`);
			return await this.wledAdapter.updateSegment(host, segmentId, segmentUpdate);
		} catch (error) {
			throw new WledCommandException(
				device.identifier,
				`segment ${segmentId} update`,
				error instanceof Error ? error.message : String(error),
			);
		}
	}

	/**
	 * Build WLED state update from main light property updates
	 * Converts spec-compliant values to WLED format (brightness 0-100% -> 0-255)
	 * @param currentColors Current RGB values to preserve unchanged components
	 */
	private buildMainLightStateUpdate(
		propertyUpdates: Array<{ property: WledChannelPropertyEntity; value: string | number | boolean }>,
		currentColors: number[],
	): WledStateUpdateExtended {
		const stateUpdate: WledStateUpdateExtended = {};
		const segmentUpdate: {
			id: number;
			colors?: number[][];
			effect?: number;
			effectSpeed?: number;
			effectIntensity?: number;
			palette?: number;
		} = { id: 0 };

		let hasColorUpdate = false;
		let hasSegmentUpdate = false;
		// Initialize with current colors to avoid resetting unchanged components
		const colors: number[] = [currentColors[0] ?? 0, currentColors[1] ?? 0, currentColors[2] ?? 0];

		for (const { property, value } of propertyUpdates) {
			switch (property.identifier) {
				case WLED_LIGHT_PROPERTY_IDENTIFIERS.ON:
					stateUpdate.on = this.coerceBoolean(value);
					break;

				case WLED_LIGHT_PROPERTY_IDENTIFIERS.BRIGHTNESS:
					// Convert spec brightness (0-100%) to WLED brightness (0-255)
					stateUpdate.brightness = specBrightnessToWled(this.coerceNumber(value, 0, 100));
					break;

				case WLED_LIGHT_PROPERTY_IDENTIFIERS.COLOR_RED:
					colors[0] = this.coerceNumber(value, 0, 255);
					hasColorUpdate = true;
					break;

				case WLED_LIGHT_PROPERTY_IDENTIFIERS.COLOR_GREEN:
					colors[1] = this.coerceNumber(value, 0, 255);
					hasColorUpdate = true;
					break;

				case WLED_LIGHT_PROPERTY_IDENTIFIERS.COLOR_BLUE:
					colors[2] = this.coerceNumber(value, 0, 255);
					hasColorUpdate = true;
					break;

				case WLED_LIGHT_PROPERTY_IDENTIFIERS.EFFECT:
					segmentUpdate.effect = this.coerceNumber(value, 0, 255);
					hasSegmentUpdate = true;
					break;

				case WLED_LIGHT_PROPERTY_IDENTIFIERS.EFFECT_SPEED:
					segmentUpdate.effectSpeed = this.coerceNumber(value, 0, 255);
					hasSegmentUpdate = true;
					break;

				case WLED_LIGHT_PROPERTY_IDENTIFIERS.EFFECT_INTENSITY:
					segmentUpdate.effectIntensity = this.coerceNumber(value, 0, 255);
					hasSegmentUpdate = true;
					break;

				case WLED_LIGHT_PROPERTY_IDENTIFIERS.PALETTE:
					segmentUpdate.palette = this.coerceNumber(value, 0, 255);
					hasSegmentUpdate = true;
					break;

				case WLED_LIGHT_PROPERTY_IDENTIFIERS.PRESET:
					stateUpdate.preset = this.coerceNumber(value, -1, 250);
					break;

				case WLED_LIGHT_PROPERTY_IDENTIFIERS.LIVE_OVERRIDE:
					stateUpdate.liveOverride = this.coerceNumber(value, 0, 2);
					break;

				default:
					this.logger.debug(`[WLED][PLATFORM] Unknown property: ${property.identifier}, ignoring`);
			}
		}

		// Add color to segment update if any color property was updated
		if (hasColorUpdate) {
			segmentUpdate.colors = [colors];
			hasSegmentUpdate = true;
		}

		// Add segment update to state update if needed
		if (hasSegmentUpdate) {
			stateUpdate.segment = segmentUpdate;
		}

		return stateUpdate;
	}

	/**
	 * Coerce value to boolean
	 */
	private coerceBoolean(value: string | number | boolean): boolean {
		if (typeof value === 'boolean') {
			return value;
		}

		if (typeof value === 'number') {
			return value !== 0;
		}

		const strValue = String(value).toLowerCase();
		return strValue === 'true' || strValue === '1' || strValue === 'on';
	}

	/**
	 * Coerce value to number within range
	 */
	private coerceNumber(value: string | number | boolean, min: number, max: number): number {
		let numValue: number;

		if (typeof value === 'number') {
			numValue = value;
		} else if (typeof value === 'boolean') {
			numValue = value ? 1 : 0;
		} else {
			numValue = parseFloat(String(value));

			if (isNaN(numValue)) {
				numValue = 0;
			}
		}

		return Math.max(min, Math.min(max, Math.round(numValue)));
	}
}

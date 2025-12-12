import { Injectable, Logger } from '@nestjs/common';

import { IDevicePlatform, IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import {
	DEVICES_WLED_TYPE,
	WLED_CHANNEL_IDENTIFIERS,
	WLED_LIGHT_PROPERTY_IDENTIFIERS,
} from '../devices-wled.constants';
import { WledCommandException } from '../devices-wled.exceptions';
import { WledChannelEntity, WledChannelPropertyEntity, WledDeviceEntity } from '../entities/devices-wled.entity';
import { WledStateUpdate } from '../interfaces/wled.interface';
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
		const registeredDevice = this.wledAdapter.getDeviceByIdentifier(device.identifier!);

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
		// Only handle light channel commands
		if (channel.identifier !== WLED_CHANNEL_IDENTIFIERS.LIGHT) {
			this.logger.debug(`[WLED][PLATFORM] Ignoring command for non-light channel: ${channel.identifier}`);
			return false;
		}

		try {
			// Build WLED state update from property updates
			const stateUpdate = this.buildStateUpdate(propertyUpdates);

			if (Object.keys(stateUpdate).length === 0) {
				this.logger.debug('[WLED][PLATFORM] No valid properties to update');
				return false;
			}

			this.logger.log(
				`[WLED][PLATFORM] Sending state update to ${device.identifier}: ${JSON.stringify(stateUpdate)}`,
			);

			// Send the state update to the device
			const success = await this.wledAdapter.updateState(host, stateUpdate, 0); // No debounce for platform commands

			if (success) {
				this.logger.debug(`[WLED][PLATFORM] Successfully updated device ${device.identifier}`);
			}

			return success;
		} catch (error) {
			throw new WledCommandException(
				device.identifier!,
				'state update',
				error instanceof Error ? error.message : String(error),
			);
		}
	}

	/**
	 * Build WLED state update from property updates
	 */
	private buildStateUpdate(
		propertyUpdates: Array<{ property: WledChannelPropertyEntity; value: string | number | boolean }>,
	): WledStateUpdate {
		const stateUpdate: WledStateUpdate = {};
		const segmentUpdate: {
			id: number;
			colors?: number[][];
			effect?: number;
			effectSpeed?: number;
			effectIntensity?: number;
		} = { id: 0 };

		let hasColorUpdate = false;
		let hasSegmentUpdate = false;
		const colors: number[] = [0, 0, 0]; // R, G, B

		for (const { property, value } of propertyUpdates) {
			switch (property.identifier) {
				case WLED_LIGHT_PROPERTY_IDENTIFIERS.STATE:
					stateUpdate.on = this.coerceBoolean(value);
					break;

				case WLED_LIGHT_PROPERTY_IDENTIFIERS.BRIGHTNESS:
					stateUpdate.brightness = this.coerceNumber(value, 0, 255);
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

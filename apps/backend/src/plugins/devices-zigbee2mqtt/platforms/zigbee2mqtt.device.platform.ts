import { Injectable, Logger } from '@nestjs/common';

import { DataTypeType } from '../../../modules/devices/devices.constants';
import { IDevicePlatform, IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import { DEVICES_ZIGBEE2MQTT_TYPE } from '../devices-zigbee2mqtt.constants';
import {
	Zigbee2mqttChannelEntity,
	Zigbee2mqttChannelPropertyEntity,
	Zigbee2mqttDeviceEntity,
} from '../entities/devices-zigbee2mqtt.entity';
import { Z2mSetPayload } from '../interfaces/zigbee2mqtt.interface';
import { Z2mMqttClientAdapterService } from '../services/mqtt-client-adapter.service';

export type IZigbee2mqttDevicePropertyData = IDevicePropertyData & {
	device: Zigbee2mqttDeviceEntity;
	channel: Zigbee2mqttChannelEntity;
	property: Zigbee2mqttChannelPropertyEntity;
};

/**
 * Zigbee2MQTT Device Platform
 *
 * Handles property write commands by publishing to MQTT.
 */
@Injectable()
export class Zigbee2mqttDevicePlatform implements IDevicePlatform {
	private readonly logger = new Logger(Zigbee2mqttDevicePlatform.name);

	constructor(private readonly mqttAdapter: Z2mMqttClientAdapterService) {}

	getType(): string {
		return DEVICES_ZIGBEE2MQTT_TYPE;
	}

	async process({ device, channel, property, value }: IZigbee2mqttDevicePropertyData): Promise<boolean> {
		return this.processBatch([{ device, channel, property, value }]);
	}

	async processBatch(updates: Array<IZigbee2mqttDevicePropertyData>): Promise<boolean> {
		if (updates.length === 0) {
			return true;
		}

		const device = updates[0].device;

		if (!(device instanceof Zigbee2mqttDeviceEntity)) {
			this.logger.error('[Z2M][PLATFORM] Invalid device type provided');
			return false;
		}

		// Check if device is enabled
		if (!device.enabled) {
			this.logger.debug(`[Z2M][PLATFORM] Device ${device.identifier} is disabled, ignoring command`);
			return false;
		}

		// Check if MQTT is connected
		if (!this.mqttAdapter.isConnected()) {
			this.logger.warn('[Z2M][PLATFORM] MQTT not connected, cannot send command');
			return false;
		}

		// Get the friendly name for publishing
		const friendlyName = device.friendlyName;
		if (!friendlyName) {
			this.logger.error(`[Z2M][PLATFORM] Device ${device.identifier} has no friendly name`);
			return false;
		}

		// Group updates by channel for batch processing
		const byChannel = new Map<
			string,
			{
				channel: Zigbee2mqttChannelEntity;
				props: Map<string, { property: Zigbee2mqttChannelPropertyEntity; value: string | number | boolean }>;
			}
		>();

		for (const update of updates) {
			const key = update.channel.id;
			let entry = byChannel.get(key);

			if (!entry) {
				entry = {
					channel: update.channel,
					props: new Map(),
				};
				byChannel.set(key, entry);
			}

			entry.props.set(update.property.id, { property: update.property, value: update.value });
		}

		const results: boolean[] = [];

		// Process each channel's updates
		for (const { channel, props } of byChannel.values()) {
			try {
				const success = await this.executeCommand(device, channel, Array.from(props.values()), friendlyName);
				results.push(success);
			} catch (error) {
				this.logger.error('[Z2M][PLATFORM] Error processing command', {
					message: error instanceof Error ? error.message : String(error),
				});
				results.push(false);
			}
		}

		return results.every((r) => r === true);
	}

	/**
	 * Execute command by publishing to MQTT
	 */
	private async executeCommand(
		device: Zigbee2mqttDeviceEntity,
		channel: Zigbee2mqttChannelEntity,
		propertyUpdates: Array<{ property: Zigbee2mqttChannelPropertyEntity; value: string | number | boolean }>,
		friendlyName: string,
	): Promise<boolean> {
		// Build MQTT payload
		const payload: Z2mSetPayload = {};

		for (const { property, value } of propertyUpdates) {
			const z2mProperty = property.z2mProperty;

			if (!z2mProperty) {
				this.logger.debug(`[Z2M][PLATFORM] Property ${property.identifier} has no z2mProperty mapping, skipping`);
				continue;
			}

			// Convert value to appropriate format
			const convertedValue = this.convertValue(property, value);
			payload[z2mProperty] = convertedValue;
		}

		if (Object.keys(payload).length === 0) {
			this.logger.debug('[Z2M][PLATFORM] No valid properties to update');
			return false;
		}

		this.logger.log(`[Z2M][PLATFORM] Sending command to ${friendlyName}: ${JSON.stringify(payload)}`);

		const success = await this.mqttAdapter.publishCommand(friendlyName, payload);

		if (success) {
			this.logger.debug(`[Z2M][PLATFORM] Command sent successfully to ${friendlyName}`);
		} else {
			this.logger.warn(`[Z2M][PLATFORM] Failed to send command to ${friendlyName}`);
		}

		return success;
	}

	/**
	 * Convert value to appropriate format for Z2M
	 */
	private convertValue(
		property: Zigbee2mqttChannelPropertyEntity,
		value: string | number | boolean,
	): string | number | boolean | Record<string, unknown> {
		// Check if property has special format (e.g., ON/OFF values for binary)
		const format = property.format;

		if (format && Array.isArray(format) && format.length === 2) {
			// Binary with custom on/off values
			if (typeof format[0] === 'string' && typeof format[1] === 'string') {
				const boolValue = this.coerceBoolean(value);
				return boolValue ? format[0] : format[1];
			}
		}

		// Handle special property types
		const z2mProperty = property.z2mProperty;

		if (z2mProperty === 'state') {
			// Convert boolean to ON/OFF
			const boolValue = this.coerceBoolean(value);
			return boolValue ? 'ON' : 'OFF';
		}

		if (z2mProperty === 'brightness') {
			// Ensure brightness is within range
			return this.coerceNumber(value, 0, 254);
		}

		if (z2mProperty === 'color_temp') {
			// Color temperature as number
			return this.coerceNumber(value, 150, 500);
		}

		if (z2mProperty?.startsWith('color')) {
			// Try to parse color value
			if (typeof value === 'string' && value.startsWith('{')) {
				try {
					return JSON.parse(value) as Record<string, unknown>;
				} catch {
					// Return as-is
				}
			}
		}

		// Return value as-is for most cases
		if (typeof value === 'boolean') {
			return value;
		}
		if (typeof value === 'number') {
			return value;
		}
		if (typeof value === 'string') {
			// Try to parse as number if appropriate
			const num = parseFloat(value);
			if (!isNaN(num) && property.dataType !== DataTypeType.STRING) {
				return num;
			}
			// Try to parse as boolean
			if (value.toLowerCase() === 'true' || value.toLowerCase() === 'on') {
				return true;
			}
			if (value.toLowerCase() === 'false' || value.toLowerCase() === 'off') {
				return false;
			}
		}

		return value;
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
			numValue = value ? max : min;
		} else {
			numValue = parseFloat(String(value));
			if (isNaN(numValue)) {
				numValue = min;
			}
		}

		return Math.max(min, Math.min(max, Math.round(numValue)));
	}
}

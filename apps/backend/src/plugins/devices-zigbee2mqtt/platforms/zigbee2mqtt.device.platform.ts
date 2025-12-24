import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { DataTypeType, PropertyCategory } from '../../../modules/devices/devices.constants';
import { IDevicePlatform, IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import { DEVICES_ZIGBEE2MQTT_PLUGIN_NAME, DEVICES_ZIGBEE2MQTT_TYPE } from '../devices-zigbee2mqtt.constants';
import {
	Zigbee2mqttChannelEntity,
	Zigbee2mqttChannelPropertyEntity,
	Zigbee2mqttDeviceEntity,
} from '../entities/devices-zigbee2mqtt.entity';
import { Z2mSetPayload } from '../interfaces/zigbee2mqtt.interface';
import { Z2mMqttClientAdapterService } from '../services/mqtt-client-adapter.service';
import { Z2mVirtualPropertyService } from '../services/virtual-property.service';

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
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_ZIGBEE2MQTT_PLUGIN_NAME,
		'DevicePlatform',
	);

	constructor(
		private readonly mqttAdapter: Z2mMqttClientAdapterService,
		private readonly virtualPropertyService: Z2mVirtualPropertyService,
	) {}

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

		// Check if MQTT is connected
		if (!this.mqttAdapter.isConnected()) {
			this.logger.warn('MQTT not connected, cannot send command');
			return false;
		}

		// Group updates by device first, then by channel
		const byDevice = new Map<
			string,
			{
				device: Zigbee2mqttDeviceEntity;
				channels: Map<
					string,
					{
						channel: Zigbee2mqttChannelEntity;
						props: Map<string, { property: Zigbee2mqttChannelPropertyEntity; value: string | number | boolean }>;
					}
				>;
			}
		>();

		for (const update of updates) {
			const device = update.device;

			if (!(device instanceof Zigbee2mqttDeviceEntity)) {
				this.logger.error('Invalid device type provided');
				continue;
			}

			const deviceKey = device.id;
			let deviceEntry = byDevice.get(deviceKey);

			if (!deviceEntry) {
				deviceEntry = {
					device,
					channels: new Map(),
				};
				byDevice.set(deviceKey, deviceEntry);
			}

			const channelKey = update.channel.id;
			let channelEntry = deviceEntry.channels.get(channelKey);

			if (!channelEntry) {
				channelEntry = {
					channel: update.channel,
					props: new Map(),
				};
				deviceEntry.channels.set(channelKey, channelEntry);
			}

			channelEntry.props.set(update.property.id, { property: update.property, value: update.value });
		}

		const results: boolean[] = [];

		// Process each device's updates
		for (const { device, channels } of byDevice.values()) {
			// Check if device is enabled
			if (!device.enabled) {
				this.logger.debug(`Device ${device.identifier} is disabled, ignoring command`);
				results.push(false);
				continue;
			}

			// Device identifier = friendly_name (used for MQTT topic)
			const friendlyName = device.identifier;

			// Process each channel's updates for this device
			for (const { channel, props } of channels.values()) {
				try {
					const success = await this.executeCommand(device, channel, Array.from(props.values()), friendlyName);
					results.push(success);
				} catch (error) {
					this.logger.error('Error processing command', {
						message: error instanceof Error ? error.message : String(error),
					});
					results.push(false);
				}
			}
		}

		return results.length > 0 && results.every((r) => r === true);
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

		// Track color components for batching into a single color object
		let colorHue: number | undefined;
		let colorSaturation: number | undefined;

		for (const { property, value } of propertyUpdates) {
			// Check if this is a virtual command property
			if (property.identifier.startsWith('fb_virtual_')) {
				// Extract property category from identifier (e.g., fb_virtual_command -> COMMAND)
				const categoryStr = property.identifier.replace('fb_virtual_', '').toUpperCase();
				const propertyCategory = PropertyCategory[categoryStr as keyof typeof PropertyCategory];

				if (propertyCategory) {
					// Get command translation
					const translation = this.virtualPropertyService.getCommandTranslation(
						channel.category,
						propertyCategory,
						value,
					);

					if (translation) {
						this.logger.debug(
							`Translating virtual command: ${property.identifier}=${value} -> ${translation.targetProperty}=${translation.translatedValue}`,
						);
						payload[translation.targetProperty] = translation.translatedValue;
						continue;
					} else {
						this.logger.warn(`No translation found for virtual command: ${property.identifier}=${value}`);
					}
				}
				// Skip virtual properties we can't translate
				continue;
			}

			// Handle color properties - collect them for batching
			if (property.category === PropertyCategory.HUE) {
				colorHue = this.coerceNumber(value, 0, 360);
				continue;
			}
			if (property.category === PropertyCategory.SATURATION) {
				colorSaturation = this.coerceNumber(value, 0, 100);
				continue;
			}

			// Regular property - identifier = z2m property name
			const z2mProperty = property.identifier;

			// Convert value to appropriate format
			const convertedValue = this.convertValue(property, value);
			payload[z2mProperty] = convertedValue;
		}

		// Build color object if any color components were set
		if (colorHue !== undefined || colorSaturation !== undefined) {
			const colorPayload: Record<string, number> = {};
			if (colorHue !== undefined) {
				colorPayload.hue = colorHue;
			}
			if (colorSaturation !== undefined) {
				colorPayload.saturation = colorSaturation;
			}
			payload.color = colorPayload;
			this.logger.debug(`Building color payload: ${JSON.stringify(colorPayload)}`);
		}

		if (Object.keys(payload).length === 0) {
			this.logger.debug('No valid properties to update');
			return false;
		}

		this.logger.log(`Sending command to ${friendlyName}: ${JSON.stringify(payload)}`);

		const success = await this.mqttAdapter.publishCommand(friendlyName, payload);

		if (success) {
			this.logger.debug(`Command sent successfully to ${friendlyName}`);
		} else {
			this.logger.warn(`Failed to send command to ${friendlyName}`);
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
		// Handle special property types by category FIRST
		// This must happen before format check to ensure proper range conversion

		// Brightness: convert from spec range (0-100%) to Z2M range (0-254)
		if (property.category === PropertyCategory.BRIGHTNESS) {
			const percentage = this.coerceNumber(value, 0, 100);
			const z2mValue = Math.round((percentage / 100) * 254);
			this.logger.debug(`Converting brightness: ${percentage}% -> ${z2mValue} (Z2M range)`);
			return z2mValue;
		}

		// Color temperature: convert from spec Kelvin to Z2M mired
		// Conversion: mired = 1,000,000 / Kelvin
		if (property.category === PropertyCategory.COLOR_TEMPERATURE) {
			// Get device-specific Kelvin range from property format
			const propFormat = property.format;
			const minKelvin = Array.isArray(propFormat) && typeof propFormat[0] === 'number' ? propFormat[0] : 2000;
			const maxKelvin = Array.isArray(propFormat) && typeof propFormat[1] === 'number' ? propFormat[1] : 6500;

			const kelvin = this.coerceNumber(value, minKelvin, maxKelvin);
			const mired = Math.round(1000000 / kelvin);
			this.logger.debug(`Converting color_temp: ${kelvin} K -> ${mired} mired`);
			return mired;
		}

		// Check if property has special format (e.g., ON/OFF values for binary, or [min, max] for numeric)
		const format = property.format;

		if (format && Array.isArray(format) && format.length === 2) {
			// Binary with custom on/off values
			if (typeof format[0] === 'string' && typeof format[1] === 'string') {
				const boolValue = this.coerceBoolean(value);
				return boolValue ? format[0] : format[1];
			}
			// Numeric with [min, max] range
			if (typeof format[0] === 'number' && typeof format[1] === 'number') {
				return this.coerceNumber(value, format[0], format[1]);
			}
		}

		// Handle special property types by identifier
		const z2mProperty = property.identifier;

		if (z2mProperty === 'state') {
			// Convert boolean to ON/OFF
			const boolValue = this.coerceBoolean(value);
			return boolValue ? 'ON' : 'OFF';
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

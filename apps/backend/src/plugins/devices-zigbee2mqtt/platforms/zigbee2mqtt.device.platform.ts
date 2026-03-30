import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { PropertyCategory } from '../../../modules/devices/devices.constants';
import { IDevicePlatform, IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import { DEVICES_ZIGBEE2MQTT_PLUGIN_NAME, DEVICES_ZIGBEE2MQTT_TYPE } from '../devices-zigbee2mqtt.constants';
import {
	Zigbee2mqttChannelEntity,
	Zigbee2mqttChannelPropertyEntity,
	Zigbee2mqttDeviceEntity,
} from '../entities/devices-zigbee2mqtt.entity';
import { Z2mSetPayload } from '../interfaces/zigbee2mqtt.interface';
import { ConfigDrivenConverter } from '../mappings/config-driven.converter';
import { Z2mBaseClientAdapter } from '../services/base-client-adapter';
import { Z2mDeviceMapperService } from '../services/device-mapper.service';
import { Z2mVirtualPropertyService } from '../services/virtual-property.service';
import { Zigbee2mqttService } from '../services/zigbee2mqtt.service';

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
		private readonly zigbee2mqttService: Zigbee2mqttService,
		private readonly virtualPropertyService: Z2mVirtualPropertyService,
		private readonly configDrivenConverter: ConfigDrivenConverter,
		private readonly deviceMapper: Z2mDeviceMapperService,
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

		// Check if adapter is connected
		const adapter = this.zigbee2mqttService.getActiveAdapter();

		if (!adapter.isConnected()) {
			this.logger.warn('Not connected to Zigbee2MQTT, cannot send command');
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
				results.push(false);
				continue;
			}

			// Device identifier = friendly_name (used for MQTT topic)
			const friendlyName = device.identifier;

			// Process each channel's updates for this device
			for (const { channel, props } of channels.values()) {
				try {
					const success = await this.executeCommand(adapter, device, channel, Array.from(props.values()), friendlyName);
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
		adapter: Z2mBaseClientAdapter,
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

			// First try device-specific transformer (registered during adoption from YAML mappings)
			const deviceSpecificTransform = this.deviceMapper.transformWriteValue(property.id, value);

			let z2mProperty: string;
			let convertedValue: string | number | boolean | Record<string, unknown>;

			if (deviceSpecificTransform) {
				// Use the device-specific transformer (e.g., for IKEA air purifier fan mode)
				z2mProperty = deviceSpecificTransform.z2mProperty;
				const transformedValue = deviceSpecificTransform.transformedValue;
				convertedValue =
					typeof transformedValue === 'object' && transformedValue !== null
						? (transformedValue as Record<string, unknown>)
						: (transformedValue as string | number | boolean);
			} else {
				// Fall back to generic write mapping from YAML
				const writeMapping = this.configDrivenConverter.getWriteMapping(channel.category, property.category);

				if (writeMapping) {
					// Use the mapping's z2mProperty and apply the write transformer
					z2mProperty = writeMapping.z2mProperty;
					const transformedValue = writeMapping.transformer.write(value);
					convertedValue =
						typeof transformedValue === 'object' && transformedValue !== null
							? (transformedValue as Record<string, unknown>)
							: (transformedValue as string | number | boolean);
				} else {
					this.logger.warn(
						`No write mapping found for channel=${channel.category} property=${property.category} (${property.identifier}), skipping`,
					);
					continue;
				}
			}

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
		}

		if (Object.keys(payload).length === 0) {
			return false;
		}

		this.logger.log(`Sending command to ${friendlyName}: ${JSON.stringify(payload)}`);

		const success = await adapter.publishCommand(friendlyName, payload);

		if (!success) {
			this.logger.warn(`Failed to send command to ${friendlyName}`);
		}

		return success;
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

import { Injectable, Logger } from '@nestjs/common';

import { coerceBooleanSafe, coerceNumberSafe } from '../../../common/utils/transform.utils';
import { IDevicePlatform, IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import { DESCRIPTORS, DEVICES_SHELLY_V1_TYPE, PropertyBinding } from '../devices-shelly-v1.constants';
import { DevicesShellyV1Exception } from '../devices-shelly-v1.exceptions';
import {
	ShellyV1ChannelEntity,
	ShellyV1ChannelPropertyEntity,
	ShellyV1DeviceEntity,
} from '../entities/devices-shelly-v1.entity';
import { ShellyColorOptions, ShellyDevice } from '../interfaces/shellies.interface';
import { ShelliesAdapterService } from '../services/shellies-adapter.service';
import { ROLLER_COMMAND_VALUE_MAP, validateEnumValue } from '../utils/value-mapping.utils';

export type IShellyV1DevicePropertyData = IDevicePropertyData & {
	device: ShellyV1DeviceEntity;
	channel: ShellyV1ChannelEntity;
	property: ShellyV1ChannelPropertyEntity;
};

/**
 * Device platform for Shelly V1 devices
 * Handles property write commands by delegating to Shelly device setters
 */
@Injectable()
export class ShellyV1DevicePlatform implements IDevicePlatform {
	private readonly logger = new Logger(ShellyV1DevicePlatform.name);

	constructor(private readonly shelliesAdapter: ShelliesAdapterService) {}

	getType(): string {
		return DEVICES_SHELLY_V1_TYPE;
	}

	async process({ device, channel, property, value }: IShellyV1DevicePropertyData): Promise<boolean> {
		return this.processBatch([{ device, channel, property, value }]);
	}

	async processBatch(updates: Array<IShellyV1DevicePropertyData>): Promise<boolean> {
		const device = updates[0].device;

		if (!(device instanceof ShellyV1DeviceEntity)) {
			this.logger.error('[SHELLY V1][PLATFORM] Failed to update device property, invalid device provided');

			return false;
		}

		// Check if a device is enabled
		if (!device.enabled) {
			this.logger.debug(`[SHELLY V1][PLATFORM] Device ${device.identifier} is disabled, ignoring command`);

			return false;
		}

		// Get the Shelly device instance from the adapter
		const shellyDevice = this.shelliesAdapter.getDevice(device.identifier.split('-')[0], device.identifier);

		if (!shellyDevice) {
			this.logger.warn(
				`[SHELLY V1][PLATFORM] Shelly device not found in adapter: ${device.identifier}, device may be offline`,
			);

			return false;
		}

		// Group updates by channel for batch processing
		const byChannel = new Map<
			string,
			{
				channel: ShellyV1ChannelEntity;
				props: Map<string | number, { property: ShellyV1ChannelPropertyEntity; value: string | number | boolean }>;
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
				const success = await this.executeCommand(device, channel, Array.from(props.values()), shellyDevice);

				results.push(success);
			} catch (error) {
				const err = error as Error;

				this.logger.error('[SHELLY V1][PLATFORM] Error processing property update', {
					message: err.message,
					stack: err.stack,
				});

				results.push(false);
			}
		}

		// Return true only if all updates succeeded
		const allSucceeded = results.every((r) => r === true);

		if (!allSucceeded) {
			this.logger.warn(`[SHELLY V1][PLATFORM] Some properties failed to update for device id=${device.id}`);
		} else {
			this.logger.log(`[SHELLY V1][PLATFORM] Successfully processed all property updates for device id=${device.id}`);
		}

		return allSucceeded;
	}

	/**
	 * Execute command on a Shelly device based on a channel and properties
	 */
	private async executeCommand(
		device: ShellyV1DeviceEntity,
		channel: ShellyV1ChannelEntity,
		propertyUpdates: Array<{ property: ShellyV1ChannelPropertyEntity; value: string | number | boolean }>,
		shellyDevice: ShellyDevice,
	): Promise<boolean> {
		// Find the device descriptor
		const descriptor = this.findDescriptor(shellyDevice.type);

		if (!descriptor) {
			this.logger.warn(`[SHELLY V1][PLATFORM] No descriptor found for device type: ${shellyDevice.type}`);

			return false;
		}

		// Get bindings for this device (considering mode if applicable)
		const bindings = this.getBindings(descriptor, shellyDevice);

		if (!bindings || bindings.length === 0) {
			this.logger.debug(
				`[SHELLY V1][PLATFORM] No bindings found for device ${device.identifier}, cannot execute command`,
			);

			return false;
		}

		// Determine the command type based on a channel identifier pattern
		const relayMatch = channel.identifier.match(/^relay_(\d+)$/);
		const lightMatch = channel.identifier.match(/^light_(\d+)$/);
		const rollerMatch = channel.identifier.match(/^roller_(\d+)$/);

		try {
			if (relayMatch) {
				// Relay command
				return await this.executeRelayCommand(device, shellyDevice, parseInt(relayMatch[1], 10), propertyUpdates);
			} else if (lightMatch) {
				// Light command
				return await this.executeLightCommand(
					device,
					shellyDevice,
					parseInt(lightMatch[1], 10),
					propertyUpdates,
					descriptor,
				);
			} else if (rollerMatch) {
				// Roller command
				return await this.executeRollerCommand(device, shellyDevice, parseInt(rollerMatch[1], 10), propertyUpdates);
			} else {
				this.logger.debug(`[SHELLY V1][PLATFORM] Unknown channel type for command: ${channel.identifier}, ignoring`);

				return false;
			}
		} catch (error) {
			throw new DevicesShellyV1Exception(
				`Failed to execute command on device ${device.identifier}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Execute relay command (on/off)
	 */
	private async executeRelayCommand(
		device: ShellyV1DeviceEntity,
		shellyDevice: ShellyDevice,
		index: number,
		propertyUpdates: Array<{ property: ShellyV1ChannelPropertyEntity; value: string | number | boolean }>,
	): Promise<boolean> {
		if (!shellyDevice.setRelay) {
			this.logger.warn(`[SHELLY V1][PLATFORM] Device ${device.identifier} does not support setRelay method`);

			return false;
		}

		// Find the state property
		const stateUpdate = propertyUpdates.find((u) => u.property.identifier === 'state');

		if (!stateUpdate) {
			this.logger.debug(`[SHELLY V1][PLATFORM] No state property found in relay command`);

			return false;
		}

		const boolValue = coerceBooleanSafe(stateUpdate.value);

		this.logger.log(
			`[SHELLY V1][PLATFORM] Setting relay ${index} to ${boolValue ? 'ON' : 'OFF'} on device ${device.identifier}`,
		);

		await shellyDevice.setRelay(index, boolValue);

		this.logger.debug(`[SHELLY V1][PLATFORM] Successfully set relay ${index} on device ${device.identifier}`);

		return true;
	}

	/**
	 * Execute light command (on/off, brightness, color)
	 */
	private async executeLightCommand(
		device: ShellyV1DeviceEntity,
		shellyDevice: ShellyDevice,
		index: number,
		propertyUpdates: Array<{ property: ShellyV1ChannelPropertyEntity; value: string | number | boolean }>,
		descriptor: (typeof DESCRIPTORS)[keyof typeof DESCRIPTORS],
	): Promise<boolean> {
		// Collect property values
		const values: {
			state?: boolean;
			brightness?: number;
			temperature?: number;
			red?: number;
			green?: number;
			blue?: number;
			white?: number;
			gain?: number;
		} = {};
		let hasColorProperties = false;
		let hasWhiteProperties = false;

		for (const { property, value } of propertyUpdates) {
			switch (property.identifier) {
				case 'state':
					values.state = coerceBooleanSafe(value);

					break;

				case 'brightness':
					values.brightness = coerceNumberSafe(value, { clamp: { min: 0, max: 100 } }) ?? 0;
					hasWhiteProperties = true;

					break;

				case 'color_temperature':
					values.temperature = coerceNumberSafe(value, { clamp: { min: 2700, max: 6500 } }) ?? 3000;
					hasWhiteProperties = true;

					break;

				case 'red':
					values.red = coerceNumberSafe(value, { clamp: { min: 0, max: 255 } }) ?? 0;
					hasColorProperties = true;

					break;

				case 'green':
					values.green = coerceNumberSafe(value, { clamp: { min: 0, max: 255 } }) ?? 0;
					hasColorProperties = true;

					break;

				case 'blue':
					values.blue = coerceNumberSafe(value, { clamp: { min: 0, max: 255 } }) ?? 0;
					hasColorProperties = true;

					break;

				case 'white':
					values.white = coerceNumberSafe(value, { clamp: { min: 0, max: 255 } }) ?? 0;
					hasColorProperties = true;

					break;

				case 'gain':
					values.gain = coerceNumberSafe(value, { clamp: { min: 0, max: 100 } }) ?? 0;
					hasColorProperties = true;

					break;

				default:
					this.logger.debug(`[SHELLY V1][PLATFORM] Unknown light property: ${property.identifier}, ignoring`);
			}
		}

		// Execute the appropriate command(s) based on properties
		// Both color and white commands can be in the same batch
		let executed = false;

		if (hasColorProperties) {
			// RGB/RGBW color mode
			if (!shellyDevice.setColor) {
				this.logger.warn(`[SHELLY V1][PLATFORM] Device ${device.identifier} does not support setColor method`);
			} else {
				const colorOpts: ShellyColorOptions = {};

				if (values.state !== undefined) {
					colorOpts.switch = values.state;
				}

				if (values.red !== undefined) {
					colorOpts.red = values.red;
				}

				if (values.green !== undefined) {
					colorOpts.green = values.green;
				}

				if (values.blue !== undefined) {
					colorOpts.blue = values.blue;
				}

				if (values.white !== undefined) {
					colorOpts.white = values.white;
				}

				if (values.gain !== undefined) {
					colorOpts.gain = values.gain;
				}

				this.logger.log(
					`[SHELLY V1][PLATFORM] Setting light ${index} color with options ${JSON.stringify(colorOpts)} on device ${device.identifier}`,
				);

				await shellyDevice.setColor(colorOpts);
				executed = true;
			}
		}

		if (hasWhiteProperties) {
			// White/brightness mode
			if (!shellyDevice.setWhite) {
				this.logger.warn(`[SHELLY V1][PLATFORM] Device ${device.identifier} does not support setWhite method`);
			} else {
				// Use current device values as defaults if not provided in the command
				const currentBrightness = shellyDevice[`brightness${index}`] ?? shellyDevice['brightness'];
				const currentSwitch = shellyDevice[`switch${index}`] ?? shellyDevice['switch'];

				const brightness = values.brightness ?? (typeof currentBrightness === 'number' ? currentBrightness : 100);
				const on = values.state ?? (typeof currentSwitch === 'boolean' ? currentSwitch : true);

				// Check if a device has multi-channel lights
				const isMultiChannel = descriptor.instance?.multiChannelLights ?? false;

				// Check if a device supports color temperature
				if (values.temperature !== undefined) {
					// Device with temperature control: setWhite(temperature, brightness, on)
					const temperature = values.temperature;

					this.logger.log(
						`[SHELLY V1][PLATFORM] Setting light ${index} white with temperature (temp=${temperature}, brightness=${brightness}, on=${on}) on device ${device.identifier}`,
					);

					await shellyDevice.setWhite(temperature, brightness, on);
				} else if (isMultiChannel) {
					// Multi-channel device without temperature: setWhite(index, brightness, on)
					this.logger.log(
						`[SHELLY V1][PLATFORM] Setting light ${index} white multi-channel (index=${index}, brightness=${brightness}, on=${on}) on device ${device.identifier}`,
					);

					await shellyDevice.setWhite(index, brightness, on);
				} else {
					// Single-channel device without temperature: setWhite(brightness, on)
					this.logger.log(
						`[SHELLY V1][PLATFORM] Setting light white single-channel (brightness=${brightness}, on=${on}) on device ${device.identifier}`,
					);

					await shellyDevice.setWhite(brightness, on);
				}

				executed = true;
			}
		}

		if (!executed && values.state !== undefined) {
			// Only state change, try setColor first, then setWhite
			if (shellyDevice.setColor) {
				this.logger.log(
					`[SHELLY V1][PLATFORM] Setting light ${index} state to ${values.state ? 'ON' : 'OFF'} on device ${device.identifier}`,
				);

				await shellyDevice.setColor({ switch: values.state });
				executed = true;
			} else if (shellyDevice.setWhite) {
				// Check if a device has multi-channel lights
				const isMultiChannel = descriptor.instance?.multiChannelLights ?? false;

				// Use current brightness from device or fallback to 100
				const currentBrightness = shellyDevice[`brightness${index}`] ?? shellyDevice['brightness'];
				const brightness = typeof currentBrightness === 'number' ? currentBrightness : 100;

				this.logger.log(
					`[SHELLY V1][PLATFORM] Setting light ${index} state to ${values.state ? 'ON' : 'OFF'} on device ${device.identifier}`,
				);

				if (isMultiChannel) {
					// Multi-channel: use index signature
					await shellyDevice.setWhite(index, brightness, values.state);
				} else {
					// Single-channel: use a simple signature
					await shellyDevice.setWhite(brightness, values.state);
				}

				executed = true;
			}
		}

		if (!executed) {
			this.logger.warn(
				`[SHELLY V1][PLATFORM] No recognized light properties to update or methods not supported for device ${device.identifier}`,
			);

			return false;
		}

		this.logger.debug(`[SHELLY V1][PLATFORM] Successfully set light ${index} on device ${device.identifier}`);

		return true;
	}

	/**
	 * Execute roller command (open/close/stop/position)
	 */
	private async executeRollerCommand(
		device: ShellyV1DeviceEntity,
		shellyDevice: ShellyDevice,
		index: number,
		propertyUpdates: Array<{ property: ShellyV1ChannelPropertyEntity; value: string | number | boolean }>,
	): Promise<boolean> {
		if (!shellyDevice.setRoller) {
			this.logger.warn(`[SHELLY V1][PLATFORM] Device ${device.identifier} does not support setRoller method`);

			return false;
		}

		// Process each property update (position or command)
		for (const { property, value } of propertyUpdates) {
			if (property.identifier === 'position') {
				// Set position (0-100)
				const position = coerceNumberSafe(value, { clamp: { min: 0, max: 100 } }) ?? 0;

				this.logger.log(
					`[SHELLY V1][PLATFORM] Setting roller ${index} to position ${position}% on device ${device.identifier}`,
				);

				await shellyDevice.setRollerPosition(position);
			} else if (property.identifier === 'command') {
				// Execute command (open/close/stop)
				const command = String(value).toLowerCase();

				// Validate command is in the allowed format (ENUM validation)
				const allowedCommands = Object.keys(ROLLER_COMMAND_VALUE_MAP);

				if (!validateEnumValue(command, allowedCommands, 'roller command')) {
					this.logger.warn(
						`[SHELLY V1][PLATFORM] Invalid roller command: ${command}, must be one of: ${allowedCommands.join(', ')}`,
					);

					return false;
				}

				this.logger.log(
					`[SHELLY V1][PLATFORM] Executing roller ${index} command ${command} on device ${device.identifier}`,
				);

				// For roller commands, canonical values match raw values (open/close/stop)
				// No reverse mapping needed
				await shellyDevice.setRollerState(command);
			} else {
				this.logger.debug(`[SHELLY V1][PLATFORM] Unknown roller property: ${property.identifier}, ignoring`);
			}
		}

		this.logger.debug(
			`[SHELLY V1][PLATFORM] Successfully executed roller ${index} command on device ${device.identifier}`,
		);

		return true;
	}

	/**
	 * Find a descriptor for a device type
	 */
	private findDescriptor(deviceType: string): (typeof DESCRIPTORS)[keyof typeof DESCRIPTORS] | null {
		for (const descriptor of Object.values(DESCRIPTORS)) {
			if (descriptor.models.some((model) => deviceType.toUpperCase().includes(model))) {
				return descriptor;
			}
		}

		return null;
	}

	/**
	 * Get bindings for a device considering mode
	 */
	private getBindings(
		descriptor: (typeof DESCRIPTORS)[keyof typeof DESCRIPTORS],
		shellyDevice: ShellyDevice,
	): PropertyBinding[] {
		if (descriptor.instance?.modeProperty && descriptor.modes) {
			const modeValue = shellyDevice[descriptor.instance.modeProperty];
			const modeProfile = descriptor.modes.find((mode) => mode.modeValue === modeValue);

			if (modeProfile) {
				return modeProfile.bindings;
			}

			return [];
		}

		return descriptor.bindings || [];
	}
}

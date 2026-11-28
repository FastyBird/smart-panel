import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { coerceBooleanSafe, coerceNumberSafe } from '../../../common/utils/transform.utils';
import {
	IDevicePlatform,
	IDevicePropertyData,
	PropertyReadRequest,
} from '../../../modules/devices/platforms/device.platform';
import {
	DEVICES_SHELLY_V1_PLUGIN_NAME,
	DEVICES_SHELLY_V1_TYPE,
	DeviceDescriptor,
} from '../devices-shelly-v1.constants';
import { DevicesShellyV1Exception } from '../devices-shelly-v1.exceptions';
import {
	ShellyV1ChannelEntity,
	ShellyV1ChannelPropertyEntity,
	ShellyV1DeviceEntity,
} from '../entities/devices-shelly-v1.entity';
import { RegisteredDevice, ShellyColorOptions, ShellyDevice } from '../interfaces/shellies.interface';
import { ShelliesAdapterService } from '../services/shellies-adapter.service';
import {
	ShellyV1AdoptedIdentityService,
	shellyV1Address,
	shellyV1PinMatches,
	shellyV1RegistrationMatchesPin,
	shellyV1ReportedMac,
} from '../services/shelly-v1-adopted-identity.service';
import { ShellyV1HttpClientService } from '../services/shelly-v1-http-client.service';
import { ShellyV1PropertyReportsService } from '../services/shelly-v1-property-reports.service';
import { findShellyV1Descriptor, getShellyV1Bindings } from '../utils/descriptor.utils';
import { ROLLER_COMMAND_VALUE_MAP, validateEnumValue } from '../utils/value-mapping.utils';

export type IShellyV1DevicePropertyData = IDevicePropertyData & {
	device: ShellyV1DeviceEntity;
	channel: ShellyV1ChannelEntity;
	property: ShellyV1ChannelPropertyEntity;
};

type CommandTarget = { peer: ShellyDevice; registration: RegisteredDevice; host: string; isCurrent: () => boolean };

/**
 * Device platform for Shelly V1 devices
 * Handles property write commands by delegating to Shelly device setters
 */
@Injectable()
export class ShellyV1DevicePlatform implements IDevicePlatform {
	/** Ordinary v1 control has no qualified device-side lease or release ordering evidence. */
	getProtectiveReadiness(): { supported: false; reasons: readonly string[] } {
		return { supported: false, reasons: ['unsupported_protective_protocol'] };
	}

	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_SHELLY_V1_PLUGIN_NAME,
		'ShellyV1DevicePlatform',
	);

	constructor(
		private readonly shelliesAdapter: ShelliesAdapterService,
		private readonly reports: ShellyV1PropertyReportsService,
		private readonly identities: ShellyV1AdoptedIdentityService,
		private readonly http: ShellyV1HttpClientService,
	) {}

	requestPropertyRead(request: PropertyReadRequest): Promise<boolean> {
		if (!(request.device instanceof ShellyV1DeviceEntity)) return Promise.resolve(false);
		return this.reports.read(request.device, request);
	}

	getType(): string {
		return DEVICES_SHELLY_V1_TYPE;
	}

	async process({ device, channel, property, value }: IShellyV1DevicePropertyData): Promise<boolean> {
		return this.processBatch([{ device, channel, property, value }]);
	}

	async processBatch(updates: Array<IShellyV1DevicePropertyData>): Promise<boolean> {
		const device = updates[0].device;

		if (!(device instanceof ShellyV1DeviceEntity)) {
			this.logger.error('Failed to update device property, invalid device provided');

			return false;
		}

		// Check if a device is enabled
		if (!device.enabled) {
			return false;
		}

		// Get the Shelly device instance from the adapter
		const registered = this.shelliesAdapter.getRegisteredDeviceForCatalog(device);
		const shellyDevice = registered?.enabled && this.shelliesAdapter.getDevice(registered.type, registered.id);

		if (!shellyDevice) {
			this.logger.warn(`Shelly device not found in adapter: ${device.identifier}, device may be offline`, {
				resource: device.id,
			});

			return false;
		}
		const { id, type, host, catalog } = registered;
		const target: CommandTarget = {
			peer: shellyDevice,
			registration: registered,
			host,
			isCurrent: () =>
				!!host &&
				device.enabled &&
				registered.enabled &&
				registered.id === id &&
				registered.type === type &&
				registered.host === host &&
				registered.catalog === catalog &&
				shellyDevice.id === id &&
				shellyDevice.type === type &&
				shellyDevice.host === host &&
				this.shelliesAdapter.getRegisteredDeviceForCatalog(device) === registered &&
				this.shelliesAdapter.getDevice(type, id) === shellyDevice,
		};

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
				const success = await this.executeCommand(device, channel, Array.from(props.values()), target);

				results.push(success);
			} catch (error) {
				const err = error as Error;

				this.logger.error('Error processing property update', {
					resource: device.id,
					message: err.message,
					stack: err.stack,
				});

				results.push(false);
			}
		}

		// Return true only if all updates succeeded
		const allSucceeded = results.every((r) => r === true);

		if (!allSucceeded) {
			this.logger.warn(`Some properties failed to update for device id=${device.id}`, { resource: device.id });
		} else {
			this.logger.log(`Successfully processed all property updates for device id=${device.id}`, {
				resource: device.id,
			});
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
		target: CommandTarget,
	): Promise<boolean> {
		// Find the device descriptor
		const shellyDevice = target.peer;
		const descriptor = findShellyV1Descriptor(shellyDevice.type);

		if (!descriptor) {
			this.logger.warn(`No descriptor found for device type: ${shellyDevice.type}`, { resource: device.id });

			return false;
		}

		// Get bindings for this device (considering mode if applicable)
		const bindings = getShellyV1Bindings(descriptor, shellyDevice);

		if (!bindings || bindings.length === 0) {
			return false;
		}

		// Determine the command type based on a channel identifier pattern
		const relayMatch = channel.identifier.match(/^relay_(\d+)$/);
		const lightMatch = channel.identifier.match(/^light_(\d+)$/);
		const rollerMatch = channel.identifier.match(/^roller_(\d+)$/);
		const inputMatch = channel.identifier.match(/^(?:input|voltage)_(\d+)$/);

		if (inputMatch) {
			this.logger.warn(`Cannot execute command on read-only input channel: ${channel.identifier}`, {
				resource: device.id,
			});

			return false;
		}

		try {
			if (relayMatch) {
				// Relay command
				return await this.executeRelayCommand(device, target, parseInt(relayMatch[1], 10), propertyUpdates);
			} else if (lightMatch) {
				// Light command
				return await this.executeLightCommand(device, target, parseInt(lightMatch[1], 10), propertyUpdates, descriptor);
			} else if (rollerMatch) {
				// Roller command
				return await this.executeRollerCommand(device, target, parseInt(rollerMatch[1], 10), propertyUpdates);
			} else {
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
		target: CommandTarget,
		index: number,
		propertyUpdates: Array<{ property: ShellyV1ChannelPropertyEntity; value: string | number | boolean }>,
	): Promise<boolean> {
		const shellyDevice = target.peer;
		if (!shellyDevice.setRelay) {
			this.logger.warn(`Device ${device.identifier} does not support setRelay method`, { resource: device.id });

			return false;
		}

		// Find the state property
		const stateUpdate = propertyUpdates.find((u) => u.property.identifier === 'state');

		if (!stateUpdate || !shellyV1Address(device.identifier)) {
			return false;
		}

		const boolValue = coerceBooleanSafe(stateUpdate.value);
		this.logger.log(`Setting relay ${index} to ${boolValue ? 'ON' : 'OFF'} on device ${device.identifier}`, {
			resource: device.id,
		});

		return this.dispatch(device, target, () => shellyDevice.setRelay(index, boolValue));
	}

	private async dispatch(
		device: ShellyV1DeviceEntity,
		target: CommandTarget,
		command: () => Promise<void>,
	): Promise<boolean> {
		if (!target.isCurrent()) return false;
		const pin = await this.identities.findPin(device.id);
		if (!target.isCurrent() || !shellyV1RegistrationMatchesPin(target.registration, device, pin)) return false;
		const address = shellyV1Address(device.identifier);
		if (pin && !shellyV1PinMatches(address, pin.mac)) return false;
		// Direct short and legacy identifiers can only identify an unpinned device at its configured host.
		if (!pin && address?.length !== 12 && device.hostname !== target.host) return false;
		if (pin && pin.verifiedHost !== target.host) {
			// Upgrade a legacy pin only at the configured host or for a matching full-address peer.
			const confirmationHost = device.hostname ?? (address?.length === 12 ? target.host : null);
			if (pin.verifiedHost !== null || confirmationHost !== target.host) return false;
			const info = await this.http.getDeviceInfo(target.host);
			if (!target.isCurrent() || shellyV1ReportedMac(address, target.peer.type, info) !== pin.mac) return false;
			if (!(await this.identities.confirmHost(device.id, pin.mac, target.host, null, pin.revision))) return false;
		}

		if (!target.isCurrent()) return false;
		await command();
		return true;
	}

	/**
	 * Execute light command (on/off, brightness, color)
	 */
	private async executeLightCommand(
		device: ShellyV1DeviceEntity,
		target: CommandTarget,
		index: number,
		propertyUpdates: Array<{ property: ShellyV1ChannelPropertyEntity; value: string | number | boolean }>,
		descriptor: DeviceDescriptor,
	): Promise<boolean> {
		const shellyDevice = target.peer;
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
			}
		}

		// Execute the appropriate command(s) based on properties
		// Both color and white commands can be in the same batch
		let executed = false;

		if (hasColorProperties) {
			// RGB/RGBW color mode
			if (!shellyDevice.setColor) {
				this.logger.warn(`Device ${device.identifier} does not support setColor method`, { resource: device.id });
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
					`Setting light ${index} color with options ${JSON.stringify(colorOpts)} on device ${device.identifier}`,
					{ resource: device.id },
				);

				if (!(await this.dispatch(device, target, () => shellyDevice.setColor(colorOpts)))) return false;
				executed = true;
			}
		}

		const stateOnly = !executed && values.state !== undefined;
		if (shellyDevice.setWhite && (hasWhiteProperties || (stateOnly && !shellyDevice.setColor))) {
			this.logger.log(`Setting white light ${index} on device ${device.identifier}`, { resource: device.id });
			return this.dispatch(device, target, () => {
				// The SDK can receive new state while dispatch verifies the peer. Preserve the latest omitted values.
				const rawBrightness = values.brightness ?? shellyDevice[`brightness${index}`] ?? shellyDevice.brightness;
				const rawSwitch = values.state ?? shellyDevice[`switch${index}`] ?? shellyDevice.switch;
				const brightness = typeof rawBrightness === 'number' ? rawBrightness : 100;
				const on = typeof rawSwitch === 'boolean' ? rawSwitch : true;

				if (values.temperature !== undefined) return shellyDevice.setWhite(values.temperature, brightness, on);
				const temperatureBinding = getShellyV1Bindings(descriptor, shellyDevice).find(
					(binding) =>
						binding.channelIdentifier === `light_${index}` && binding.propertyIdentifier === 'color_temperature',
				);
				if (temperatureBinding) {
					const current = shellyDevice[temperatureBinding.shelliesProperty];
					const temperature = typeof current === 'number' && current >= 2700 && current <= 6500 ? current : 3000;
					return shellyDevice.setWhite(temperature, brightness, on);
				}
				if (descriptor.instance?.multiChannelLights) return shellyDevice.setWhite(index, brightness, on);
				return shellyDevice.setWhite(brightness, on);
			});
		}

		if (hasWhiteProperties && !shellyDevice.setWhite) {
			this.logger.warn(`Device ${device.identifier} does not support setWhite method`, { resource: device.id });
		}
		if (stateOnly && shellyDevice.setColor) {
			this.logger.log(`Setting light ${index} state to ${values.state ? 'ON' : 'OFF'} on device ${device.identifier}`, {
				resource: device.id,
			});
			return this.dispatch(device, target, () => shellyDevice.setColor({ switch: values.state }));
		}

		if (!executed) {
			this.logger.warn(
				`No recognized light properties to update or methods not supported for device ${device.identifier}`,
				{ resource: device.id },
			);

			return false;
		}

		return true;
	}

	/**
	 * Execute roller command (open/close/stop/position)
	 */
	private async executeRollerCommand(
		device: ShellyV1DeviceEntity,
		target: CommandTarget,
		index: number,
		propertyUpdates: Array<{ property: ShellyV1ChannelPropertyEntity; value: string | number | boolean }>,
	): Promise<boolean> {
		const shellyDevice = target.peer;
		if (!shellyDevice.setRoller) {
			this.logger.warn(`Device ${device.identifier} does not support setRoller method`, { resource: device.id });

			return false;
		}

		// Process each property update (position or command)
		for (const { property, value } of propertyUpdates) {
			if (property.identifier === 'position') {
				// Set position (0-100)
				const position = coerceNumberSafe(value, { clamp: { min: 0, max: 100 } }) ?? 0;

				this.logger.log(`Setting roller ${index} to position ${position}% on device ${device.identifier}`, {
					resource: device.id,
				});

				if (!(await this.dispatch(device, target, () => shellyDevice.setRollerPosition(position)))) return false;
			} else if (property.identifier === 'command') {
				// Execute command (open/close/stop)
				const command = String(value).toLowerCase();

				// Validate command is in the allowed format (ENUM validation)
				const allowedCommands = Object.keys(ROLLER_COMMAND_VALUE_MAP);

				if (!validateEnumValue(command, allowedCommands, 'roller command')) {
					this.logger.warn(`Invalid roller command: ${command}, must be one of: ${allowedCommands.join(', ')}`, {
						resource: device.id,
					});

					return false;
				}

				this.logger.log(`Executing roller ${index} command ${command} on device ${device.identifier}`, {
					resource: device.id,
				});

				// For roller commands, canonical values match raw values (open/close/stop)
				// No reverse mapping needed
				if (!(await this.dispatch(device, target, () => shellyDevice.setRollerState(command)))) return false;
			} else {
				// Intentionally empty - unsupported command type
			}
		}

		return true;
	}
}

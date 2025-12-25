import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { IDevicePropertyData } from '../../devices/platforms/device.platform';
import { DevicesService } from '../../devices/services/devices.service';
import { PlatformRegistryService } from '../../devices/services/platform.registry.service';
import { ClimateIntentDto } from '../dto/climate-intent.dto';
import { LightingIntentDto } from '../dto/lighting-intent.dto';
import {
	BRIGHTNESS_DELTA_STEPS,
	BrightnessDelta,
	ClimateIntentType,
	DEFAULT_MAX_SETPOINT,
	DEFAULT_MIN_SETPOINT,
	LIGHTING_MODE_BRIGHTNESS,
	LightingIntentType,
	LightingMode,
	SETPOINT_DELTA_STEPS,
	SPACES_MODULE_NAME,
} from '../spaces.constants';

import { SpacesService } from './spaces.service';

interface LightDevice {
	device: DeviceEntity;
	lightChannel: ChannelEntity;
	onProperty: ChannelPropertyEntity;
	brightnessProperty: ChannelPropertyEntity | null;
}

interface IntentExecutionResult {
	success: boolean;
	affectedDevices: number;
	failedDevices: number;
}

interface ClimateDevice {
	device: DeviceEntity;
	channel: ChannelEntity;
	temperatureProperty: ChannelPropertyEntity | null;
	setpointProperty: ChannelPropertyEntity | null;
}

export interface ClimateState {
	hasClimate: boolean;
	currentTemperature: number | null;
	targetTemperature: number | null;
	minSetpoint: number;
	maxSetpoint: number;
	canSetSetpoint: boolean;
	primaryThermostatId: string | null;
	primarySensorId: string | null;
}

interface ClimateIntentResult extends IntentExecutionResult {
	newSetpoint: number | null;
}

@Injectable()
export class SpaceIntentService {
	private readonly logger = createExtensionLogger(SPACES_MODULE_NAME, 'SpaceIntentService');

	constructor(
		private readonly spacesService: SpacesService,
		private readonly devicesService: DevicesService,
		private readonly platformRegistryService: PlatformRegistryService,
	) {}

	/**
	 * Execute a lighting intent for all lights in a space
	 */
	async executeLightingIntent(spaceId: string, intent: LightingIntentDto): Promise<IntentExecutionResult> {
		this.logger.debug(`Executing lighting intent type=${intent.type} spaceId=${spaceId}`);

		// Verify space exists
		const space = await this.spacesService.findOne(spaceId);

		if (!space) {
			this.logger.warn(`Space not found id=${spaceId}`);

			return { success: false, affectedDevices: 0, failedDevices: 0 };
		}

		// Get all lights in the space
		const lights = await this.getLightsInSpace(spaceId);

		if (lights.length === 0) {
			this.logger.debug(`No lights found in space id=${spaceId}`);

			return { success: true, affectedDevices: 0, failedDevices: 0 };
		}

		this.logger.debug(`Found ${lights.length} lights in space id=${spaceId}`);

		// Execute intent based on type
		let affectedDevices = 0;
		let failedDevices = 0;

		for (const light of lights) {
			const success = await this.executeIntentForLight(light, intent);

			if (success) {
				affectedDevices++;
			} else {
				failedDevices++;
			}
		}

		const overallSuccess = failedDevices === 0 || affectedDevices > 0;

		this.logger.debug(
			`Lighting intent completed spaceId=${spaceId} affected=${affectedDevices} failed=${failedDevices}`,
		);

		return { success: overallSuccess, affectedDevices, failedDevices };
	}

	/**
	 * Find all light devices in a space with their channels and properties
	 */
	private async getLightsInSpace(spaceId: string): Promise<LightDevice[]> {
		const devices = await this.spacesService.findDevicesBySpace(spaceId);
		const lights: LightDevice[] = [];

		for (const device of devices) {
			// Check if device is a lighting device
			if (device.category !== DeviceCategory.LIGHTING) {
				continue;
			}

			// Find the light channel
			const lightChannel = device.channels?.find((ch) => ch.category === ChannelCategory.LIGHT);

			if (!lightChannel) {
				this.logger.debug(`Light device has no light channel deviceId=${device.id}`);
				continue;
			}

			// Find the ON property (required for lights)
			const onProperty = lightChannel.properties?.find((p) => p.category === PropertyCategory.ON);

			if (!onProperty) {
				this.logger.debug(`Light channel has no ON property deviceId=${device.id} channelId=${lightChannel.id}`);
				continue;
			}

			// Find brightness property (optional)
			const brightnessProperty =
				lightChannel.properties?.find((p) => p.category === PropertyCategory.BRIGHTNESS) ?? null;

			lights.push({
				device,
				lightChannel,
				onProperty,
				brightnessProperty,
			});
		}

		return lights;
	}

	/**
	 * Execute a lighting intent for a single light
	 */
	private async executeIntentForLight(light: LightDevice, intent: LightingIntentDto): Promise<boolean> {
		const platform = this.platformRegistryService.get(light.device);

		if (!platform) {
			this.logger.warn(`No platform registered for device id=${light.device.id} type=${light.device.type}`);

			return false;
		}

		const commands: IDevicePropertyData[] = [];

		switch (intent.type) {
			case LightingIntentType.OFF:
				commands.push({
					device: light.device,
					channel: light.lightChannel,
					property: light.onProperty,
					value: false,
				});
				break;

			case LightingIntentType.ON:
				commands.push({
					device: light.device,
					channel: light.lightChannel,
					property: light.onProperty,
					value: true,
				});
				break;

			case LightingIntentType.SET_MODE:
				if (!intent.mode) {
					this.logger.warn('SET_MODE intent requires mode parameter');

					return false;
				}
				commands.push(...this.buildModeCommands(light, intent.mode));
				break;

			case LightingIntentType.BRIGHTNESS_DELTA:
				if (intent.delta === undefined || intent.increase === undefined) {
					this.logger.warn('BRIGHTNESS_DELTA intent requires delta and increase parameters');

					return false;
				}
				commands.push(...this.buildBrightnessDeltaCommands(light, intent.delta, intent.increase));
				break;

			default:
				this.logger.warn(`Unknown intent type: ${String(intent.type)}`);

				return false;
		}

		if (commands.length === 0) {
			this.logger.debug(`No commands to execute for device id=${light.device.id}`);

			return true;
		}

		try {
			const success = await platform.processBatch(commands);

			if (!success) {
				this.logger.error(`Command execution failed for device id=${light.device.id}`);

				return false;
			}

			this.logger.debug(`Successfully executed commands for device id=${light.device.id}`);

			return true;
		} catch (error) {
			this.logger.error(`Error executing commands for device id=${light.device.id}: ${error}`);

			return false;
		}
	}

	/**
	 * Build commands for a lighting mode
	 */
	private buildModeCommands(light: LightDevice, mode: LightingMode): IDevicePropertyData[] {
		const commands: IDevicePropertyData[] = [];

		// Always turn on the light
		commands.push({
			device: light.device,
			channel: light.lightChannel,
			property: light.onProperty,
			value: true,
		});

		// Set brightness if supported
		if (light.brightnessProperty) {
			const brightness = LIGHTING_MODE_BRIGHTNESS[mode];

			commands.push({
				device: light.device,
				channel: light.lightChannel,
				property: light.brightnessProperty,
				value: brightness,
			});
		}

		return commands;
	}

	/**
	 * Build commands for a brightness delta adjustment
	 */
	private buildBrightnessDeltaCommands(
		light: LightDevice,
		delta: BrightnessDelta,
		increase: boolean,
	): IDevicePropertyData[] {
		const commands: IDevicePropertyData[] = [];

		// If light doesn't support brightness, just ignore (no-op)
		if (!light.brightnessProperty) {
			this.logger.debug(`Device does not support brightness adjustment deviceId=${light.device.id}`);

			return commands;
		}

		// Get current brightness value
		const currentValue = light.brightnessProperty.value;
		let currentBrightness = 50; // Default if no value

		if (typeof currentValue === 'number') {
			currentBrightness = currentValue;
		} else if (typeof currentValue === 'string') {
			const parsed = parseFloat(currentValue);

			if (!isNaN(parsed)) {
				currentBrightness = parsed;
			}
		}

		// Calculate new brightness
		const deltaValue = BRIGHTNESS_DELTA_STEPS[delta];
		let newBrightness = increase ? currentBrightness + deltaValue : currentBrightness - deltaValue;

		// Clamp to [0, 100]
		newBrightness = Math.max(0, Math.min(100, newBrightness));

		commands.push({
			device: light.device,
			channel: light.lightChannel,
			property: light.brightnessProperty,
			value: newBrightness,
		});

		return commands;
	}

	// =====================
	// Climate Intent Methods
	// =====================

	/**
	 * Get the current climate state for a space
	 */
	async getClimateState(spaceId: string): Promise<ClimateState> {
		const defaultState: ClimateState = {
			hasClimate: false,
			currentTemperature: null,
			targetTemperature: null,
			minSetpoint: DEFAULT_MIN_SETPOINT,
			maxSetpoint: DEFAULT_MAX_SETPOINT,
			canSetSetpoint: false,
			primaryThermostatId: null,
			primarySensorId: null,
		};

		// Verify space exists
		const space = await this.spacesService.findOne(spaceId);

		if (!space) {
			this.logger.warn(`Space not found id=${spaceId}`);

			return defaultState;
		}

		// Get climate devices in the space
		const climateDevices = await this.getClimateDevicesInSpace(spaceId);

		if (climateDevices.thermostats.length === 0 && climateDevices.sensors.length === 0) {
			this.logger.debug(`No climate devices found in space id=${spaceId}`);

			return defaultState;
		}

		// Determine primary thermostat
		let primaryThermostat: ClimateDevice | null = null;

		if (space.primaryThermostatId) {
			// Admin override
			primaryThermostat = climateDevices.thermostats.find((t) => t.device.id === space.primaryThermostatId) ?? null;

			if (!primaryThermostat) {
				this.logger.warn(
					`Admin-configured primary thermostat not found in space id=${spaceId} thermostatId=${space.primaryThermostatId}`,
				);
			}
		}

		if (!primaryThermostat && climateDevices.thermostats.length > 0) {
			// Default: first thermostat (deterministic by device name)
			primaryThermostat = climateDevices.thermostats[0];
		}

		// Determine primary temperature sensor
		let primarySensor: ClimateDevice | null = null;

		if (space.primaryTemperatureSensorId) {
			// Admin override - can be a sensor device or thermostat device
			primarySensor =
				climateDevices.sensors.find((s) => s.device.id === space.primaryTemperatureSensorId) ??
				climateDevices.thermostats.find((t) => t.device.id === space.primaryTemperatureSensorId) ??
				null;

			if (!primarySensor) {
				this.logger.warn(
					`Admin-configured primary temperature sensor not found in space id=${spaceId} sensorId=${space.primaryTemperatureSensorId}`,
				);
			}
		}

		if (!primarySensor) {
			// Default: use thermostat's temperature if available, otherwise first sensor
			if (primaryThermostat?.temperatureProperty) {
				primarySensor = primaryThermostat;
			} else if (climateDevices.sensors.length > 0) {
				primarySensor = climateDevices.sensors[0];
			}
		}

		// Build climate state
		const currentTemperature = this.getPropertyNumericValue(primarySensor?.temperatureProperty);
		const targetTemperature = this.getPropertyNumericValue(primaryThermostat?.setpointProperty);

		// Get min/max from property format if available (format is [min, max] for numeric properties)
		let minSetpoint = DEFAULT_MIN_SETPOINT;
		let maxSetpoint = DEFAULT_MAX_SETPOINT;

		if (primaryThermostat?.setpointProperty?.format) {
			const format = primaryThermostat.setpointProperty.format;

			if (Array.isArray(format) && format.length >= 2) {
				const propMin = format[0];
				const propMax = format[1];

				if (typeof propMin === 'number') {
					minSetpoint = propMin;
				}

				if (typeof propMax === 'number') {
					maxSetpoint = propMax;
				}
			}
		}

		return {
			hasClimate: true,
			currentTemperature,
			targetTemperature,
			minSetpoint,
			maxSetpoint,
			canSetSetpoint: primaryThermostat?.setpointProperty !== null && primaryThermostat?.setpointProperty !== undefined,
			primaryThermostatId: primaryThermostat?.device.id ?? null,
			primarySensorId: primarySensor?.device.id ?? null,
		};
	}

	/**
	 * Execute a climate intent for the space
	 */
	async executeClimateIntent(spaceId: string, intent: ClimateIntentDto): Promise<ClimateIntentResult> {
		this.logger.debug(`Executing climate intent type=${intent.type} spaceId=${spaceId}`);

		const defaultResult: ClimateIntentResult = {
			success: false,
			affectedDevices: 0,
			failedDevices: 0,
			newSetpoint: null,
		};

		// Get climate state (includes primary device selection)
		const climateState = await this.getClimateState(spaceId);

		if (!climateState.hasClimate) {
			this.logger.debug(`No climate devices in space id=${spaceId}`);

			return { ...defaultResult, success: true };
		}

		if (!climateState.canSetSetpoint || !climateState.primaryThermostatId) {
			this.logger.debug(`No thermostat with setpoint capability in space id=${spaceId}`);

			return { ...defaultResult, success: true };
		}

		// Get the primary thermostat device with full relations
		const thermostatDevice = await this.devicesService.getOneOrThrow(climateState.primaryThermostatId);
		const climateDeviceInfo = this.extractClimateDevice(thermostatDevice);

		if (!climateDeviceInfo?.setpointProperty) {
			this.logger.error(`Primary thermostat has no setpoint property id=${climateState.primaryThermostatId}`);

			return defaultResult;
		}

		// Calculate new setpoint value
		let newSetpoint: number;

		switch (intent.type) {
			case ClimateIntentType.SETPOINT_DELTA: {
				if (intent.delta === undefined || intent.increase === undefined) {
					this.logger.warn('SETPOINT_DELTA intent requires delta and increase parameters');

					return defaultResult;
				}

				const currentSetpoint = climateState.targetTemperature ?? 20; // Default if no current value
				const deltaValue = SETPOINT_DELTA_STEPS[intent.delta];
				newSetpoint = intent.increase ? currentSetpoint + deltaValue : currentSetpoint - deltaValue;
				break;
			}

			case ClimateIntentType.SETPOINT_SET: {
				if (intent.value === undefined) {
					this.logger.warn('SETPOINT_SET intent requires value parameter');

					return defaultResult;
				}

				newSetpoint = intent.value;
				break;
			}

			default:
				this.logger.warn(`Unknown climate intent type: ${String(intent.type)}`);

				return defaultResult;
		}

		// Clamp to min/max
		newSetpoint = Math.max(climateState.minSetpoint, Math.min(climateState.maxSetpoint, newSetpoint));

		// Round to 0.5 degree precision
		newSetpoint = Math.round(newSetpoint * 2) / 2;

		this.logger.debug(`Setting thermostat setpoint to ${newSetpoint}°C deviceId=${thermostatDevice.id}`);

		// Execute command
		const platform = this.platformRegistryService.get(thermostatDevice);

		if (!platform) {
			this.logger.warn(`No platform registered for device id=${thermostatDevice.id} type=${thermostatDevice.type}`);

			return defaultResult;
		}

		const command: IDevicePropertyData = {
			device: thermostatDevice,
			channel: climateDeviceInfo.channel,
			property: climateDeviceInfo.setpointProperty,
			value: newSetpoint,
		};

		try {
			const success = await platform.processBatch([command]);

			if (!success) {
				this.logger.error(`Climate command execution failed for device id=${thermostatDevice.id}`);

				return { ...defaultResult, failedDevices: 1 };
			}

			this.logger.debug(`Successfully set thermostat setpoint to ${newSetpoint}°C deviceId=${thermostatDevice.id}`);

			return {
				success: true,
				affectedDevices: 1,
				failedDevices: 0,
				newSetpoint,
			};
		} catch (error) {
			this.logger.error(`Error executing climate command for device id=${thermostatDevice.id}: ${error}`);

			return { ...defaultResult, failedDevices: 1 };
		}
	}

	/**
	 * Get all climate devices (thermostats and temperature sensors) in a space
	 */
	private async getClimateDevicesInSpace(
		spaceId: string,
	): Promise<{ thermostats: ClimateDevice[]; sensors: ClimateDevice[] }> {
		const devices = await this.spacesService.findDevicesBySpace(spaceId);
		const thermostats: ClimateDevice[] = [];
		const sensors: ClimateDevice[] = [];

		// Sort devices by name for deterministic selection
		const sortedDevices = [...devices].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));

		for (const device of sortedDevices) {
			const climateDevice = this.extractClimateDevice(device);

			if (!climateDevice) {
				continue;
			}

			// Classify as thermostat or sensor based on setpoint capability
			if (climateDevice.setpointProperty) {
				thermostats.push(climateDevice);
			} else if (climateDevice.temperatureProperty) {
				sensors.push(climateDevice);
			}
		}

		return { thermostats, sensors };
	}

	/**
	 * Extract climate device info from a device entity
	 */
	private extractClimateDevice(device: DeviceEntity): ClimateDevice | null {
		// Check if device is a thermostat or sensor
		if (device.category !== DeviceCategory.THERMOSTAT && device.category !== DeviceCategory.SENSOR) {
			return null;
		}

		// Look for temperature-related channels
		const climateChannelCategories = [
			ChannelCategory.THERMOSTAT,
			ChannelCategory.TEMPERATURE,
			ChannelCategory.HEATER,
			ChannelCategory.COOLER,
		];

		// Find the best channel for climate control
		let bestChannel: ChannelEntity | null = null;
		let temperatureProperty: ChannelPropertyEntity | null = null;
		let setpointProperty: ChannelPropertyEntity | null = null;

		for (const channelCategory of climateChannelCategories) {
			const channel = device.channels?.find((ch) => ch.category === channelCategory);

			if (!channel) {
				continue;
			}

			// Look for temperature property
			const tempProp = channel.properties?.find((p) => p.category === PropertyCategory.TEMPERATURE);

			// For setpoint, look for temperature property on heater/cooler/thermostat channels (not temperature channel)
			const setpointProp =
				channelCategory !== ChannelCategory.TEMPERATURE
					? channel.properties?.find((p) => p.category === PropertyCategory.TEMPERATURE)
					: null;

			// Use this channel if it has properties we need
			if (tempProp || setpointProp) {
				bestChannel = channel;

				// Prefer temperature reading from TEMPERATURE channel
				if (channelCategory === ChannelCategory.TEMPERATURE && tempProp) {
					temperatureProperty = tempProp;
				} else if (!temperatureProperty && tempProp) {
					temperatureProperty = tempProp;
				}

				// Prefer setpoint from HEATER/COOLER/THERMOSTAT channels
				if (channelCategory !== ChannelCategory.TEMPERATURE && setpointProp) {
					setpointProperty = setpointProp;
				}
			}
		}

		if (!bestChannel) {
			return null;
		}

		return {
			device,
			channel: bestChannel,
			temperatureProperty,
			setpointProperty,
		};
	}

	/**
	 * Get numeric value from a property
	 */
	private getPropertyNumericValue(property: ChannelPropertyEntity | null | undefined): number | null {
		if (!property) {
			return null;
		}

		const value = property.value;

		if (typeof value === 'number') {
			return value;
		}

		if (typeof value === 'string') {
			const parsed = parseFloat(value);

			return isNaN(parsed) ? null : parsed;
		}

		return null;
	}
}

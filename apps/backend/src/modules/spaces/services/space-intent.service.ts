import { Inject, Injectable, forwardRef } from '@nestjs/common';

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
	LIGHTING_MODE_ORCHESTRATION,
	LightingIntentType,
	LightingMode,
	LightingRole,
	RoleBrightnessRule,
	SETPOINT_DELTA_STEPS,
	SPACES_MODULE_NAME,
} from '../spaces.constants';

import { SpaceContextSnapshotService } from './space-context-snapshot.service';
import { SpaceLightingRoleService } from './space-lighting-role.service';
import { SpaceUndoHistoryService } from './space-undo-history.service';
import { SpacesService } from './spaces.service';

interface LightDevice {
	device: DeviceEntity;
	lightChannel: ChannelEntity;
	onProperty: ChannelPropertyEntity;
	brightnessProperty: ChannelPropertyEntity | null;
	role: LightingRole | null;
}

/**
 * Result of role-based light selection for a mode.
 * Contains the rule to apply and whether it's from fallback.
 */
export interface LightModeSelection {
	light: LightDevice;
	rule: RoleBrightnessRule;
	isFallback: boolean;
}

/**
 * Pure function to select lights based on their roles for a given lighting mode.
 * This function is deterministic and handles:
 * - Full role configuration: Apply mode-specific rules per role
 * - Partial role configuration: Apply rules to configured lights, treat unconfigured as fallback
 * - No role configuration: Apply MVP behavior (all lights ON with mode brightness)
 *
 * @param lights - All lights in the space with their role assignments
 * @param mode - The lighting mode to apply
 * @returns Array of light selections with rules to apply
 */
export function selectLightsForMode(lights: LightDevice[], mode: LightingMode): LightModeSelection[] {
	const config = LIGHTING_MODE_ORCHESTRATION[mode];
	const selections: LightModeSelection[] = [];

	// Check if any lights have roles configured
	const hasAnyRoles = lights.some((light) => light.role !== null);

	if (!hasAnyRoles) {
		// MVP fallback: no roles configured, apply mode brightness to all lights
		const mvpBrightness = LIGHTING_MODE_BRIGHTNESS[mode];

		for (const light of lights) {
			selections.push({
				light,
				rule: { on: true, brightness: mvpBrightness },
				isFallback: true,
			});
		}

		return selections;
	}

	// Check if we need fallback for night mode (no night lights exist)
	let useFallback = false;

	if (mode === LightingMode.NIGHT && config.fallbackRoles) {
		const hasNightLights = lights.some((light) => light.role === LightingRole.NIGHT);

		if (!hasNightLights) {
			useFallback = true;
		}
	}

	// Apply role-based rules
	for (const light of lights) {
		let rule: RoleBrightnessRule;
		let isFallback = false;

		if (light.role === null) {
			// Light has no role assigned - treat as OTHER
			rule = config.roles[LightingRole.OTHER] ?? { on: false, brightness: null };
		} else if (useFallback && config.fallbackRoles?.includes(light.role)) {
			// Night mode fallback: use main lights at low brightness
			rule = { on: true, brightness: config.fallbackBrightness ?? 20 };
			isFallback = true;
		} else {
			// Apply the rule for this role
			rule = config.roles[light.role] ?? { on: false, brightness: null };
		}

		selections.push({ light, rule, isFallback });
	}

	return selections;
}

interface IntentExecutionResult {
	success: boolean;
	affectedDevices: number;
	failedDevices: number;
}

interface ClimateDevice {
	device: DeviceEntity;
	channel: ChannelEntity;
	setpointChannel: ChannelEntity | null;
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
		private readonly lightingRoleService: SpaceLightingRoleService,
		@Inject(forwardRef(() => SpaceContextSnapshotService))
		private readonly contextSnapshotService: SpaceContextSnapshotService,
		@Inject(forwardRef(() => SpaceUndoHistoryService))
		private readonly undoHistoryService: SpaceUndoHistoryService,
	) {}

	/**
	 * Execute a lighting intent for all lights in a space
	 */
	async executeLightingIntent(spaceId: string, intent: LightingIntentDto): Promise<IntentExecutionResult> {
		// Verify space exists
		const space = await this.spacesService.findOne(spaceId);

		if (!space) {
			return { success: false, affectedDevices: 0, failedDevices: 0 };
		}

		// Get all lights in the space
		const lights = await this.getLightsInSpace(spaceId);

		if (lights.length === 0) {
			return { success: true, affectedDevices: 0, failedDevices: 0 };
		}

		// Capture snapshot for undo BEFORE executing the intent
		await this.captureUndoSnapshot(spaceId, intent);

		// For SET_MODE, use role-based orchestration
		if (intent.type === LightingIntentType.SET_MODE && intent.mode) {
			return this.executeModeIntent(spaceId, lights, intent.mode);
		}

		// For other intents (ON, OFF, BRIGHTNESS_DELTA), apply to all lights
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

		return { success: overallSuccess, affectedDevices, failedDevices };
	}

	/**
	 * Execute a mode-based lighting intent using role-based orchestration.
	 * This method applies different brightness/on-off rules based on each light's role.
	 */
	private async executeModeIntent(
		spaceId: string,
		lights: LightDevice[],
		mode: LightingMode,
	): Promise<IntentExecutionResult> {
		// Use the pure function to determine what to do with each light
		const selections = selectLightsForMode(lights, mode);

		// Log telemetry for role-based selection
		const onLights = selections.filter((s) => s.rule.on);
		const offLights = selections.filter((s) => !s.rule.on);
		const hasRoles = lights.some((l) => l.role !== null);
		const usingFallback = selections.some((s) => s.isFallback);

		this.logger.log(
			`Mode intent spaceId=${spaceId} mode=${mode} ` +
				`totalLights=${lights.length} onCount=${onLights.length} offCount=${offLights.length} ` +
				`hasRoles=${hasRoles} usingFallback=${usingFallback}`,
		);

		// Reserved for future telemetry logging of individual device selections

		let affectedDevices = 0;
		let failedDevices = 0;

		// Execute commands for each light based on its selection
		for (const selection of selections) {
			const success = await this.executeRuleForLight(selection.light, selection.rule);

			if (success) {
				affectedDevices++;
			} else {
				failedDevices++;
			}
		}

		const overallSuccess = failedDevices === 0 || affectedDevices > 0;

		return { success: overallSuccess, affectedDevices, failedDevices };
	}

	/**
	 * Execute a role-based rule for a single light.
	 * Handles on/off state and brightness based on the rule.
	 */
	private async executeRuleForLight(light: LightDevice, rule: RoleBrightnessRule): Promise<boolean> {
		const platform = this.platformRegistryService.get(light.device);

		if (!platform) {
			this.logger.warn(`No platform registered for device id=${light.device.id} type=${light.device.type}`);

			return false;
		}

		const commands: IDevicePropertyData[] = [];

		// Set on/off state
		commands.push({
			device: light.device,
			channel: light.lightChannel,
			property: light.onProperty,
			value: rule.on,
		});

		// Set brightness if light is turning on and has brightness support
		if (rule.on && rule.brightness !== null && light.brightnessProperty) {
			commands.push({
				device: light.device,
				channel: light.lightChannel,
				property: light.brightnessProperty,
				value: rule.brightness,
			});
		}

		try {
			const success = await platform.processBatch(commands);

			if (!success) {
				this.logger.error(`Rule execution failed for device id=${light.device.id}`);

				return false;
			}

			return true;
		} catch (error) {
			this.logger.error(`Error executing rule for device id=${light.device.id}: ${error}`);

			return false;
		}
	}

	/**
	 * Find all light devices in a space with their channels, properties, and roles
	 */
	private async getLightsInSpace(spaceId: string): Promise<LightDevice[]> {
		const devices = await this.spacesService.findDevicesBySpace(spaceId);
		const lights: LightDevice[] = [];

		// Get role map for this space
		const roleMap = await this.lightingRoleService.getRoleMap(spaceId);

		for (const device of devices) {
			// Check if device is a lighting device
			if (device.category !== DeviceCategory.LIGHTING) {
				continue;
			}

			// Find the light channel
			const lightChannel = device.channels?.find((ch) => ch.category === ChannelCategory.LIGHT);

			if (!lightChannel) {
				continue;
			}

			// Find the ON property (required for lights)
			const onProperty = lightChannel.properties?.find((p) => p.category === PropertyCategory.ON);

			if (!onProperty) {
				continue;
			}

			// Find brightness property (optional)
			const brightnessProperty =
				lightChannel.properties?.find((p) => p.category === PropertyCategory.BRIGHTNESS) ?? null;

			// Get role assignment for this light
			const roleKey = `${device.id}:${lightChannel.id}`;
			const roleEntity = roleMap.get(roleKey);
			const role = roleEntity?.role ?? null;

			lights.push({
				device,
				lightChannel,
				onProperty,
				brightnessProperty,
				role,
			});
		}

		return lights;
	}

	/**
	 * Execute a lighting intent for a single light (ON, OFF, or BRIGHTNESS_DELTA).
	 * SET_MODE is handled separately via executeModeIntent for role-based orchestration.
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

			case LightingIntentType.BRIGHTNESS_DELTA:
				if (intent.delta === undefined || intent.increase === undefined) {
					this.logger.warn('BRIGHTNESS_DELTA intent requires delta and increase parameters');

					return false;
				}
				commands.push(...this.buildBrightnessDeltaCommands(light, intent.delta, intent.increase));
				break;

			case LightingIntentType.SET_MODE:
				// SET_MODE is handled via executeModeIntent, not here
				this.logger.warn('SET_MODE should be handled via executeModeIntent');

				return false;

			default:
				this.logger.warn(`Unknown intent type: ${String(intent.type)}`);

				return false;
		}

		if (commands.length === 0) {
			return true;
		}

		try {
			const success = await platform.processBatch(commands);

			if (!success) {
				this.logger.error(`Command execution failed for device id=${light.device.id}`);

				return false;
			}

			return true;
		} catch (error) {
			this.logger.error(`Error executing commands for device id=${light.device.id}: ${error}`);

			return false;
		}
	}

	/**
	 * Build commands for a brightness delta adjustment.
	 *
	 * Design decision: Brightness delta applies to all currently ON lights.
	 * This is safer and more intuitive than tracking mode state, as users expect
	 * brightness adjustments to only affect visible (on) lights.
	 */
	private buildBrightnessDeltaCommands(
		light: LightDevice,
		delta: BrightnessDelta,
		increase: boolean,
	): IDevicePropertyData[] {
		const commands: IDevicePropertyData[] = [];

		// If light doesn't support brightness, just ignore (no-op)
		if (!light.brightnessProperty) {
			return commands;
		}

		// Only adjust brightness for lights that are currently ON
		const onValue = light.onProperty.value;
		const isOn = onValue === true || onValue === 'true' || onValue === 1 || onValue === '1';

		if (!isOn) {
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
			return defaultState;
		}

		// Get climate devices in the space
		const climateDevices = await this.getClimateDevicesInSpace(spaceId);

		if (climateDevices.thermostats.length === 0 && climateDevices.sensors.length === 0) {
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
		const defaultResult: ClimateIntentResult = {
			success: false,
			affectedDevices: 0,
			failedDevices: 0,
			newSetpoint: null,
		};

		// Verify space exists
		const space = await this.spacesService.findOne(spaceId);

		if (!space) {
			return defaultResult;
		}

		// Get climate state (includes primary device selection)
		const climateState = await this.getClimateState(spaceId);

		if (!climateState.hasClimate) {
			return { ...defaultResult, success: true };
		}

		if (!climateState.canSetSetpoint || !climateState.primaryThermostatId) {
			return { ...defaultResult, success: true };
		}

		// Capture snapshot for undo BEFORE executing the climate intent
		await this.captureClimateUndoSnapshot(spaceId, intent);

		// Get the primary thermostat device with full relations
		const thermostatDevice = await this.devicesService.getOneOrThrow(climateState.primaryThermostatId);
		const climateDeviceInfo = this.extractClimateDevice(thermostatDevice);

		if (!climateDeviceInfo?.setpointProperty || !climateDeviceInfo.setpointChannel) {
			this.logger.error(`Primary thermostat has no setpoint property/channel id=${climateState.primaryThermostatId}`);

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

		// Re-clamp after rounding (rounding can push value outside range)
		newSetpoint = Math.max(climateState.minSetpoint, Math.min(climateState.maxSetpoint, newSetpoint));

		// Execute command
		const platform = this.platformRegistryService.get(thermostatDevice);

		if (!platform) {
			this.logger.warn(`No platform registered for device id=${thermostatDevice.id} type=${thermostatDevice.type}`);

			return defaultResult;
		}

		const command: IDevicePropertyData = {
			device: thermostatDevice,
			channel: climateDeviceInfo.setpointChannel,
			property: climateDeviceInfo.setpointProperty,
			value: newSetpoint,
		};

		try {
			const success = await platform.processBatch([command]);

			if (!success) {
				this.logger.error(`Climate command execution failed for device id=${thermostatDevice.id}`);

				return { ...defaultResult, failedDevices: 1 };
			}

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
		let setpointChannel: ChannelEntity | null = null;
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

				// Only use temperature reading from TEMPERATURE channel
				// (HEATER/COOLER/THERMOSTAT channels have setpoint, not current temperature)
				if (channelCategory === ChannelCategory.TEMPERATURE && tempProp) {
					temperatureProperty = tempProp;
				}

				// Capture setpoint and its channel from HEATER/COOLER/THERMOSTAT channels
				if (channelCategory !== ChannelCategory.TEMPERATURE && setpointProp) {
					setpointProperty = setpointProp;
					setpointChannel = channel;
				}
			}
		}

		if (!bestChannel) {
			return null;
		}

		return {
			device,
			channel: bestChannel,
			setpointChannel,
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

	// ================================
	// Undo History Helper Methods
	// ================================

	/**
	 * Capture a snapshot for undo before executing a lighting intent.
	 */
	private async captureUndoSnapshot(spaceId: string, intent: LightingIntentDto): Promise<void> {
		try {
			const snapshot = await this.contextSnapshotService.captureSnapshot(spaceId);

			if (!snapshot) {
				return;
			}

			// Build a description of the action
			const actionDescription = this.buildLightingIntentDescription(intent);

			this.undoHistoryService.pushSnapshot(snapshot, actionDescription, 'lighting');
		} catch (error) {
			// Log but don't fail the intent execution if snapshot capture fails
			this.logger.error(`Error capturing undo snapshot spaceId=${spaceId}: ${error}`);
		}
	}

	/**
	 * Capture a snapshot for undo before executing a climate intent.
	 */
	private async captureClimateUndoSnapshot(spaceId: string, intent: ClimateIntentDto): Promise<void> {
		try {
			const snapshot = await this.contextSnapshotService.captureSnapshot(spaceId);

			if (!snapshot) {
				return;
			}

			// Build a description of the action
			const actionDescription = this.buildClimateIntentDescription(intent);

			this.undoHistoryService.pushSnapshot(snapshot, actionDescription, 'climate');
		} catch (error) {
			// Log but don't fail the intent execution if snapshot capture fails
			this.logger.error(`Error capturing undo snapshot spaceId=${spaceId}: ${error}`);
		}
	}

	/**
	 * Build a human-readable description of a lighting intent.
	 */
	private buildLightingIntentDescription(intent: LightingIntentDto): string {
		switch (intent.type) {
			case LightingIntentType.OFF:
				return 'Turn lights off';
			case LightingIntentType.ON:
				return 'Turn lights on';
			case LightingIntentType.SET_MODE:
				return `Set lighting mode to ${intent.mode ?? 'unknown'}`;
			case LightingIntentType.BRIGHTNESS_DELTA:
				return intent.increase ? 'Increase brightness' : 'Decrease brightness';
			default:
				return 'Lighting intent';
		}
	}

	/**
	 * Build a human-readable description of a climate intent.
	 */
	private buildClimateIntentDescription(intent: ClimateIntentDto): string {
		switch (intent.type) {
			case ClimateIntentType.SETPOINT_DELTA:
				return intent.increase ? 'Increase temperature' : 'Decrease temperature';
			case ClimateIntentType.SETPOINT_SET:
				return `Set temperature to ${intent.value ?? 'unknown'}°C`;
			default:
				return 'Climate intent';
		}
	}
}

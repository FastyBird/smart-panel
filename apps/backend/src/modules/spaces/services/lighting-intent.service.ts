import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { IDevicePropertyData } from '../../devices/platforms/device.platform';
import { PlatformRegistryService } from '../../devices/services/platform.registry.service';
import { IntentTimeseriesService } from '../../intents/services/intent-timeseries.service';
import { LightingIntentDto } from '../dto/lighting-intent.dto';
import {
	BrightnessDelta,
	EventType,
	LightingIntentType,
	LightingMode,
	LightingRole,
	RoleBrightnessRule,
	SPACES_MODULE_NAME,
} from '../spaces.constants';
import { IntentSpecLoaderService, ResolvedModeOrchestration } from '../spec';

import { SpaceContextSnapshotService } from './space-context-snapshot.service';
import { IntentExecutionResult, SpaceIntentBaseService } from './space-intent-base.service';
import { SpaceLightingRoleService } from './space-lighting-role.service';
import { SpaceLightingStateService } from './space-lighting-state.service';
import { SpaceUndoHistoryService } from './space-undo-history.service';
import { SpacesService } from './spaces.service';

/**
 * Represents a light device with its channel, properties, and role.
 */
export interface LightDevice {
	device: DeviceEntity;
	lightChannel: ChannelEntity;
	onProperty: ChannelPropertyEntity;
	brightnessProperty: ChannelPropertyEntity | null;
	// RGB color properties
	colorRedProperty: ChannelPropertyEntity | null;
	colorGreenProperty: ChannelPropertyEntity | null;
	colorBlueProperty: ChannelPropertyEntity | null;
	// Hue-Saturation color properties
	hueProperty: ChannelPropertyEntity | null;
	saturationProperty: ChannelPropertyEntity | null;
	// Other properties
	colorTempProperty: ChannelPropertyEntity | null;
	whiteProperty: ChannelPropertyEntity | null;
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
 * @param config - The mode orchestration config (from YAML spec)
 * @returns Array of light selections with rules to apply
 */
export function selectLightsForMode(
	lights: LightDevice[],
	mode: LightingMode,
	config: ResolvedModeOrchestration,
): LightModeSelection[] {
	const selections: LightModeSelection[] = [];

	// Check if any lights have roles configured
	const hasAnyRoles = lights.some((light) => light.role !== null);

	if (!hasAnyRoles) {
		// MVP fallback: no roles configured, apply mode brightness to all lights
		const mvpBrightness = config.mvpBrightness;

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
			const otherRule = config.roles[LightingRole.OTHER];
			rule = otherRule ? { on: otherRule.on, brightness: otherRule.brightness } : { on: false, brightness: null };
		} else if (useFallback && config.fallbackRoles?.includes(light.role)) {
			// Night mode fallback: use main lights at low brightness
			rule = { on: true, brightness: config.fallbackBrightness ?? 20 };
			isFallback = true;
		} else {
			// Apply the rule for this role
			const roleRule = config.roles[light.role];
			rule = roleRule ? { on: roleRule.on, brightness: roleRule.brightness } : { on: false, brightness: null };
		}

		selections.push({ light, rule, isFallback });
	}

	return selections;
}

/**
 * Service handling all lighting-related intent operations.
 * Manages light state, mode-based orchestration, and brightness control.
 */
@Injectable()
export class LightingIntentService extends SpaceIntentBaseService {
	private readonly logger = createExtensionLogger(SPACES_MODULE_NAME, 'LightingIntentService');

	constructor(
		private readonly spacesService: SpacesService,
		private readonly platformRegistryService: PlatformRegistryService,
		private readonly lightingRoleService: SpaceLightingRoleService,
		private readonly eventEmitter: EventEmitter2,
		@Inject(forwardRef(() => SpaceContextSnapshotService))
		private readonly contextSnapshotService: SpaceContextSnapshotService,
		@Inject(forwardRef(() => SpaceUndoHistoryService))
		private readonly undoHistoryService: SpaceUndoHistoryService,
		@Inject(forwardRef(() => IntentTimeseriesService))
		private readonly intentTimeseriesService: IntentTimeseriesService,
		@Inject(forwardRef(() => SpaceLightingStateService))
		private readonly lightingStateService: SpaceLightingStateService,
		private readonly intentSpecLoaderService: IntentSpecLoaderService,
	) {
		super();
	}

	/**
	 * Execute a lighting intent for all lights in a space.
	 * Returns null if space doesn't exist (controller should throw 404).
	 */
	async executeLightingIntent(spaceId: string, intent: LightingIntentDto): Promise<IntentExecutionResult | null> {
		// Verify space exists - return null for controller to throw 404
		const space = await this.spacesService.findOne(spaceId);

		if (!space) {
			this.logger.warn(`Space not found id=${spaceId}`);

			return null;
		}

		// Get all lights in the space
		const lights = await this.getLightsInSpace(spaceId);

		if (lights.length === 0) {
			this.logger.debug(`No lights found in space id=${spaceId}`);

			return { success: true, affectedDevices: 0, failedDevices: 0 };
		}

		this.logger.debug(`Found ${lights.length} lights in space id=${spaceId}`);

		// Capture snapshot for undo BEFORE executing the intent
		await this.captureUndoSnapshot(spaceId, intent);

		let result: IntentExecutionResult;

		// For SET_MODE, use role-based orchestration
		if (intent.type === LightingIntentType.SET_MODE && intent.mode) {
			result = await this.executeModeIntent(spaceId, lights, intent.mode);
		} else if (this.isRoleSpecificIntent(intent.type)) {
			// For role-specific intents, only affect lights with the specified role
			result = await this.executeRoleIntent(spaceId, lights, intent);
		} else {
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

			this.logger.debug(
				`Lighting intent completed spaceId=${spaceId} affected=${affectedDevices} failed=${failedDevices}`,
			);

			result = { success: overallSuccess, affectedDevices, failedDevices };
		}

		// Emit state change event for WebSocket clients (fire and forget)
		if (result.success) {
			void this.emitLightingStateChange(spaceId);
		}

		return result;
	}

	/**
	 * Emit a lighting state change event for WebSocket clients.
	 * Fetches the current aggregated state and broadcasts it.
	 */
	private async emitLightingStateChange(spaceId: string): Promise<void> {
		try {
			const state = await this.lightingStateService.getLightingState(spaceId);

			if (state) {
				this.eventEmitter.emit(EventType.LIGHTING_STATE_CHANGED, {
					space_id: spaceId,
					state,
				});

				this.logger.debug(`Emitted lighting state change event spaceId=${spaceId}`);
			}
		} catch (error) {
			this.logger.error(`Failed to emit lighting state change event spaceId=${spaceId}: ${error}`);
		}
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
		// Get mode orchestration config from YAML spec
		const modeConfig = this.intentSpecLoaderService.getLightingModeOrchestration(mode);

		if (!modeConfig) {
			this.logger.warn(`No orchestration config found for mode=${mode}, using defaults`);

			return { success: false, affectedDevices: 0, failedDevices: 0 };
		}

		// Use the pure function to determine what to do with each light
		const selections = selectLightsForMode(lights, mode, modeConfig);

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

		this.logger.debug(
			`Mode intent completed spaceId=${spaceId} mode=${mode} affected=${affectedDevices} failed=${failedDevices}`,
		);

		// Store mode change to InfluxDB for historical tracking (fire and forget)
		if (overallSuccess) {
			void this.intentTimeseriesService.storeLightingModeChange(
				spaceId,
				mode,
				selections.length,
				affectedDevices,
				failedDevices,
			);
		}

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
	 * Find all light devices in a space with their channels, properties, and roles.
	 * Iterates ALL light channels per device (multi-channel devices have multiple outputs).
	 * Excludes lights with HIDDEN role as they should not be controlled by intents.
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

			// Find ALL light channels (multi-channel devices have multiple light outputs)
			const lightChannels = device.channels?.filter((ch) => ch.category === ChannelCategory.LIGHT) ?? [];

			for (const lightChannel of lightChannels) {
				// Find the ON property (required for lights)
				const onProperty = lightChannel.properties?.find((p) => p.category === PropertyCategory.ON);

				if (!onProperty) {
					continue;
				}

				// Find optional properties
				const brightnessProperty =
					lightChannel.properties?.find((p) => p.category === PropertyCategory.BRIGHTNESS) ?? null;
				// RGB color properties
				const colorRedProperty =
					lightChannel.properties?.find((p) => p.category === PropertyCategory.COLOR_RED) ?? null;
				const colorGreenProperty =
					lightChannel.properties?.find((p) => p.category === PropertyCategory.COLOR_GREEN) ?? null;
				const colorBlueProperty =
					lightChannel.properties?.find((p) => p.category === PropertyCategory.COLOR_BLUE) ?? null;
				// Hue-Saturation color properties
				const hueProperty = lightChannel.properties?.find((p) => p.category === PropertyCategory.HUE) ?? null;
				const saturationProperty =
					lightChannel.properties?.find((p) => p.category === PropertyCategory.SATURATION) ?? null;
				// Other properties
				const colorTempProperty =
					lightChannel.properties?.find((p) => p.category === PropertyCategory.COLOR_TEMPERATURE) ?? null;
				const whiteProperty = lightChannel.properties?.find((p) => p.category === PropertyCategory.COLOR_WHITE) ?? null;

				// Get role assignment for this light (keyed by deviceId:channelId)
				const roleKey = `${device.id}:${lightChannel.id}`;
				const roleEntity = roleMap.get(roleKey);
				const role = roleEntity?.role ?? null;

				// Skip HIDDEN lights - they should not be controlled by intents
				if (role === LightingRole.HIDDEN) {
					this.logger.debug(`Skipping HIDDEN light deviceId=${device.id} channelId=${lightChannel.id}`);
					continue;
				}

				lights.push({
					device,
					lightChannel,
					onProperty,
					brightnessProperty,
					colorRedProperty,
					colorGreenProperty,
					colorBlueProperty,
					hueProperty,
					saturationProperty,
					colorTempProperty,
					whiteProperty,
					role,
				});
			}
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
			this.logger.debug(`Device does not support brightness adjustment deviceId=${light.device.id}`);

			return commands;
		}

		// Only adjust brightness for lights that are currently ON
		const isOn = this.getPropertyBooleanValue(light.onProperty);

		if (!isOn) {
			this.logger.debug(`Skipping brightness delta for OFF device deviceId=${light.device.id}`);

			return commands;
		}

		// Get current brightness value
		const currentBrightness = this.getPropertyNumericValue(light.brightnessProperty) ?? 50;

		// Calculate new brightness using YAML-defined delta steps
		const deltaValue = this.intentSpecLoaderService.getBrightnessDeltaStep(delta) ?? 25; // Default to 25 if not found
		let newBrightness = increase ? currentBrightness + deltaValue : currentBrightness - deltaValue;

		// Clamp to [0, 100]
		newBrightness = this.clampValue(newBrightness, 0, 100);

		commands.push({
			device: light.device,
			channel: light.lightChannel,
			property: light.brightnessProperty,
			value: newBrightness,
		});

		return commands;
	}

	/**
	 * Capture a snapshot for undo before executing a lighting intent.
	 */
	private async captureUndoSnapshot(spaceId: string, intent: LightingIntentDto): Promise<void> {
		try {
			const snapshot = await this.contextSnapshotService.captureSnapshot(spaceId);

			if (!snapshot) {
				this.logger.debug(`Could not capture snapshot for undo spaceId=${spaceId}`);

				return;
			}

			const actionDescription = this.buildIntentDescription(intent);

			this.undoHistoryService.pushSnapshot(snapshot, actionDescription, 'lighting');

			this.logger.debug(`Undo snapshot captured spaceId=${spaceId} action="${actionDescription}"`);
		} catch (error) {
			this.logger.error(`Error capturing undo snapshot spaceId=${spaceId}: ${error}`);
		}
	}

	/**
	 * Build a human-readable description of a lighting intent.
	 */
	private buildIntentDescription(intent: LightingIntentDto): string {
		switch (intent.type) {
			case LightingIntentType.OFF:
				return 'Turn lights off';
			case LightingIntentType.ON:
				return 'Turn lights on';
			case LightingIntentType.SET_MODE:
				return `Set lighting mode to ${intent.mode ?? 'unknown'}`;
			case LightingIntentType.BRIGHTNESS_DELTA:
				return intent.increase ? 'Increase brightness' : 'Decrease brightness';
			case LightingIntentType.ROLE_ON:
				return `Turn ${intent.role ?? 'role'} lights on`;
			case LightingIntentType.ROLE_OFF:
				return `Turn ${intent.role ?? 'role'} lights off`;
			case LightingIntentType.ROLE_BRIGHTNESS:
				return `Set ${intent.role ?? 'role'} brightness to ${intent.brightness ?? 0}%`;
			case LightingIntentType.ROLE_COLOR:
				return `Set ${intent.role ?? 'role'} color to ${intent.color ?? 'unknown'}`;
			case LightingIntentType.ROLE_COLOR_TEMP:
				return `Set ${intent.role ?? 'role'} color temperature to ${intent.colorTemperature ?? 0}K`;
			case LightingIntentType.ROLE_WHITE:
				return `Set ${intent.role ?? 'role'} white to ${intent.white ?? 0}%`;
			case LightingIntentType.ROLE_SET:
				return this.buildRoleSetDescription(intent);
			default:
				return 'Lighting intent';
		}
	}

	/**
	 * Build description for ROLE_SET intent showing all properties being set.
	 */
	private buildRoleSetDescription(intent: LightingIntentDto): string {
		const parts: string[] = [];
		const role = intent.role ?? 'role';

		if (intent.on !== undefined) {
			parts.push(intent.on ? 'on' : 'off');
		}
		if (intent.brightness !== undefined) {
			parts.push(`brightness ${intent.brightness}%`);
		}
		if (intent.color) {
			parts.push(`color ${intent.color}`);
		}
		if (intent.colorTemperature !== undefined) {
			parts.push(`temp ${intent.colorTemperature}K`);
		}
		if (intent.white !== undefined) {
			parts.push(`white ${intent.white}%`);
		}

		if (parts.length === 0) {
			return `Set ${role} properties`;
		}

		return `Set ${role}: ${parts.join(', ')}`;
	}

	/**
	 * Check if an intent type is a role-specific intent.
	 */
	private isRoleSpecificIntent(type: LightingIntentType): boolean {
		return [
			LightingIntentType.ROLE_ON,
			LightingIntentType.ROLE_OFF,
			LightingIntentType.ROLE_BRIGHTNESS,
			LightingIntentType.ROLE_COLOR,
			LightingIntentType.ROLE_COLOR_TEMP,
			LightingIntentType.ROLE_WHITE,
			LightingIntentType.ROLE_SET,
		].includes(type);
	}

	/**
	 * Execute a role-specific intent for lights in a specific role.
	 */
	private async executeRoleIntent(
		spaceId: string,
		allLights: LightDevice[],
		intent: LightingIntentDto,
	): Promise<IntentExecutionResult> {
		if (!intent.role) {
			this.logger.warn('Role-specific intent missing role parameter');
			return { success: false, affectedDevices: 0, failedDevices: 0 };
		}

		// Filter lights to only those with the specified role
		// Special case: OTHER role also matches unassigned lights (role = null)
		const roleLights = allLights.filter((light) => {
			if (intent.role === LightingRole.OTHER) {
				return light.role === LightingRole.OTHER || light.role === null;
			}
			return light.role === intent.role;
		});

		if (roleLights.length === 0) {
			this.logger.debug(`No lights found with role=${intent.role} in space id=${spaceId}`);
			return { success: true, affectedDevices: 0, failedDevices: 0 };
		}

		this.logger.debug(`Executing role intent type=${intent.type} role=${intent.role} lightsCount=${roleLights.length}`);

		let affectedDevices = 0;
		let failedDevices = 0;

		for (const light of roleLights) {
			const success = await this.executeRoleIntentForLight(light, intent);

			if (success) {
				affectedDevices++;
			} else {
				failedDevices++;
			}
		}

		const overallSuccess = failedDevices === 0 || affectedDevices > 0;

		this.logger.debug(
			`Role intent completed spaceId=${spaceId} role=${intent.role} affected=${affectedDevices} failed=${failedDevices}`,
		);

		return { success: overallSuccess, affectedDevices, failedDevices };
	}

	/**
	 * Execute a role-specific intent for a single light.
	 */
	private async executeRoleIntentForLight(light: LightDevice, intent: LightingIntentDto): Promise<boolean> {
		const platform = this.platformRegistryService.get(light.device);

		if (!platform) {
			this.logger.warn(`No platform registered for device id=${light.device.id} type=${light.device.type}`);
			return false;
		}

		const commands: IDevicePropertyData[] = [];

		switch (intent.type) {
			case LightingIntentType.ROLE_ON:
				commands.push({
					device: light.device,
					channel: light.lightChannel,
					property: light.onProperty,
					value: true,
				});
				break;

			case LightingIntentType.ROLE_OFF:
				commands.push({
					device: light.device,
					channel: light.lightChannel,
					property: light.onProperty,
					value: false,
				});
				break;

			case LightingIntentType.ROLE_BRIGHTNESS:
				if (intent.brightness === undefined) {
					this.logger.warn('ROLE_BRIGHTNESS intent missing brightness parameter');
					return false;
				}
				if (!light.brightnessProperty) {
					this.logger.debug(`Device does not support brightness deviceId=${light.device.id}`);
					return true; // Not a failure, device just doesn't support this
				}
				commands.push({
					device: light.device,
					channel: light.lightChannel,
					property: light.brightnessProperty,
					value: intent.brightness,
				});
				break;

			case LightingIntentType.ROLE_COLOR: {
				if (!intent.color) {
					this.logger.warn('ROLE_COLOR intent missing color parameter');
					return false;
				}
				// Check if device supports RGB color (needs all three properties)
				const hasRgb = light.colorRedProperty && light.colorGreenProperty && light.colorBlueProperty;
				// Check if device supports Hue-Saturation color
				const hasHueSat = light.hueProperty && light.saturationProperty;

				if (!hasRgb && !hasHueSat) {
					this.logger.debug(`Device does not support color control deviceId=${light.device.id}`);
					return true; // Not a failure, device just doesn't support this
				}

				if (hasRgb) {
					// Use RGB color mode
					const rgb = this.hexToRgb(intent.color);
					if (!rgb) {
						this.logger.warn(`Invalid hex color: ${intent.color}`);
						return false;
					}
					commands.push({
						device: light.device,
						channel: light.lightChannel,
						property: light.colorRedProperty,
						value: rgb.red,
					});
					commands.push({
						device: light.device,
						channel: light.lightChannel,
						property: light.colorGreenProperty,
						value: rgb.green,
					});
					commands.push({
						device: light.device,
						channel: light.lightChannel,
						property: light.colorBlueProperty,
						value: rgb.blue,
					});
				} else if (hasHueSat) {
					// Use Hue-Saturation color mode
					const hsl = this.hexToHsl(intent.color);
					if (!hsl) {
						this.logger.warn(`Invalid hex color: ${intent.color}`);
						return false;
					}
					commands.push({
						device: light.device,
						channel: light.lightChannel,
						property: light.hueProperty,
						value: hsl.hue,
					});
					commands.push({
						device: light.device,
						channel: light.lightChannel,
						property: light.saturationProperty,
						value: hsl.saturation,
					});
				}
				break;
			}

			case LightingIntentType.ROLE_COLOR_TEMP:
				if (intent.colorTemperature === undefined) {
					this.logger.warn('ROLE_COLOR_TEMP intent missing colorTemperature parameter');
					return false;
				}
				if (!light.colorTempProperty) {
					this.logger.debug(`Device does not support color temperature deviceId=${light.device.id}`);
					return true; // Not a failure, device just doesn't support this
				}
				commands.push({
					device: light.device,
					channel: light.lightChannel,
					property: light.colorTempProperty,
					value: intent.colorTemperature,
				});
				break;

			case LightingIntentType.ROLE_WHITE:
				if (intent.white === undefined) {
					this.logger.warn('ROLE_WHITE intent missing white parameter');
					return false;
				}
				if (!light.whiteProperty) {
					this.logger.debug(`Device does not support white channel deviceId=${light.device.id}`);
					return true; // Not a failure, device just doesn't support this
				}
				commands.push({
					device: light.device,
					channel: light.lightChannel,
					property: light.whiteProperty,
					value: intent.white,
				});
				break;

			case LightingIntentType.ROLE_SET:
				// Combined intent - set multiple properties at once
				// All properties are optional, only set what's provided

				// On/off state
				if (intent.on !== undefined) {
					commands.push({
						device: light.device,
						channel: light.lightChannel,
						property: light.onProperty,
						value: intent.on,
					});
				}

				// Brightness
				if (intent.brightness !== undefined && light.brightnessProperty) {
					commands.push({
						device: light.device,
						channel: light.lightChannel,
						property: light.brightnessProperty,
						value: intent.brightness,
					});
				}

				// Color (RGB or Hue-Saturation)
				if (intent.color) {
					const hasRgb = light.colorRedProperty && light.colorGreenProperty && light.colorBlueProperty;
					const hasHueSat = light.hueProperty && light.saturationProperty;

					if (hasRgb) {
						const rgb = this.hexToRgb(intent.color);
						if (rgb) {
							commands.push({
								device: light.device,
								channel: light.lightChannel,
								property: light.colorRedProperty,
								value: rgb.red,
							});
							commands.push({
								device: light.device,
								channel: light.lightChannel,
								property: light.colorGreenProperty,
								value: rgb.green,
							});
							commands.push({
								device: light.device,
								channel: light.lightChannel,
								property: light.colorBlueProperty,
								value: rgb.blue,
							});
						}
					} else if (hasHueSat) {
						const hsl = this.hexToHsl(intent.color);
						if (hsl) {
							commands.push({
								device: light.device,
								channel: light.lightChannel,
								property: light.hueProperty,
								value: hsl.hue,
							});
							commands.push({
								device: light.device,
								channel: light.lightChannel,
								property: light.saturationProperty,
								value: hsl.saturation,
							});
						}
					}
				}

				// Color temperature
				if (intent.colorTemperature !== undefined && light.colorTempProperty) {
					commands.push({
						device: light.device,
						channel: light.lightChannel,
						property: light.colorTempProperty,
						value: intent.colorTemperature,
					});
				}

				// White level
				if (intent.white !== undefined && light.whiteProperty) {
					commands.push({
						device: light.device,
						channel: light.lightChannel,
						property: light.whiteProperty,
						value: intent.white,
					});
				}
				break;

			default:
				this.logger.warn(`Unknown role intent type: ${String(intent.type)}`);
				return false;
		}

		if (commands.length === 0) {
			return true;
		}

		try {
			const success = await platform.processBatch(commands);

			if (!success) {
				this.logger.error(`Role intent execution failed for device id=${light.device.id}`);
				return false;
			}

			return true;
		} catch (error) {
			this.logger.error(`Error executing role intent for device id=${light.device.id}: ${error}`);
			return false;
		}
	}

	/**
	 * Convert hex color string to RGB object.
	 */
	private hexToRgb(hex: string): { red: number; green: number; blue: number } | null {
		const result = /^#([a-fA-F0-9]{2})([a-fA-F0-9]{2})([a-fA-F0-9]{2})$/.exec(hex);

		if (!result) {
			return null;
		}

		return {
			red: parseInt(result[1], 16),
			green: parseInt(result[2], 16),
			blue: parseInt(result[3], 16),
		};
	}

	/**
	 * Convert hex color string to HSL object.
	 * Returns hue in degrees (0-360) and saturation as percentage (0-100).
	 */
	private hexToHsl(hex: string): { hue: number; saturation: number } | null {
		const rgb = this.hexToRgb(hex);

		if (!rgb) {
			return null;
		}

		// Normalize RGB values to 0-1 range
		const r = rgb.red / 255;
		const g = rgb.green / 255;
		const b = rgb.blue / 255;

		const max = Math.max(r, g, b);
		const min = Math.min(r, g, b);
		const delta = max - min;

		let hue = 0;

		if (delta !== 0) {
			if (max === r) {
				hue = ((g - b) / delta) % 6;
			} else if (max === g) {
				hue = (b - r) / delta + 2;
			} else {
				hue = (r - g) / delta + 4;
			}

			hue = Math.round(hue * 60);

			if (hue < 0) {
				hue += 360;
			}
		}

		// Calculate lightness (used for saturation calculation)
		const lightness = (max + min) / 2;

		// Calculate saturation
		let saturation = 0;

		if (delta !== 0) {
			saturation = delta / (1 - Math.abs(2 * lightness - 1));
		}

		// Convert saturation to percentage (0-100)
		saturation = Math.round(saturation * 100);

		return { hue, saturation };
	}
}

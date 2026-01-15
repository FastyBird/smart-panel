import { Inject, Injectable, forwardRef } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { IDevicePropertyData } from '../../devices/platforms/device.platform';
import { PlatformRegistryService } from '../../devices/services/platform.registry.service';
import { LightingIntentDto } from '../dto/lighting-intent.dto';
import {
	BRIGHTNESS_DELTA_STEPS,
	BrightnessDelta,
	LIGHTING_MODE_BRIGHTNESS,
	LIGHTING_MODE_ORCHESTRATION,
	LightingIntentType,
	LightingMode,
	LightingRole,
	RoleBrightnessRule,
	SPACES_MODULE_NAME,
} from '../spaces.constants';

import { IntentExecutionResult, SpaceIntentBaseService } from './space-intent-base.service';
import { SpaceContextSnapshotService } from './space-context-snapshot.service';
import { SpaceLightingRoleService } from './space-lighting-role.service';
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
		@Inject(forwardRef(() => SpaceContextSnapshotService))
		private readonly contextSnapshotService: SpaceContextSnapshotService,
		@Inject(forwardRef(() => SpaceUndoHistoryService))
		private readonly undoHistoryService: SpaceUndoHistoryService,
	) {
		super();
	}

	/**
	 * Execute a lighting intent for all lights in a space.
	 */
	async executeLightingIntent(spaceId: string, intent: LightingIntentDto): Promise<IntentExecutionResult> {
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

		this.logger.debug(
			`Lighting intent completed spaceId=${spaceId} affected=${affectedDevices} failed=${failedDevices}`,
		);

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

		// Calculate new brightness
		const deltaValue = BRIGHTNESS_DELTA_STEPS[delta];
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
			default:
				return 'Lighting intent';
		}
	}
}

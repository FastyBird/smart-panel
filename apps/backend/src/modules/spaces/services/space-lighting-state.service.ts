import { Inject, Injectable, forwardRef } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { IntentTimeseriesService } from '../../intents/services/intent-timeseries.service';
import { LightingMode, LightingRole, RoleBrightnessRule, SPACES_MODULE_NAME } from '../spaces.constants';
import { IntentSpecLoaderService, ResolvedModeOrchestration } from '../spec';

import { SpaceLightingRoleService } from './space-lighting-role.service';
import { SpacesService } from './spaces.service';

/**
 * Last intent values for a role - derived from last applied mode
 */
export interface RoleLastIntent {
	brightness: number | null;
	// Color properties can be extended when mode orchestration supports them
}

/**
 * Aggregated state for a single lighting role.
 * Current values are shown only when uniform across all devices in the role.
 * When devices have different values, current value is null and isMixed is true.
 */
export interface RoleAggregatedState {
	role: LightingRole;
	// On/off state
	isOn: boolean;
	isOnMixed: boolean;
	// Current values - null when devices have different values (mixed)
	brightness: number | null;
	colorTemperature: number | null;
	color: string | null; // Hex color string e.g. "#ff6b35"
	white: number | null;
	// Mixed flags for each property
	isBrightnessMixed: boolean;
	isColorTemperatureMixed: boolean;
	isColorMixed: boolean;
	isWhiteMixed: boolean;
	// Last intent values - what was last set via mode/intent
	lastIntent: RoleLastIntent | null;
	// Device counts
	devicesCount: number;
	devicesOn: number;
}

/**
 * Aggregated state for "other" lights (no role assigned)
 */
export interface OtherLightsState {
	isOn: boolean;
	isOnMixed: boolean;
	brightness: number | null;
	colorTemperature: number | null;
	color: string | null;
	white: number | null;
	isBrightnessMixed: boolean;
	isColorTemperatureMixed: boolean;
	isColorMixed: boolean;
	isWhiteMixed: boolean;
	devicesCount: number;
	devicesOn: number;
}

/**
 * Mode match result
 */
export interface ModeMatch {
	mode: LightingMode;
	confidence: 'exact' | 'approximate';
	matchPercentage: number;
}

/**
 * Complete lighting state for a space
 */
export interface SpaceLightingState {
	// Mode detection
	detectedMode: LightingMode | null;
	modeConfidence: 'exact' | 'approximate' | 'none';
	modeMatchPercentage: number | null;

	// Last applied mode (from storage)
	lastAppliedMode: LightingMode | null;
	lastAppliedAt: Date | null;

	// Summary
	totalLights: number;
	lightsOn: number;
	averageBrightness: number | null;

	// Per-role state
	roles: Partial<Record<LightingRole, RoleAggregatedState>>;

	// Lights without role
	other: OtherLightsState;
}

/**
 * Internal light state for aggregation
 */
interface LightState {
	deviceId: string;
	channelId: string;
	role: LightingRole | null;
	isOn: boolean;
	brightness: number | null;
	colorTemperature: number | null;
	colorRed: number | null;
	colorGreen: number | null;
	colorBlue: number | null;
	white: number | null;
}

/**
 * Service for calculating aggregated lighting state per role.
 * Provides state data for UI display without panel-side calculation.
 */
@Injectable()
export class SpaceLightingStateService {
	private readonly logger = createExtensionLogger(SPACES_MODULE_NAME, 'SpaceLightingStateService');

	constructor(
		private readonly spacesService: SpacesService,
		private readonly lightingRoleService: SpaceLightingRoleService,
		@Inject(forwardRef(() => IntentTimeseriesService))
		private readonly intentTimeseriesService: IntentTimeseriesService,
		private readonly intentSpecLoaderService: IntentSpecLoaderService,
	) {}

	/**
	 * Get the complete aggregated lighting state for a space.
	 * Includes per-role state, mode detection, and summary.
	 */
	async getLightingState(spaceId: string): Promise<SpaceLightingState | null> {
		// Verify space exists
		const space = await this.spacesService.findOne(spaceId);

		if (!space) {
			this.logger.warn(`Space not found id=${spaceId}`);

			return null;
		}

		// Get all light states
		const lights = await this.getLightStates(spaceId);

		if (lights.length === 0) {
			return this.buildEmptyState();
		}

		// Get last applied mode from InfluxDB
		const lastApplied = await this.intentTimeseriesService.getLastLightingMode(spaceId);
		const lastAppliedMode = lastApplied?.mode
			? Object.values(LightingMode).includes(lastApplied.mode as LightingMode)
				? (lastApplied.mode as LightingMode)
				: null
			: null;

		// Aggregate by role (passing lastAppliedMode for lastIntent derivation)
		const roleStates = this.aggregateByRole(lights, lastAppliedMode);

		// Aggregate "other" lights (no role)
		const otherState = this.aggregateOther(lights);

		// Calculate summary
		const summary = this.calculateSummary(lights);

		// Detect current mode
		const modeMatch = this.detectMode(roleStates, otherState, lights);

		return {
			detectedMode: modeMatch?.mode ?? null,
			modeConfidence: modeMatch ? modeMatch.confidence : 'none',
			modeMatchPercentage: modeMatch?.matchPercentage ?? null,

			lastAppliedMode,
			lastAppliedAt: lastApplied?.appliedAt ?? null,

			totalLights: summary.totalLights,
			lightsOn: summary.lightsOn,
			averageBrightness: summary.averageBrightness,

			roles: roleStates,
			other: otherState,
		};
	}

	/**
	 * Get all light states in a space with their roles
	 */
	private async getLightStates(spaceId: string): Promise<LightState[]> {
		const devices = await this.spacesService.findDevicesBySpace(spaceId);
		const roleMap = await this.lightingRoleService.getRoleMap(spaceId);

		const lights: LightState[] = [];

		for (const device of devices) {
			if (device.category !== DeviceCategory.LIGHTING) {
				continue;
			}

			const lightChannels = device.channels?.filter((ch) => ch.category === ChannelCategory.LIGHT) ?? [];

			for (const channel of lightChannels) {
				const lightState = this.extractLightState(device, channel, roleMap);

				if (lightState) {
					// Skip HIDDEN lights - they should not appear in state
					if (lightState.role === LightingRole.HIDDEN) {
						continue;
					}

					lights.push(lightState);
				}
			}
		}

		return lights;
	}

	/**
	 * Extract state from a single light
	 */
	private extractLightState(
		device: DeviceEntity,
		channel: ChannelEntity,
		roleMap: Map<string, { role: LightingRole; priority: number }>,
	): LightState | null {
		const onProperty = channel.properties?.find((p) => p.category === PropertyCategory.ON);

		if (!onProperty) {
			return null;
		}

		const brightnessProperty = channel.properties?.find((p) => p.category === PropertyCategory.BRIGHTNESS);
		const colorTempProperty = channel.properties?.find((p) => p.category === PropertyCategory.COLOR_TEMPERATURE);
		const colorRedProperty = channel.properties?.find((p) => p.category === PropertyCategory.COLOR_RED);
		const colorGreenProperty = channel.properties?.find((p) => p.category === PropertyCategory.COLOR_GREEN);
		const colorBlueProperty = channel.properties?.find((p) => p.category === PropertyCategory.COLOR_BLUE);
		const whiteProperty = channel.properties?.find((p) => p.category === PropertyCategory.COLOR_WHITE);

		const roleKey = `${device.id}:${channel.id}`;
		const roleEntity = roleMap.get(roleKey);

		return {
			deviceId: device.id,
			channelId: channel.id,
			role: roleEntity?.role ?? null,
			isOn: this.getPropertyBooleanValue(onProperty),
			brightness: this.getPropertyNumericValue(brightnessProperty),
			colorTemperature: this.getPropertyNumericValue(colorTempProperty),
			colorRed: this.getPropertyNumericValue(colorRedProperty),
			colorGreen: this.getPropertyNumericValue(colorGreenProperty),
			colorBlue: this.getPropertyNumericValue(colorBlueProperty),
			white: this.getPropertyNumericValue(whiteProperty),
		};
	}

	/**
	 * Aggregate lights by role.
	 * Values are shown only when uniform across all devices in the role.
	 * NOTE: Only EXPLICITLY assigned roles are included here. Unassigned lights
	 * (role === null) are handled separately in `other` to avoid double-counting.
	 * Mode detection will consider unassigned lights when matching the OTHER rule.
	 */
	private aggregateByRole(
		lights: LightState[],
		lastAppliedMode: LightingMode | null,
	): Partial<Record<LightingRole, RoleAggregatedState>> {
		const roleStates: Partial<Record<LightingRole, RoleAggregatedState>> = {};

		// Group lights by EXPLICITLY assigned roles only (null and HIDDEN excluded)
		const roleGroups = new Map<LightingRole, LightState[]>();

		for (const light of lights) {
			// Skip HIDDEN lights and unassigned lights (null handled in `other`)
			if (light.role === null || light.role === LightingRole.HIDDEN) {
				continue;
			}

			if (!roleGroups.has(light.role)) {
				roleGroups.set(light.role, []);
			}

			roleGroups.get(light.role).push(light);
		}

		// Check if NIGHT mode fallback should be used (no night lights exist)
		const nightFallbackActive = lastAppliedMode === LightingMode.NIGHT && !roleGroups.has(LightingRole.NIGHT);

		// Calculate aggregated state for each role
		for (const [role, roleLights] of roleGroups) {
			roleStates[role] = this.aggregateLightGroup(role, roleLights, lastAppliedMode, nightFallbackActive);
		}

		return roleStates;
	}

	/**
	 * Aggregate a group of lights into a single state.
	 * Returns uniform values when all devices match, null when mixed.
	 */
	private aggregateLightGroup(
		role: LightingRole,
		lights: LightState[],
		lastAppliedMode: LightingMode | null,
		nightFallbackActive: boolean = false,
	): RoleAggregatedState {
		// On/off state
		const onStates = lights.map((l) => l.isOn);
		const devicesOn = onStates.filter((on) => on).length;
		const isOn = devicesOn > 0;
		const isOnMixed = !onStates.every((on) => on === onStates[0]);

		// Brightness - uniform value or null if mixed
		const brightnessResult = this.getUniformValue(lights.map((l) => l.brightness));

		// Color temperature - uniform value or null if mixed
		const colorTempResult = this.getUniformValue(lights.map((l) => l.colorTemperature));

		// Color (RGB) - uniform value or null if mixed
		const colorResult = this.getUniformColor(lights);

		// White - uniform value or null if mixed
		const whiteResult = this.getUniformValue(lights.map((l) => l.white));

		// Derive last intent from last applied mode
		const lastIntent = this.deriveLastIntent(role, lastAppliedMode, nightFallbackActive);

		return {
			role,
			isOn,
			isOnMixed,
			brightness: brightnessResult.value,
			colorTemperature: colorTempResult.value,
			color: colorResult.value,
			white: whiteResult.value,
			isBrightnessMixed: brightnessResult.isMixed,
			isColorTemperatureMixed: colorTempResult.isMixed,
			isColorMixed: colorResult.isMixed,
			isWhiteMixed: whiteResult.isMixed,
			lastIntent,
			devicesCount: lights.length,
			devicesOn,
		};
	}

	/**
	 * Aggregate lights without role ("other" lights)
	 */
	private aggregateOther(lights: LightState[]): OtherLightsState {
		const otherLights = lights.filter((l) => l.role === null);

		if (otherLights.length === 0) {
			return {
				isOn: false,
				isOnMixed: false,
				brightness: null,
				colorTemperature: null,
				color: null,
				white: null,
				isBrightnessMixed: false,
				isColorTemperatureMixed: false,
				isColorMixed: false,
				isWhiteMixed: false,
				devicesCount: 0,
				devicesOn: 0,
			};
		}

		const onStates = otherLights.map((l) => l.isOn);
		const devicesOn = onStates.filter((on) => on).length;
		const isOn = devicesOn > 0;
		const isOnMixed = !onStates.every((on) => on === onStates[0]);

		const brightnessResult = this.getUniformValue(otherLights.map((l) => l.brightness));
		const colorTempResult = this.getUniformValue(otherLights.map((l) => l.colorTemperature));
		const colorResult = this.getUniformColor(otherLights);
		const whiteResult = this.getUniformValue(otherLights.map((l) => l.white));

		return {
			isOn,
			isOnMixed,
			brightness: brightnessResult.value,
			colorTemperature: colorTempResult.value,
			color: colorResult.value,
			white: whiteResult.value,
			isBrightnessMixed: brightnessResult.isMixed,
			isColorTemperatureMixed: colorTempResult.isMixed,
			isColorMixed: colorResult.isMixed,
			isWhiteMixed: whiteResult.isMixed,
			devicesCount: otherLights.length,
			devicesOn,
		};
	}

	/**
	 * Get uniform value from array of values.
	 * Returns the value if all non-null values are the same (within tolerance),
	 * null if values differ (mixed).
	 */
	private getUniformValue(values: (number | null)[]): { value: number | null; isMixed: boolean } {
		const nonNullValues = values.filter((v): v is number => v !== null);

		if (nonNullValues.length === 0) {
			return { value: null, isMixed: false };
		}

		// Check if all values are within tolerance (±5)
		const first = nonNullValues[0];
		const allSame = nonNullValues.every((v) => Math.abs(v - first) <= 5);

		if (allSame) {
			// Return the rounded average when uniform
			const avg = Math.round(nonNullValues.reduce((a, b) => a + b, 0) / nonNullValues.length);

			return { value: avg, isMixed: false };
		}

		return { value: null, isMixed: true };
	}

	/**
	 * Get uniform color from lights.
	 * Returns hex color string if all lights have same RGB, null if mixed.
	 */
	private getUniformColor(lights: LightState[]): { value: string | null; isMixed: boolean } {
		// Get lights that have all RGB components
		const colorLights = lights.filter((l) => l.colorRed !== null && l.colorGreen !== null && l.colorBlue !== null);

		if (colorLights.length === 0) {
			return { value: null, isMixed: false };
		}

		// Check if all colors are the same (within tolerance)
		const firstR = colorLights[0].colorRed;
		const firstG = colorLights[0].colorGreen;
		const firstB = colorLights[0].colorBlue;

		const tolerance = 10; // Allow ±10 per channel

		const allSame = colorLights.every(
			(l) =>
				Math.abs(l.colorRed - firstR) <= tolerance &&
				Math.abs(l.colorGreen - firstG) <= tolerance &&
				Math.abs(l.colorBlue - firstB) <= tolerance,
		);

		if (allSame) {
			// Calculate average and convert to hex
			const avgR = Math.round(colorLights.reduce((a, l) => a + l.colorRed, 0) / colorLights.length);
			const avgG = Math.round(colorLights.reduce((a, l) => a + l.colorGreen, 0) / colorLights.length);
			const avgB = Math.round(colorLights.reduce((a, l) => a + l.colorBlue, 0) / colorLights.length);

			const hex = `#${avgR.toString(16).padStart(2, '0')}${avgG.toString(16).padStart(2, '0')}${avgB.toString(16).padStart(2, '0')}`;

			return { value: hex, isMixed: false };
		}

		return { value: null, isMixed: true };
	}

	/**
	 * Derive last intent values for a role from the last applied mode.
	 * Uses YAML mode orchestration config to get what values were set.
	 * Accounts for fallback behavior (e.g., night mode using main lights).
	 */
	private deriveLastIntent(
		role: LightingRole,
		lastAppliedMode: LightingMode | null,
		nightFallbackActive: boolean = false,
	): RoleLastIntent | null {
		if (!lastAppliedMode) {
			return null;
		}

		const config = this.intentSpecLoaderService.getLightingModeOrchestration(lastAppliedMode);

		if (!config) {
			return null;
		}

		// Check if this role was affected by fallback
		if (nightFallbackActive && config.fallbackRoles?.includes(role)) {
			// Fallback role gets fallback brightness instead of normal rule
			return {
				brightness: config.fallbackBrightness ?? 20,
			};
		}

		const rule = config.roles[role];

		if (!rule) {
			// Role not in mode's rules - check if it's OTHER role
			if (role === LightingRole.OTHER) {
				// OTHER lights use mode's MVP brightness in fallback mode
				return {
					brightness: config.mvpBrightness,
				};
			}

			return null;
		}

		// If rule says OFF, brightness intent is 0
		if (!rule.on) {
			return {
				brightness: 0,
			};
		}

		return {
			brightness: rule.brightness,
		};
	}

	/**
	 * Calculate overall summary
	 */
	private calculateSummary(lights: LightState[]): {
		totalLights: number;
		lightsOn: number;
		averageBrightness: number | null;
	} {
		const lightsOn = lights.filter((l) => l.isOn).length;

		const onBrightnessValues = lights.filter((l) => l.isOn && l.brightness !== null).map((l) => l.brightness);

		const averageBrightness =
			onBrightnessValues.length > 0
				? Math.round(onBrightnessValues.reduce((a, b) => a + b, 0) / onBrightnessValues.length)
				: null;

		return {
			totalLights: lights.length,
			lightsOn,
			averageBrightness,
		};
	}

	/**
	 * Detect which mode the current state matches (if any)
	 */
	private detectMode(
		roleStates: Partial<Record<LightingRole, RoleAggregatedState>>,
		otherState: OtherLightsState,
		lights: LightState[],
	): ModeMatch | null {
		const hasAnyRoles = Object.keys(roleStates).length > 0;

		// If no roles configured, check for MVP fallback mode matching
		if (!hasAnyRoles) {
			return this.detectMvpMode(lights);
		}

		// Get all available modes from YAML spec (includes user-defined custom modes)
		const allModes = this.intentSpecLoaderService.getAllLightingModeOrchestrations();
		let bestMatch: ModeMatch | null = null;

		for (const modeId of allModes.keys()) {
			const match = this.matchMode(modeId as LightingMode, roleStates, otherState);

			if (match && (!bestMatch || match.matchPercentage > bestMatch.matchPercentage)) {
				bestMatch = match;
			}
		}

		return bestMatch;
	}

	/**
	 * Detect mode in MVP scenario (no roles configured).
	 * Uses mvpBrightness values from YAML mode specifications.
	 */
	private detectMvpMode(lights: LightState[]): ModeMatch | null {
		const onLights = lights.filter((l) => l.isOn);

		if (onLights.length === 0) {
			return null; // All off - no mode
		}

		// Check if all ON lights have similar brightness
		const brightnessValues = onLights.filter((l) => l.brightness !== null).map((l) => l.brightness);

		if (brightnessValues.length === 0) {
			return null;
		}

		const avgBrightness = brightnessValues.reduce((a, b) => a + b, 0) / brightnessValues.length;

		// Build MVP brightness lookup from YAML spec
		const allModes = this.intentSpecLoaderService.getAllLightingModeOrchestrations();
		const mvpModes: Array<{ mode: LightingMode; brightness: number }> = [];

		for (const [modeId, config] of allModes) {
			if (config.mvpBrightness !== undefined && config.mvpBrightness !== null) {
				mvpModes.push({
					mode: modeId as LightingMode,
					brightness: config.mvpBrightness,
				});
			}
		}

		// Sort by brightness descending to match highest first (WORK before RELAX before NIGHT)
		mvpModes.sort((a, b) => b.brightness - a.brightness);

		for (const { mode, brightness } of mvpModes) {
			if (Math.abs(avgBrightness - brightness) <= 15) {
				// Within 15% tolerance
				return {
					mode,
					confidence: Math.abs(avgBrightness - brightness) <= 5 ? 'exact' : 'approximate',
					matchPercentage: 100 - Math.abs(avgBrightness - brightness),
				};
			}
		}

		return null;
	}

	/**
	 * Match current state against a specific mode's rules.
	 * Includes support for OTHER role matching against unassigned lights (otherState).
	 */
	private matchMode(
		mode: LightingMode,
		roleStates: Partial<Record<LightingRole, RoleAggregatedState>>,
		otherState: OtherLightsState,
	): ModeMatch | null {
		const config = this.intentSpecLoaderService.getLightingModeOrchestration(mode);

		if (!config) {
			return null;
		}

		const rules = config.roles;

		// Check if mode has fallback and no lights exist for the primary roles
		// (e.g., NIGHT mode with no night lights falls back to main)
		const useFallback = this.shouldUseFallback(mode, config, roleStates);

		let matchingRoles = 0;
		let totalRoles = 0;
		let exactMatches = 0;

		for (const [roleStr, rule] of Object.entries(rules)) {
			const role = roleStr as LightingRole;

			// For OTHER role, use otherState (unassigned lights) if no explicit OTHER assignments exist
			let roleState: RoleAggregatedState | undefined = roleStates[role];

			if (role === LightingRole.OTHER && !roleState && otherState.devicesCount > 0) {
				// Create a synthetic RoleAggregatedState from otherState for matching
				roleState = {
					role: LightingRole.OTHER,
					isOn: otherState.isOn,
					isOnMixed: otherState.isOnMixed,
					brightness: otherState.brightness,
					colorTemperature: otherState.colorTemperature,
					color: otherState.color,
					white: otherState.white,
					isBrightnessMixed: otherState.isBrightnessMixed,
					isColorTemperatureMixed: otherState.isColorTemperatureMixed,
					isColorMixed: otherState.isColorMixed,
					isWhiteMixed: otherState.isWhiteMixed,
					lastIntent: null,
					devicesCount: otherState.devicesCount,
					devicesOn: otherState.devicesOn,
				};
			}

			// Skip roles that don't exist in current space
			if (!roleState) {
				continue;
			}

			totalRoles++;

			// Get effective rule considering fallback
			const effectiveRule = this.getEffectiveRule(role, rule, useFallback, config);
			const matches = this.matchRoleRule(roleState, effectiveRule);

			if (matches.matches) {
				matchingRoles++;

				if (matches.exact) {
					exactMatches++;
				}
			}
		}

		if (totalRoles === 0) {
			return null;
		}

		const matchPercentage = Math.round((matchingRoles / totalRoles) * 100);

		// Require at least 70% match to consider it a mode
		if (matchPercentage < 70) {
			return null;
		}

		return {
			mode,
			confidence: exactMatches === totalRoles ? 'exact' : 'approximate',
			matchPercentage,
		};
	}

	/**
	 * Check if fallback should be used for mode matching.
	 * For example, NIGHT mode falls back to MAIN lights if no NIGHT lights exist.
	 */
	private shouldUseFallback(
		mode: LightingMode | string,
		config: ResolvedModeOrchestration,
		roleStates: Partial<Record<LightingRole, RoleAggregatedState>>,
	): boolean {
		// Only check fallback for modes that have fallback config
		if (!config.fallbackRoles || config.fallbackRoles.length === 0) {
			return false;
		}

		// For NIGHT mode, check if there are any night lights
		if (mode === (LightingMode.NIGHT as string)) {
			const nightState = roleStates[LightingRole.NIGHT];
			return !nightState || nightState.devicesCount === 0;
		}

		return false;
	}

	/**
	 * Get the effective rule for a role, considering fallback.
	 */
	private getEffectiveRule(
		role: LightingRole,
		originalRule: RoleBrightnessRule,
		useFallback: boolean,
		config: ResolvedModeOrchestration,
	): RoleBrightnessRule {
		if (!useFallback) {
			return originalRule;
		}

		// If using fallback and this role is a fallback role, adjust the expected state
		if (config.fallbackRoles?.includes(role)) {
			return {
				on: true,
				brightness: config.fallbackBrightness ?? 20,
			};
		}

		return originalRule;
	}

	/**
	 * Check if a role's current state matches a rule.
	 * Accounts for mixed on/off states - partial on/off is not considered a match.
	 */
	private matchRoleRule(
		roleState: RoleAggregatedState,
		rule: RoleBrightnessRule,
	): { matches: boolean; exact: boolean } {
		// Handle mixed on/off state - this is never a full match
		if (roleState.isOnMixed) {
			// If rule says ON but some devices are off, or rule says OFF but some devices are on,
			// this is not a proper match (partial state doesn't match expected uniform state)
			return { matches: false, exact: false };
		}

		// Check on/off state (all devices are uniform at this point)
		if (rule.on !== roleState.isOn) {
			return { matches: false, exact: false };
		}

		// If rule says OFF and all devices are off, we're done
		if (!rule.on) {
			return { matches: true, exact: true };
		}

		// Check brightness if specified and not mixed
		if (rule.brightness !== null && roleState.brightness !== null && !roleState.isBrightnessMixed) {
			const diff = Math.abs(rule.brightness - roleState.brightness);

			if (diff <= 5) {
				return { matches: true, exact: true };
			} else if (diff <= 15) {
				return { matches: true, exact: false };
			} else {
				return { matches: false, exact: false };
			}
		}

		// If brightness is mixed, can't match exactly
		if (roleState.isBrightnessMixed) {
			return { matches: true, exact: false };
		}

		// ON with no brightness requirement - matches
		return { matches: true, exact: true };
	}

	/**
	 * Build empty state for spaces with no lights
	 */
	private buildEmptyState(): SpaceLightingState {
		return {
			detectedMode: null,
			modeConfidence: 'none',
			modeMatchPercentage: null,
			lastAppliedMode: null,
			lastAppliedAt: null,
			totalLights: 0,
			lightsOn: 0,
			averageBrightness: null,
			roles: {},
			other: {
				isOn: false,
				isOnMixed: false,
				brightness: null,
				colorTemperature: null,
				color: null,
				white: null,
				isBrightnessMixed: false,
				isColorTemperatureMixed: false,
				isColorMixed: false,
				isWhiteMixed: false,
				devicesCount: 0,
				devicesOn: 0,
			},
		};
	}

	/**
	 * Get boolean value from a property
	 */
	private getPropertyBooleanValue(property: ChannelPropertyEntity | null | undefined): boolean {
		if (!property) {
			return false;
		}

		const value = property.value;

		if (typeof value === 'boolean') {
			return value;
		}

		if (value === 'true' || value === 1 || value === '1' || value === 'on') {
			return true;
		}

		return false;
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

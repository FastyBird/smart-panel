import { Inject, Injectable, forwardRef } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { hsvToHex } from '../../../common/utils/color.utils';
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
	// Whether the space has any lights
	hasLights: boolean;

	// Mode detection
	detectedMode: LightingMode | null;
	modeConfidence: 'exact' | 'approximate' | 'none';
	modeMatchPercentage: number | null;
	// Whether the current mode was set by intent (true) or achieved by manual adjustments (false)
	isModeFromIntent: boolean;

	// Last applied mode (from storage)
	lastAppliedMode: LightingMode | null;
	lastAppliedAt: Date | null;

	// Summary
	totalLights: number;
	lightsOn: number;
	averageBrightness: number | null;

	// Per-role state
	roles: Partial<Record<LightingRole, RoleAggregatedState>>;
	// Count of lights by role
	lightsByRole: Record<string, number>;

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
	colorHue: number | null;
	colorSaturation: number | null;
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
	 *
	 * @param spaceId - The space ID to get lighting state for
	 * @param options.synchronizeModeValidity - If true (default), invalidates mode validity
	 *        in InfluxDB when detected mode diverges from last applied mode. This ensures
	 *        accurate `isModeFromIntent` tracking. Set to false for read-only operations
	 *        where the side effect is not needed (e.g., internal state broadcasts).
	 */
	async getLightingState(
		spaceId: string,
		options: { synchronizeModeValidity?: boolean } = {},
	): Promise<SpaceLightingState | null> {
		const { synchronizeModeValidity = true } = options;
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

		// Detect current mode (prefer lastAppliedMode as tie-breaker)
		const modeMatch = this.detectMode(roleStates, otherState, lights, lastAppliedMode);

		// Calculate lights by role count
		const lightsByRole: Record<string, number> = {};
		for (const light of lights) {
			const roleKey = light.role ?? 'unassigned';
			lightsByRole[roleKey] = (lightsByRole[roleKey] ?? 0) + 1;
		}

		// Determine if mode was set by intent using mode validity tracking
		const detectedMode = modeMatch?.mode ?? null;

		// Get current mode validity from InfluxDB
		const modeValidity = await this.intentTimeseriesService.getModeValidity(spaceId, 'lighting');
		let modeValid = modeValidity?.modeValid ?? false;

		// If detected mode diverges from last applied mode, invalidate the mode
		// This ensures that once user manually changes settings, intent mode is no longer valid
		// Only perform this write operation when synchronizeModeValidity is enabled
		if (synchronizeModeValidity && detectedMode !== lastAppliedMode && modeValid) {
			await this.intentTimeseriesService.storeModeValidity(spaceId, 'lighting', false);
			modeValid = false;
		}

		// Mode is "from intent" only if detected mode matches last applied AND mode is still valid
		// This prevents scenario 4: manually adjusting back to mode position still shows as intent
		const isModeFromIntent = detectedMode !== null && detectedMode === lastAppliedMode && modeValid;

		return {
			hasLights: true,
			detectedMode,
			modeConfidence: modeMatch ? modeMatch.confidence : 'none',
			modeMatchPercentage: modeMatch?.matchPercentage ?? null,
			isModeFromIntent,

			lastAppliedMode,
			lastAppliedAt: lastApplied?.appliedAt ?? null,

			totalLights: summary.totalLights,
			lightsOn: summary.lightsOn,
			averageBrightness: summary.averageBrightness,

			roles: roleStates,
			lightsByRole,
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
		const colorHueProperty = channel.properties?.find((p) => p.category === PropertyCategory.HUE);
		const colorSaturationProperty = channel.properties?.find((p) => p.category === PropertyCategory.SATURATION);
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
			colorHue: this.getPropertyNumericValue(colorHueProperty),
			colorSaturation: this.getPropertyNumericValue(colorSaturationProperty),
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

		// Brightness - uniform value or null if mixed (tolerance 5 on 0-100 scale)
		const brightnessResult = this.getUniformValue(lights.map((l) => l.brightness));

		// Color temperature - uniform value or null if mixed (tolerance 100 on 2700-6500K scale)
		const colorTempResult = this.getUniformValue(
			lights.map((l) => l.colorTemperature),
			100,
		);

		// Color (RGB) - uniform value or null if mixed
		const colorResult = this.getUniformColor(lights);

		// White - uniform value or null if mixed (tolerance 5 on 0-100 scale)
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
		const colorTempResult = this.getUniformValue(
			otherLights.map((l) => l.colorTemperature),
			100,
		);
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
	 *
	 * Uses range-based check (max - min <= tolerance) which is order-independent.
	 */
	private getUniformValue(
		values: (number | null)[],
		tolerance: number = 5,
	): { value: number | null; isMixed: boolean } {
		const nonNullValues = values.filter((v): v is number => v !== null);

		if (nonNullValues.length === 0) {
			return { value: null, isMixed: false };
		}

		const min = Math.min(...nonNullValues);
		const max = Math.max(...nonNullValues);

		// Values are uniform if the range (max - min) is within tolerance
		if (max - min <= tolerance) {
			// Return the rounded average when uniform
			const avg = Math.round(nonNullValues.reduce((a, b) => a + b, 0) / nonNullValues.length);

			return { value: avg, isMixed: false };
		}

		return { value: null, isMixed: true };
	}

	/**
	 * Get uniform color from lights.
	 * Returns hex color string if all lights have same RGB or same hue+saturation, null if mixed.
	 */
	private getUniformColor(lights: LightState[]): { value: string | null; isMixed: boolean } {
		// Prefer RGB lights
		const rgbLights = lights.filter((l) => l.colorRed !== null && l.colorGreen !== null && l.colorBlue !== null);

		if (rgbLights.length > 0) {
			const firstR = rgbLights[0].colorRed;
			const firstG = rgbLights[0].colorGreen;
			const firstB = rgbLights[0].colorBlue;
			const tolerance = 10;

			const allSame = rgbLights.every(
				(l) =>
					Math.abs(l.colorRed - firstR) <= tolerance &&
					Math.abs(l.colorGreen - firstG) <= tolerance &&
					Math.abs(l.colorBlue - firstB) <= tolerance,
			);

			if (allSame) {
				const avgR = Math.round(rgbLights.reduce((a, l) => a + l.colorRed, 0) / rgbLights.length);
				const avgG = Math.round(rgbLights.reduce((a, l) => a + l.colorGreen, 0) / rgbLights.length);
				const avgB = Math.round(rgbLights.reduce((a, l) => a + l.colorBlue, 0) / rgbLights.length);
				const hex = `#${avgR.toString(16).padStart(2, '0')}${avgG.toString(16).padStart(2, '0')}${avgB.toString(16).padStart(2, '0')}`;
				return { value: hex, isMixed: false };
			}
			return { value: null, isMixed: true };
		}

		// Fallback: hue + saturation lights (no RGB). Include hue-only (saturation defaults to 1)
		const hueSatLights = lights.filter((l) => l.colorHue !== null);

		if (hueSatLights.length === 0) {
			return { value: null, isMixed: false };
		}

		const hueTolerance = 5;
		const satTolerance = 0.05;
		const firstHue = hueSatLights[0].colorHue;
		const firstSat = hueSatLights[0].colorSaturation ?? 100;
		const firstSatNorm = firstSat > 1 ? firstSat / 100 : firstSat;

		const allSame = hueSatLights.every((l) => {
			const satRaw = l.colorSaturation ?? 100;
			const sat = satRaw > 1 ? satRaw / 100 : satRaw;
			return Math.abs(l.colorHue - firstHue) <= hueTolerance && Math.abs(sat - firstSatNorm) <= satTolerance;
		});

		if (allSame) {
			const avgHue = hueSatLights.reduce((a, l) => a + l.colorHue, 0) / hueSatLights.length;
			const avgSatRaw = hueSatLights.reduce((a, l) => a + (l.colorSaturation ?? 100), 0) / hueSatLights.length;
			const avgSat = avgSatRaw > 1 ? avgSatRaw / 100 : avgSatRaw;
			const hex = hsvToHex(avgHue, Math.max(0, Math.min(1, avgSat)), 1);
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
	 * Detect which mode the current state matches (if any).
	 * When multiple modes have equal match percentages, prefer lastAppliedMode as tie-breaker.
	 */
	private detectMode(
		roleStates: Partial<Record<LightingRole, RoleAggregatedState>>,
		otherState: OtherLightsState,
		lights: LightState[],
		lastAppliedMode: LightingMode | null = null,
	): ModeMatch | null {
		const hasAnyRoles = Object.keys(roleStates).length > 0;

		// If no roles configured, check for MVP fallback mode matching
		if (!hasAnyRoles) {
			return this.detectMvpMode(lights, lastAppliedMode);
		}

		// Get all available modes from YAML spec (includes user-defined custom modes)
		const allModes = this.intentSpecLoaderService.getAllLightingModeOrchestrations();
		let bestMatch: ModeMatch | null = null;

		for (const modeId of allModes.keys()) {
			// Only match built-in LightingMode values (custom mode IDs are not detected in MVP)
			if (!Object.values(LightingMode).includes(modeId as LightingMode)) {
				continue;
			}

			const match = this.matchMode(modeId as LightingMode, roleStates, otherState);

			if (match) {
				// Prefer this match if:
				// 1. No best match yet
				// 2. Higher match percentage
				// 3. Same percentage but this is the lastAppliedMode (tie-breaker)
				const isBetterMatch =
					!bestMatch ||
					match.matchPercentage > bestMatch.matchPercentage ||
					(match.matchPercentage === bestMatch.matchPercentage && match.mode === lastAppliedMode);

				if (isBetterMatch) {
					bestMatch = match;
				}
			}
		}

		return bestMatch;
	}

	/**
	 * Detect mode in MVP scenario (no roles configured).
	 * Uses mvpBrightness values from YAML mode specifications.
	 * When multiple modes match equally, prefer lastAppliedMode as tie-breaker.
	 */
	private detectMvpMode(lights: LightState[], lastAppliedMode: LightingMode | null = null): ModeMatch | null {
		const onLights = lights.filter((l) => l.isOn);

		// All lights off - detect "off" mode (defined in YAML with mvp_brightness: 0)
		if (onLights.length === 0) {
			return {
				mode: LightingMode.OFF,
				confidence: 'exact',
				matchPercentage: 100,
			};
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
			// Only match built-in LightingMode values (custom mode IDs are not detected in MVP)
			if (!Object.values(LightingMode).includes(modeId as LightingMode)) {
				continue;
			}

			// Skip OFF mode - lights that are ON should never match OFF regardless of brightness.
			// The OFF case is handled by the early return above when all lights are off.
			if ((modeId as LightingMode) === LightingMode.OFF) {
				continue;
			}

			if (config.mvpBrightness !== undefined && config.mvpBrightness !== null) {
				mvpModes.push({
					mode: modeId as LightingMode,
					brightness: config.mvpBrightness,
				});
			}
		}

		// Find all matching modes and their match quality
		const matches: ModeMatch[] = [];

		for (const { mode, brightness } of mvpModes) {
			const diff = Math.abs(avgBrightness - brightness);

			if (diff <= 15) {
				// Within 15% tolerance
				matches.push({
					mode,
					confidence: diff <= 5 ? 'exact' : 'approximate',
					matchPercentage: 100 - diff,
				});
			}
		}

		if (matches.length === 0) {
			return null;
		}

		// Sort by match percentage descending, then prefer lastAppliedMode as tie-breaker
		matches.sort((a, b) => {
			if (b.matchPercentage !== a.matchPercentage) {
				return b.matchPercentage - a.matchPercentage;
			}
			// Tie-breaker: prefer lastAppliedMode
			if (a.mode === lastAppliedMode) return -1;
			if (b.mode === lastAppliedMode) return 1;
			return 0;
		});

		return matches[0];
	}

	/**
	 * Match current state against a specific mode's rules.
	 * Includes support for OTHER role matching - combines explicit OTHER assignments
	 * with unassigned lights (otherState) for complete coverage.
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

			// For OTHER role, combine explicit OTHER assignments with unassigned lights
			let roleState: RoleAggregatedState | undefined = roleStates[role];

			if (role === LightingRole.OTHER) {
				roleState = this.getCombinedOtherState(roleStates[LightingRole.OTHER], otherState);
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
	 * Combine explicit OTHER role state with unassigned lights (otherState) for mode matching.
	 * Returns null if neither source has any devices.
	 */
	private getCombinedOtherState(
		explicitOther: RoleAggregatedState | undefined,
		otherState: OtherLightsState,
	): RoleAggregatedState | undefined {
		const hasExplicit = explicitOther && explicitOther.devicesCount > 0;
		const hasUnassigned = otherState.devicesCount > 0;

		if (!hasExplicit && !hasUnassigned) {
			return undefined;
		}

		// Only explicit OTHER exists
		if (hasExplicit && !hasUnassigned) {
			return explicitOther;
		}

		// Only unassigned lights exist - create synthetic state
		if (!hasExplicit && hasUnassigned) {
			return {
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

		// Both exist - merge them
		const totalDevices = explicitOther.devicesCount + otherState.devicesCount;
		const totalDevicesOn = explicitOther.devicesOn + otherState.devicesOn;

		// Determine combined on/off state
		const isOn = totalDevicesOn > 0;
		const isOnMixed =
			explicitOther.isOnMixed || otherState.isOnMixed || (explicitOther.isOn !== otherState.isOn && isOn);

		// Combine brightness - if either is mixed or values differ, mark as mixed
		let brightness: number | null = null;
		let isBrightnessMixed = explicitOther.isBrightnessMixed || otherState.isBrightnessMixed;

		if (!isBrightnessMixed && explicitOther.brightness !== null && otherState.brightness !== null) {
			const diff = Math.abs(explicitOther.brightness - otherState.brightness);

			if (diff <= 5) {
				// Similar enough - use weighted average
				brightness = Math.round(
					(explicitOther.brightness * explicitOther.devicesCount + otherState.brightness * otherState.devicesCount) /
						totalDevices,
				);
			} else {
				isBrightnessMixed = true;
			}
		} else if (!isBrightnessMixed) {
			// One is null - use the other if available
			brightness = explicitOther.brightness ?? otherState.brightness;
		}

		// Combine color temperature
		let colorTemperature: number | null = null;
		let isColorTemperatureMixed = explicitOther.isColorTemperatureMixed || otherState.isColorTemperatureMixed;

		if (!isColorTemperatureMixed && explicitOther.colorTemperature !== null && otherState.colorTemperature !== null) {
			const diff = Math.abs(explicitOther.colorTemperature - otherState.colorTemperature);

			if (diff <= 100) {
				colorTemperature = Math.round(
					(explicitOther.colorTemperature * explicitOther.devicesCount +
						otherState.colorTemperature * otherState.devicesCount) /
						totalDevices,
				);
			} else {
				isColorTemperatureMixed = true;
			}
		} else if (!isColorTemperatureMixed) {
			colorTemperature = explicitOther.colorTemperature ?? otherState.colorTemperature;
		}

		// Combine color - if both have color and they differ significantly, mark as mixed
		let color: string | null = null;
		let isColorMixed = explicitOther.isColorMixed || otherState.isColorMixed;

		if (!isColorMixed) {
			if (explicitOther.color !== null && otherState.color !== null) {
				isColorMixed = explicitOther.color !== otherState.color;
				color = isColorMixed ? null : explicitOther.color;
			} else {
				color = explicitOther.color ?? otherState.color;
			}
		}

		// Combine white
		let white: number | null = null;
		let isWhiteMixed = explicitOther.isWhiteMixed || otherState.isWhiteMixed;

		if (!isWhiteMixed && explicitOther.white !== null && otherState.white !== null) {
			const diff = Math.abs(explicitOther.white - otherState.white);

			if (diff <= 5) {
				white = Math.round(
					(explicitOther.white * explicitOther.devicesCount + otherState.white * otherState.devicesCount) /
						totalDevices,
				);
			} else {
				isWhiteMixed = true;
			}
		} else if (!isWhiteMixed) {
			white = explicitOther.white ?? otherState.white;
		}

		return {
			role: LightingRole.OTHER,
			isOn,
			isOnMixed,
			brightness,
			colorTemperature,
			color,
			white,
			isBrightnessMixed,
			isColorTemperatureMixed,
			isColorMixed,
			isWhiteMixed,
			lastIntent: explicitOther.lastIntent,
			devicesCount: totalDevices,
			devicesOn: totalDevicesOn,
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
	 * Returns non-match if rule requires brightness but actual brightness is unknown.
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

		// Rule says ON and all devices are on - check brightness
		if (rule.brightness !== null) {
			// Rule requires specific brightness
			if (roleState.brightness === null) {
				// Brightness unknown - treat as approximate match to avoid false negatives
				return { matches: true, exact: false };
			}

			if (roleState.isBrightnessMixed) {
				// Brightness is mixed - can't match exactly
				return { matches: true, exact: false };
			}

			// Compare brightness values
			const diff = Math.abs(rule.brightness - roleState.brightness);

			if (diff <= 5) {
				return { matches: true, exact: true };
			} else if (diff <= 15) {
				return { matches: true, exact: false };
			} else {
				return { matches: false, exact: false };
			}
		}

		// If brightness is mixed but rule doesn't require specific brightness, approximate match
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
			hasLights: false,
			detectedMode: null,
			modeConfidence: 'none',
			modeMatchPercentage: null,
			isModeFromIntent: false,
			lastAppliedMode: null,
			lastAppliedAt: null,
			totalLights: 0,
			lightsOn: 0,
			averageBrightness: null,
			roles: {},
			lightsByRole: {},
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

		const value = property.value?.value;

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

		const value = property.value?.value;

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

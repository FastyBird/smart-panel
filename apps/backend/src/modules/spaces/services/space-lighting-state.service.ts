import { Inject, Injectable, forwardRef } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { IntentTimeseriesService } from '../../intents/services/intent-timeseries.service';
import {
	LIGHTING_MODE_ORCHESTRATION,
	LightingMode,
	LightingRole,
	RoleBrightnessRule,
	SPACES_MODULE_NAME,
} from '../spaces.constants';

import { SpaceLightingRoleService } from './space-lighting-role.service';
import { SpacesService } from './spaces.service';

/**
 * Aggregated state for a single lighting role
 */
export interface RoleAggregatedState {
	role: LightingRole;
	isOn: boolean;
	brightness: number | null;
	isMixed: boolean;
	devicesCount: number;
	devicesOn: number;
	// Detailed values for mixed state detection
	brightnessValues: number[];
	onStates: boolean[];
}

/**
 * Aggregated state for "other" lights (no role assigned)
 */
export interface OtherLightsState {
	isOn: boolean;
	brightness: number | null;
	isMixed: boolean;
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

	// Last applied mode (from storage - null until InfluxDB persistence is added)
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

		// Aggregate by role
		const roleStates = this.aggregateByRole(lights);

		// Aggregate "other" lights (no role)
		const otherState = this.aggregateOther(lights);

		// Calculate summary
		const summary = this.calculateSummary(lights);

		// Detect current mode
		const modeMatch = this.detectMode(roleStates, otherState, lights);

		// Get last applied mode from InfluxDB
		const lastApplied = await this.intentTimeseriesService.getLastLightingMode(spaceId);
		const lastAppliedMode = lastApplied?.mode
			? Object.values(LightingMode).includes(lastApplied.mode as LightingMode)
				? (lastApplied.mode as LightingMode)
				: null
			: null;

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

		const roleKey = `${device.id}:${channel.id}`;
		const roleEntity = roleMap.get(roleKey);

		return {
			deviceId: device.id,
			channelId: channel.id,
			role: roleEntity?.role ?? null,
			isOn: this.getPropertyBooleanValue(onProperty),
			brightness: this.getPropertyNumericValue(brightnessProperty),
		};
	}

	/**
	 * Aggregate lights by role
	 */
	private aggregateByRole(lights: LightState[]): Partial<Record<LightingRole, RoleAggregatedState>> {
		const roleStates: Partial<Record<LightingRole, RoleAggregatedState>> = {};

		// Group lights by role (excluding null roles and HIDDEN)
		const roleGroups = new Map<LightingRole, LightState[]>();

		for (const light of lights) {
			if (light.role === null || light.role === LightingRole.HIDDEN) {
				continue;
			}

			if (!roleGroups.has(light.role)) {
				roleGroups.set(light.role, []);
			}

			roleGroups.get(light.role).push(light);
		}

		// Calculate aggregated state for each role
		for (const [role, roleLights] of roleGroups) {
			const onStates = roleLights.map((l) => l.isOn);
			const brightnessValues = roleLights.filter((l) => l.brightness !== null).map((l) => l.brightness);

			const devicesOn = onStates.filter((on) => on).length;
			const isOn = devicesOn > 0;

			// Calculate average brightness (only from ON lights with brightness)
			const onBrightnessValues = roleLights.filter((l) => l.isOn && l.brightness !== null).map((l) => l.brightness);

			const avgBrightness =
				onBrightnessValues.length > 0
					? Math.round(onBrightnessValues.reduce((a, b) => a + b, 0) / onBrightnessValues.length)
					: null;

			// Detect mixed state
			const isMixed = this.detectMixedState(onStates, brightnessValues);

			roleStates[role] = {
				role,
				isOn,
				brightness: avgBrightness,
				isMixed,
				devicesCount: roleLights.length,
				devicesOn,
				brightnessValues,
				onStates,
			};
		}

		return roleStates;
	}

	/**
	 * Aggregate lights without role ("other" lights)
	 */
	private aggregateOther(lights: LightState[]): OtherLightsState {
		const otherLights = lights.filter((l) => l.role === null);

		if (otherLights.length === 0) {
			return {
				isOn: false,
				brightness: null,
				isMixed: false,
				devicesCount: 0,
				devicesOn: 0,
			};
		}

		const onStates = otherLights.map((l) => l.isOn);
		const brightnessValues = otherLights.filter((l) => l.brightness !== null).map((l) => l.brightness);

		const devicesOn = onStates.filter((on) => on).length;
		const isOn = devicesOn > 0;

		// Calculate average brightness (only from ON lights with brightness)
		const onBrightnessValues = otherLights.filter((l) => l.isOn && l.brightness !== null).map((l) => l.brightness);

		const avgBrightness =
			onBrightnessValues.length > 0
				? Math.round(onBrightnessValues.reduce((a, b) => a + b, 0) / onBrightnessValues.length)
				: null;

		const isMixed = this.detectMixedState(onStates, brightnessValues);

		return {
			isOn,
			brightness: avgBrightness,
			isMixed,
			devicesCount: otherLights.length,
			devicesOn,
		};
	}

	/**
	 * Detect if lights are in a mixed state
	 */
	private detectMixedState(onStates: boolean[], brightnessValues: number[]): boolean {
		// Mixed if some lights are on and some are off
		const allOn = onStates.every((on) => on);
		const allOff = onStates.every((on) => !on);

		if (!allOn && !allOff) {
			return true;
		}

		// Mixed if brightness values differ significantly (>10% difference)
		if (brightnessValues.length > 1) {
			const min = Math.min(...brightnessValues);
			const max = Math.max(...brightnessValues);

			if (max - min > 10) {
				return true;
			}
		}

		return false;
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

		// Try to match against each mode's orchestration rules
		const modes = [LightingMode.WORK, LightingMode.RELAX, LightingMode.NIGHT];
		let bestMatch: ModeMatch | null = null;

		for (const mode of modes) {
			const match = this.matchMode(mode, roleStates);

			if (match && (!bestMatch || match.matchPercentage > bestMatch.matchPercentage)) {
				bestMatch = match;
			}
		}

		return bestMatch;
	}

	/**
	 * Detect mode in MVP scenario (no roles configured)
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

		// Match against MVP mode brightness levels
		const modes: Array<{ mode: LightingMode; brightness: number }> = [
			{ mode: LightingMode.WORK, brightness: 100 },
			{ mode: LightingMode.RELAX, brightness: 50 },
			{ mode: LightingMode.NIGHT, brightness: 20 },
		];

		for (const { mode, brightness } of modes) {
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
	 * Match current state against a specific mode's rules
	 */
	private matchMode(
		mode: LightingMode,
		roleStates: Partial<Record<LightingRole, RoleAggregatedState>>,
	): ModeMatch | null {
		const config = LIGHTING_MODE_ORCHESTRATION[mode];
		const rules = config.roles;

		let matchingRoles = 0;
		let totalRoles = 0;
		let exactMatches = 0;

		for (const [roleStr, rule] of Object.entries(rules)) {
			const role = roleStr as LightingRole;
			const roleState = roleStates[role];

			// Skip roles that don't exist in current space
			if (!roleState) {
				continue;
			}

			totalRoles++;

			const matches = this.matchRoleRule(roleState, rule);

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
	 * Check if a role's current state matches a rule
	 */
	private matchRoleRule(
		roleState: RoleAggregatedState,
		rule: RoleBrightnessRule,
	): { matches: boolean; exact: boolean } {
		// Check on/off state
		if (rule.on !== roleState.isOn) {
			return { matches: false, exact: false };
		}

		// If rule says OFF, we're done
		if (!rule.on) {
			return { matches: true, exact: true };
		}

		// Check brightness if specified
		if (rule.brightness !== null && roleState.brightness !== null) {
			const diff = Math.abs(rule.brightness - roleState.brightness);

			if (diff <= 5) {
				return { matches: true, exact: true };
			} else if (diff <= 15) {
				return { matches: true, exact: false };
			} else {
				return { matches: false, exact: false };
			}
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
				brightness: null,
				isMixed: false,
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

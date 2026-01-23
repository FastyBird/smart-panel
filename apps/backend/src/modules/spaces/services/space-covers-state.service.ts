import { Inject, Injectable, forwardRef } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { IntentTimeseriesService } from '../../intents/services/intent-timeseries.service';
import { CoversMode, CoversRole, SPACES_MODULE_NAME } from '../spaces.constants';
import { IntentSpecLoaderService } from '../spec';

import { SpaceCoversRoleService } from './space-covers-role.service';
import { SpaceIntentBaseService } from './space-intent-base.service';
import { SpacesService } from './spaces.service';

/**
 * Represents a window covering device with its channel, properties, and role.
 */
export interface CoverDevice {
	device: DeviceEntity;
	coverChannel: ChannelEntity;
	positionProperty: ChannelPropertyEntity | null;
	commandProperty: ChannelPropertyEntity | null;
	tiltProperty: ChannelPropertyEntity | null;
	role: CoversRole | null;
}

/**
 * Aggregated state for a single covers role.
 * Current values are shown only when uniform across all devices in the role.
 * When devices have different values, current value is null and isMixed is true.
 */
export interface RoleCoversState {
	role: CoversRole;
	// Position state
	position: number | null;
	isPositionMixed: boolean;
	// Tilt state (optional - only for covers with tilt)
	tilt: number | null;
	isTiltMixed: boolean;
	hasTilt: boolean;
	// Open/closed state
	isOpen: boolean;
	isClosed: boolean;
	// Device counts
	devicesCount: number;
	devicesOpen: number;
}

/**
 * Mode match result for covers
 */
export interface CoversModeMatch {
	mode: CoversMode;
	confidence: 'exact' | 'approximate';
	matchPercentage: number;
}

/**
 * State information for covers in a space.
 */
export interface CoversState {
	hasCovers: boolean;
	// Mode detection
	detectedMode: CoversMode | null;
	modeConfidence: 'exact' | 'approximate' | 'none';
	modeMatchPercentage: number | null;
	// Whether the current mode was set by intent (true) or achieved by manual adjustments (false)
	isModeFromIntent: boolean;
	// Overall summary
	averagePosition: number | null;
	isPositionMixed: boolean;
	averageTilt: number | null;
	isTiltMixed: boolean;
	hasTilt: boolean;
	anyOpen: boolean;
	allClosed: boolean;
	devicesCount: number;
	// Per-role state
	roles: Partial<Record<CoversRole, RoleCoversState>>;
	coversByRole: Record<string, number>;
	lastAppliedMode: CoversMode | null;
	lastAppliedAt: Date | null;
}

/**
 * Service for calculating aggregated covers state.
 * Provides state data for UI display without panel-side calculation.
 */
@Injectable()
export class SpaceCoversStateService extends SpaceIntentBaseService {
	private readonly logger = createExtensionLogger(SPACES_MODULE_NAME, 'SpaceCoversStateService');

	constructor(
		private readonly spacesService: SpacesService,
		private readonly coversRoleService: SpaceCoversRoleService,
		@Inject(forwardRef(() => IntentTimeseriesService))
		private readonly intentTimeseriesService: IntentTimeseriesService,
		private readonly intentSpecLoaderService: IntentSpecLoaderService,
	) {
		super();
	}

	/**
	 * Get the current covers state for a space.
	 * Returns null if space doesn't exist (controller should throw 404).
	 */
	async getCoversState(spaceId: string): Promise<CoversState | null> {
		const defaultState: CoversState = {
			hasCovers: false,
			detectedMode: null,
			modeConfidence: 'none',
			modeMatchPercentage: null,
			isModeFromIntent: false,
			averagePosition: null,
			isPositionMixed: false,
			averageTilt: null,
			isTiltMixed: false,
			hasTilt: false,
			anyOpen: false,
			allClosed: true,
			devicesCount: 0,
			roles: {},
			coversByRole: {},
			lastAppliedMode: null,
			lastAppliedAt: null,
		};

		// Verify space exists - return null for controller to throw 404
		const space = await this.spacesService.findOne(spaceId);

		if (!space) {
			this.logger.warn(`Space not found id=${spaceId}`);

			return null;
		}

		// Get all covers in the space
		const covers = await this.getCoversInSpace(spaceId);

		if (covers.length === 0) {
			this.logger.debug(`No covers found in space id=${spaceId}`);
			return defaultState;
		}

		// Group covers by role for per-role aggregation
		const roleGroups = new Map<CoversRole, CoverDevice[]>();
		const coversByRole: Record<string, number> = {};

		for (const cover of covers) {
			const role = cover.role ?? CoversRole.PRIMARY;
			if (!roleGroups.has(role)) {
				roleGroups.set(role, []);
			}
			roleGroups.get(role)?.push(cover);

			// Count by role
			const roleKey = cover.role ?? 'unassigned';
			coversByRole[roleKey] = (coversByRole[roleKey] ?? 0) + 1;
		}

		// Calculate per-role state
		const roles: Partial<Record<CoversRole, RoleCoversState>> = {};

		for (const [role, roleCovers] of roleGroups) {
			roles[role] = this.aggregateCoverGroup(role, roleCovers);
		}

		// Calculate overall summary
		const allPositions: number[] = [];
		const allTilts: number[] = [];
		let anyOpen = false;
		let allClosed = true;
		let anyHasTilt = false;

		for (const cover of covers) {
			const position = this.getPropertyNumericValue(cover.positionProperty);
			const tilt = this.getPropertyNumericValue(cover.tiltProperty);

			if (position !== null) {
				allPositions.push(position);
				if (position > 0) {
					anyOpen = true;
					allClosed = false;
				}
			}

			if (tilt !== null) {
				allTilts.push(tilt);
				anyHasTilt = true;
			} else if (cover.tiltProperty !== null) {
				anyHasTilt = true;
			}
		}

		// Calculate overall position mixed state
		const positionResult = this.getUniformValue(allPositions);
		const tiltResult = this.getUniformValue(allTilts);

		// Get last applied mode from InfluxDB
		const lastApplied = await this.intentTimeseriesService.getLastCoversMode(spaceId);
		const lastAppliedMode = lastApplied?.mode
			? Object.values(CoversMode).includes(lastApplied.mode as CoversMode)
				? (lastApplied.mode as CoversMode)
				: null
			: null;

		// Detect current mode (prefer lastAppliedMode as tie-breaker)
		const modeMatch = this.detectMode(roles, covers, lastAppliedMode);

		// Determine if mode was set by intent using mode validity tracking
		const detectedMode = modeMatch?.mode ?? null;

		// Get current mode validity from InfluxDB
		const modeValidity = await this.intentTimeseriesService.getModeValidity(spaceId, 'covers');
		let modeValid = modeValidity?.modeValid ?? false;

		// If detected mode diverges from last applied mode, invalidate the mode
		// This ensures that once user manually changes settings, intent mode is no longer valid
		if (detectedMode !== lastAppliedMode && modeValid) {
			await this.intentTimeseriesService.storeModeValidity(spaceId, 'covers', false);
			modeValid = false;
		}

		// Mode is "from intent" only if detected mode matches last applied AND mode is still valid
		// This prevents scenario 4: manually adjusting back to mode position still shows as intent
		const isModeFromIntent = detectedMode !== null && detectedMode === lastAppliedMode && modeValid;

		return {
			hasCovers: true,
			detectedMode,
			modeConfidence: modeMatch ? modeMatch.confidence : 'none',
			modeMatchPercentage: modeMatch?.matchPercentage ?? null,
			isModeFromIntent,
			averagePosition: positionResult.value !== null ? Math.round(positionResult.value) : null,
			isPositionMixed: positionResult.isMixed,
			averageTilt: tiltResult.value !== null ? Math.round(tiltResult.value) : null,
			isTiltMixed: tiltResult.isMixed,
			hasTilt: anyHasTilt,
			anyOpen,
			allClosed,
			devicesCount: covers.length,
			roles,
			coversByRole,
			lastAppliedMode,
			lastAppliedAt: lastApplied?.appliedAt ?? null,
		};
	}

	/**
	 * Aggregate a group of covers into a single role state.
	 * Returns uniform values when all devices match, null when mixed.
	 */
	private aggregateCoverGroup(role: CoversRole, covers: CoverDevice[]): RoleCoversState {
		const positions: number[] = [];
		const tilts: number[] = [];
		let devicesOpen = 0;
		let hasTilt = false;

		for (const cover of covers) {
			const position = this.getPropertyNumericValue(cover.positionProperty);
			const tilt = this.getPropertyNumericValue(cover.tiltProperty);

			if (position !== null) {
				positions.push(position);
				if (position > 0) {
					devicesOpen++;
				}
			}

			if (tilt !== null) {
				tilts.push(tilt);
				hasTilt = true;
			} else if (cover.tiltProperty !== null) {
				hasTilt = true;
			}
		}

		const positionResult = this.getUniformValue(positions);
		const tiltResult = this.getUniformValue(tilts);

		const isOpen = devicesOpen > 0;
		const isClosed = devicesOpen === 0 && positions.length > 0;

		return {
			role,
			position: positionResult.value !== null ? Math.round(positionResult.value) : null,
			isPositionMixed: positionResult.isMixed,
			tilt: tiltResult.value !== null ? Math.round(tiltResult.value) : null,
			isTiltMixed: tiltResult.isMixed,
			hasTilt,
			isOpen,
			isClosed,
			devicesCount: covers.length,
			devicesOpen,
		};
	}

	/**
	 * Get uniform value from array of values.
	 * Returns the value if all values are the same (within tolerance),
	 * null if values differ (mixed).
	 */
	private getUniformValue(values: number[]): { value: number | null; isMixed: boolean } {
		if (values.length === 0) {
			return { value: null, isMixed: false };
		}

		// Check if all values are within tolerance (±5)
		const first = values[0];
		const allSame = values.every((v) => Math.abs(v - first) <= 5);

		if (allSame) {
			// Return average for small variations
			const avg = values.reduce((a, b) => a + b, 0) / values.length;
			return { value: avg, isMixed: false };
		}

		// Values differ - return average but mark as mixed
		const avg = values.reduce((a, b) => a + b, 0) / values.length;
		return { value: avg, isMixed: true };
	}

	/**
	 * Detect which mode the current state matches (if any).
	 * When multiple modes have equal match percentages, prefer lastAppliedMode as tie-breaker.
	 */
	private detectMode(
		roleStates: Partial<Record<CoversRole, RoleCoversState>>,
		covers: CoverDevice[],
		lastAppliedMode: CoversMode | null = null,
	): CoversModeMatch | null {
		const hasAnyRoles = Object.keys(roleStates).length > 0;

		// If no roles configured, check for MVP fallback mode matching
		if (!hasAnyRoles) {
			return this.detectMvpMode(covers, lastAppliedMode);
		}

		// Get all available modes from YAML spec
		const allModes = this.intentSpecLoaderService.getAllCoversModeOrchestrations();
		let bestMatch: CoversModeMatch | null = null;

		for (const modeId of allModes.keys()) {
			// Only match built-in CoversMode values
			if (!Object.values(CoversMode).includes(modeId as CoversMode)) {
				continue;
			}

			const match = this.matchMode(modeId as CoversMode, roleStates);

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
	 * Uses mvpPosition values from YAML mode specifications.
	 * When multiple modes match equally, prefer lastAppliedMode as tie-breaker.
	 */
	private detectMvpMode(covers: CoverDevice[], lastAppliedMode: CoversMode | null = null): CoversModeMatch | null {
		if (covers.length === 0) {
			return null;
		}

		// Get all position values
		const positionValues = covers
			.map((c) => this.getPropertyNumericValue(c.positionProperty))
			.filter((v): v is number => v !== null);

		if (positionValues.length === 0) {
			return null;
		}

		const avgPosition = positionValues.reduce((a, b) => a + b, 0) / positionValues.length;

		// Build MVP position lookup from YAML spec
		const allModes = this.intentSpecLoaderService.getAllCoversModeOrchestrations();
		const mvpModes: Array<{ mode: CoversMode; position: number }> = [];

		for (const [modeId, config] of allModes) {
			// Only match built-in CoversMode values
			if (!Object.values(CoversMode).includes(modeId as CoversMode)) {
				continue;
			}

			mvpModes.push({
				mode: modeId as CoversMode,
				position: config.mvpPosition,
			});
		}

		// Find all matching modes and their match quality
		const matches: CoversModeMatch[] = [];

		for (const { mode, position } of mvpModes) {
			const diff = Math.abs(avgPosition - position);

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
	 */
	private matchMode(
		mode: CoversMode,
		roleStates: Partial<Record<CoversRole, RoleCoversState>>,
	): CoversModeMatch | null {
		const config = this.intentSpecLoaderService.getCoversModeOrchestration(mode);

		if (!config) {
			return null;
		}

		const rules = config.roles;

		let matchingRoles = 0;
		let totalRoles = 0;
		let exactMatches = 0;

		for (const [roleStr, rule] of Object.entries(rules)) {
			const role = roleStr as CoversRole;
			const roleState = roleStates[role];

			// Skip roles that don't exist in current space
			if (!roleState) {
				continue;
			}

			totalRoles++;

			const matches = this.matchRoleRule(roleState, rule.position);

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
	 * Check if a role's current state matches a rule's expected position.
	 * Accounts for mixed positions - partial position is not considered a match.
	 */
	private matchRoleRule(roleState: RoleCoversState, expectedPosition: number): { matches: boolean; exact: boolean } {
		// Handle mixed position state - this is never a full match
		if (roleState.isPositionMixed) {
			return { matches: false, exact: false };
		}

		// Position unknown - treat as approximate match to avoid false negatives
		if (roleState.position === null) {
			return { matches: true, exact: false };
		}

		// Compare position values
		const diff = Math.abs(expectedPosition - roleState.position);

		if (diff <= 5) {
			return { matches: true, exact: true };
		} else if (diff <= 15) {
			return { matches: true, exact: false };
		} else {
			return { matches: false, exact: false };
		}
	}

	/**
	 * Find all window covering devices in a space with their channels, properties, and roles.
	 * Excludes covers with HIDDEN role as they should not be controlled by intents.
	 */
	async getCoversInSpace(spaceId: string): Promise<CoverDevice[]> {
		const devices = await this.spacesService.findDevicesBySpace(spaceId);
		const covers: CoverDevice[] = [];

		// Get role map for this space
		const roleMap = await this.coversRoleService.getRoleMap(spaceId);

		for (const device of devices) {
			// Check if device is a window covering device
			if (device.category !== DeviceCategory.WINDOW_COVERING) {
				continue;
			}

			// Find ALL window covering channels
			const coverChannels = device.channels?.filter((ch) => ch.category === ChannelCategory.WINDOW_COVERING) ?? [];

			for (const coverChannel of coverChannels) {
				// Find position property (primary control)
				const positionProperty = coverChannel.properties?.find((p) => p.category === PropertyCategory.POSITION) ?? null;

				// Find command property (open/close/stop)
				const commandProperty = coverChannel.properties?.find((p) => p.category === PropertyCategory.COMMAND) ?? null;

				// Find tilt property (optional)
				const tiltProperty = coverChannel.properties?.find((p) => p.category === PropertyCategory.TILT) ?? null;

				// Must have position or command to be controllable
				if (!positionProperty && !commandProperty) {
					continue;
				}

				// Get role assignment for this cover (keyed by deviceId:channelId)
				const roleKey = `${device.id}:${coverChannel.id}`;
				const roleEntity = roleMap.get(roleKey);
				const role = roleEntity?.role ?? null;

				// Skip HIDDEN covers - they should not be controlled by intents
				if (role === CoversRole.HIDDEN) {
					this.logger.debug(`Skipping HIDDEN cover deviceId=${device.id} channelId=${coverChannel.id}`);
					continue;
				}

				covers.push({
					device,
					coverChannel,
					positionProperty,
					commandProperty,
					tiltProperty,
					role,
				});
			}
		}

		return covers;
	}
}

import { Injectable, Optional } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { DeviceContributionCoverage } from '../../../modules/devices/services/device-contribution.registry.service';
import { IntentTimeseriesService } from '../../../modules/intents/services/intent-timeseries.service';
import { SpacesService } from '../../../modules/spaces/services/spaces.service';
import { SPACES_MODULE_NAME } from '../../../modules/spaces/spaces.constants';
import { CoversMode, CoversRole } from '../spaces-home-control.constants';
import { IntentSpecLoaderService } from '../spec';

import { LightingContributionPlannerService } from './lighting-contribution-planner.service';
import { SpaceCoversRoleService } from './space-covers-role.service';
import { SpaceIntentBaseService } from './space-intent-base.service';

/**
 * Represents a window covering device with its channel, properties, and role.
 */
export interface CoverDevice {
	coverage?: DeviceContributionCoverage;
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
	groupExpiresAt?: string;
	groupOperations?: {
		operation: 'open' | 'close' | 'stop' | 'position' | 'tilt';
		commandable: boolean;
		reasons: string[];
	}[];
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
		private readonly intentTimeseriesService: IntentTimeseriesService,
		private readonly intentSpecLoaderService: IntentSpecLoaderService,
		@Optional() private readonly contributions?: LightingContributionPlannerService,
	) {
		super();
	}

	/**
	 * Get the current covers state for a space.
	 * Returns null if space doesn't exist (controller should throw 404).
	 *
	 * @param spaceId - The space ID to get covers state for
	 * @param options.synchronizeModeValidity - If true (default), invalidates mode validity
	 *        in InfluxDB when detected mode diverges from last applied mode. This ensures
	 *        accurate `isModeFromIntent` tracking. Set to false for read-only operations
	 *        where the side effect is not needed (e.g., internal state broadcasts).
	 */
	async getCoversState(
		spaceId: string,
		options: { synchronizeModeValidity?: boolean } = {},
	): Promise<CoversState | null> {
		const { synchronizeModeValidity = true } = options;
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

			// Count by role (use same fallback as roleGroups for consistency)
			coversByRole[role] = (coversByRole[role] ?? 0) + (cover.coverage?.reported.total ?? 1);
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
			const position = this.readCoverNumber(cover, PropertyCategory.POSITION);
			const tilt = this.readCoverNumber(cover, PropertyCategory.TILT);

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
		const positionResult = this.coverUniformValue(covers, allPositions);
		if (
			covers.some((cover) => this.isGroup(cover) && this.readCoverNumber(cover, PropertyCategory.POSITION) === null)
		) {
			positionResult.value = null;
			allClosed = false;
		}
		positionResult.isMixed ||= covers.some((cover) =>
			cover.coverage?.reported.mixedProperties.includes(PropertyCategory.POSITION),
		);
		const tiltResult = this.coverUniformValue(covers, allTilts);
		if (
			covers.some(
				(cover) =>
					this.isGroup(cover) && cover.tiltProperty && this.readCoverNumber(cover, PropertyCategory.TILT) === null,
			)
		)
			tiltResult.value = null;
		tiltResult.isMixed ||= covers.some((cover) =>
			cover.coverage?.reported.mixedProperties.includes(PropertyCategory.TILT),
		);

		// Get last applied mode from InfluxDB
		const lastApplied = await this.intentTimeseriesService.getLastCoversMode(spaceId);
		const lastAppliedMode = lastApplied?.mode
			? Object.values(CoversMode).includes(lastApplied.mode as CoversMode)
				? (lastApplied.mode as CoversMode)
				: null
			: null;

		// Detect current mode (prefer lastAppliedMode as tie-breaker)
		const modeMatch = covers.some(
			(cover) =>
				this.isGroup(cover) &&
				(this.readCoverNumber(cover, PropertyCategory.POSITION) === null ||
					cover.coverage?.reported.mixedProperties.includes(PropertyCategory.POSITION)),
		)
			? null
			: this.detectMode(roles, covers, lastAppliedMode);

		// Determine if mode was set by intent using mode validity tracking
		const detectedMode = modeMatch?.mode ?? null;

		// Get current mode validity from InfluxDB
		const modeValidity = await this.intentTimeseriesService.getModeValidity(spaceId, 'covers');
		let modeValid = modeValidity?.modeValid ?? false;

		// If detected mode diverges from last applied mode, invalidate the mode
		// This ensures that once user manually changes settings, intent mode is no longer valid
		// Only perform this write operation when synchronizeModeValidity is enabled
		if (synchronizeModeValidity && detectedMode !== lastAppliedMode && modeValid) {
			await this.intentTimeseriesService.storeModeValidity(spaceId, 'covers', false);
			modeValid = false;
		}

		// Mode is "from intent" only if detected mode matches last applied AND mode is still valid
		// This prevents scenario 4: manually adjusting back to mode position still shows as intent
		const isModeFromIntent = detectedMode !== null && detectedMode === lastAppliedMode && modeValid;

		return {
			hasCovers: true,
			...(covers.some((cover) => this.isGroup(cover)) ? { groupExpiresAt: this.groupExpiry(covers) } : {}),
			...(covers.some((cover) => this.isGroup(cover))
				? {
						groupOperations: (['open', 'close', 'stop', 'position', 'tilt'] as const).map((operation) => {
							const reasons = covers.flatMap((cover) => {
								if (this.isGroup(cover)) {
									const readiness = cover.coverage?.operations?.find((item) => item.operation === operation);
									return readiness?.commandable && cover.coverage?.isCurrent?.() !== false
										? []
										: readiness?.reasons.length
											? [...readiness.reasons]
											: [`${cover.coverChannel.id}: qualified_cover_adapter_unavailable`];
								}
								const property =
									operation === 'position'
										? cover.positionProperty
										: operation === 'tilt'
											? cover.tiltProperty
											: cover.commandProperty;
								return property ? [] : [`${cover.coverChannel.id}: control_unavailable:${operation}`];
							});
							return { operation, commandable: reasons.length === 0, reasons };
						}),
					}
				: {}),
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
			devicesCount: covers.reduce((count, cover) => count + (cover.coverage?.reported.total ?? 1), 0),
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
			const position = this.readCoverNumber(cover, PropertyCategory.POSITION);
			const tilt = this.readCoverNumber(cover, PropertyCategory.TILT);

			if (position !== null) {
				positions.push(position);
				if (position > 0) {
					devicesOpen += cover.coverage?.reported.total ?? 1;
				}
			}

			if (tilt !== null) {
				tilts.push(tilt);
				hasTilt = true;
			} else if (cover.tiltProperty !== null) {
				hasTilt = true;
			}
		}

		const positionResult = this.coverUniformValue(covers, positions);
		const unknownGroup = covers.some(
			(cover) => this.isGroup(cover) && this.readCoverNumber(cover, PropertyCategory.POSITION) === null,
		);
		if (unknownGroup) positionResult.value = null;
		positionResult.isMixed ||= covers.some((cover) =>
			cover.coverage?.reported.mixedProperties.includes(PropertyCategory.POSITION),
		);
		const tiltResult = this.coverUniformValue(covers, tilts);
		if (
			covers.some(
				(cover) =>
					this.isGroup(cover) && cover.tiltProperty && this.readCoverNumber(cover, PropertyCategory.TILT) === null,
			)
		)
			tiltResult.value = null;
		tiltResult.isMixed ||= covers.some((cover) =>
			cover.coverage?.reported.mixedProperties.includes(PropertyCategory.TILT),
		);

		const isOpen = devicesOpen > 0;
		const isClosed = !unknownGroup && devicesOpen === 0 && positions.length > 0;

		return {
			role,
			position: positionResult.value !== null ? Math.round(positionResult.value) : null,
			isPositionMixed: positionResult.isMixed,
			tilt: tiltResult.value !== null ? Math.round(tiltResult.value) : null,
			isTiltMixed: tiltResult.isMixed,
			hasTilt,
			isOpen,
			isClosed,
			devicesCount: covers.reduce((count, cover) => count + (cover.coverage?.reported.total ?? 1), 0),
			devicesOpen,
		};
	}

	/**
	 * Get uniform value from array of values.
	 * Returns the value if all values are the same (within tolerance),
	 * average marked as mixed if values differ.
	 *
	 * Uses range-based check (max - min <= tolerance) which is order-independent.
	 */
	private getUniformValue(values: number[]): { value: number | null; isMixed: boolean } {
		const TOLERANCE = 5;

		if (values.length === 0) {
			return { value: null, isMixed: false };
		}

		const min = Math.min(...values);
		const max = Math.max(...values);
		const avg = values.reduce((a, b) => a + b, 0) / values.length;

		// Values are uniform if the range (max - min) is within tolerance
		if (max - min <= TOLERANCE) {
			return { value: avg, isMixed: false };
		}

		// Values differ - return average but mark as mixed
		return { value: avg, isMixed: true };
	}

	/**
	 * Detect which mode the current state matches (if any).
	 * When multiple modes have equal match percentages, prefer lastAppliedMode as tie-breaker.
	 */
	private detectMode(
		roleStates: Partial<Record<CoversRole, RoleCoversState>>,
		_covers: CoverDevice[],
		lastAppliedMode: CoversMode | null = null,
	): CoversModeMatch | null {
		// Note: Unlike lighting, covers always have a role (defaults to PRIMARY at line 149),
		// so roleStates always has entries when covers exist. No MVP fallback needed.

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
	async getCoversInSpace(spaceId: string, selectContributions = true): Promise<CoverDevice[]> {
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

		if (!this.contributions || !selectContributions) return covers;
		const plan = await this.contributions.plan(
			covers.map((cover) => ({ ...cover, channel: cover.coverChannel })),
			'covers',
		);
		return plan.targets.map((cover) => ({ ...cover, coverage: plan.coverage.get(cover.coverChannel.id) }));
	}
	private isGroup(cover: CoverDevice): boolean {
		return cover.device.type === 'virtual' && Reflect.get(cover.device, 'mode') === 'actuator_group';
	}
	private coverUniformValue(covers: CoverDevice[], values: number[]): { value: number | null; isMixed: boolean } {
		if (!covers.some((cover) => this.isGroup(cover))) return this.getUniformValue(values);
		const isMixed = values.some((value) => value !== values[0]);
		return { value: values.length && !isMixed ? values[0] : null, isMixed };
	}

	private groupExpiry(covers: CoverDevice[]): string | undefined {
		const groups = covers.filter((cover) => this.isGroup(cover));
		const clocks = groups.map(
			(cover) =>
				cover.coverage?.reported.properties.find((field) => field.category === PropertyCategory.POSITION)?.expiresAt,
		);
		return clocks.length && clocks.every((clock) => clock !== undefined)
			? new Date(Math.min(...clocks)).toISOString()
			: undefined;
	}

	private readCoverNumber(cover: CoverDevice, category: PropertyCategory): number | null {
		if (!this.isGroup(cover))
			return this.getPropertyNumericValue(
				category === PropertyCategory.POSITION ? cover.positionProperty : cover.tiltProperty,
			);
		const field = cover.coverage?.reported.properties.find((field) => field.category === category);
		return cover.coverage?.isCurrent?.() !== false &&
			field &&
			typeof field.value === 'number' &&
			Number.isFinite(field.value) &&
			field.expiresAt !== undefined &&
			field.expiresAt > Date.now()
			? field.value
			: null;
	}
}

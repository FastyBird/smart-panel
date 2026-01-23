import { Inject, Injectable, forwardRef } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { IntentTimeseriesService } from '../../intents/services/intent-timeseries.service';
import { CoversMode, CoversRole, SPACES_MODULE_NAME } from '../spaces.constants';

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
 * State information for covers in a space.
 */
export interface CoversState {
	hasCovers: boolean;
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

		return {
			hasCovers: true,
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

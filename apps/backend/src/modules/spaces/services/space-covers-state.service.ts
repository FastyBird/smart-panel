import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { CoversRole, SPACES_MODULE_NAME } from '../spaces.constants';

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
 * State information for covers in a space.
 */
export interface CoversState {
	hasCovers: boolean;
	averagePosition: number | null;
	anyOpen: boolean;
	allClosed: boolean;
	devicesCount: number;
	coversByRole: Record<string, number>;
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
			anyOpen: false,
			allClosed: true,
			devicesCount: 0,
			coversByRole: {},
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

		// Aggregate position values
		const positions: number[] = [];
		let anyOpen = false;
		let allClosed = true;
		const coversByRole: Record<string, number> = {};

		for (const cover of covers) {
			const position = this.getPropertyNumericValue(cover.positionProperty);

			if (position !== null) {
				positions.push(position);

				if (position > 0) {
					anyOpen = true;
				}
				if (position > 0) {
					allClosed = false;
				}
			}

			// Count by role
			const roleKey = cover.role ?? 'unassigned';
			coversByRole[roleKey] = (coversByRole[roleKey] ?? 0) + 1;
		}

		const averagePosition = positions.length > 0 ? positions.reduce((a, b) => a + b, 0) / positions.length : null;

		return {
			hasCovers: true,
			averagePosition: averagePosition !== null ? Math.round(averagePosition) : null,
			anyOpen,
			allClosed,
			devicesCount: covers.length,
			coversByRole,
		};
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

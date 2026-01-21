import { Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger';
import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../devices/devices.constants';
import { DeviceEntity } from '../../devices/entities/devices.entity';
import { SetMediaRoleDto } from '../dto/media-role.dto';
import { SpaceMediaRoleEntity } from '../entities/space-media-role.entity';
import { EventType, MEDIA_DEVICE_CATEGORIES, MediaRole, SPACES_MODULE_NAME } from '../spaces.constants';
import { SpacesValidationException } from '../spaces.exceptions';

import { SpacesService } from './spaces.service';

export interface MediaTargetInfo {
	deviceId: string;
	deviceName: string;
	deviceCategory: DeviceCategory;
	role: MediaRole | null;
	priority: number;
	hasOn: boolean;
	hasVolume: boolean;
	hasMute: boolean;
}

/**
 * Result of a single role operation in bulk update
 */
export interface BulkMediaRoleResultItem {
	deviceId: string;
	success: boolean;
	role: MediaRole | null;
	error: string | null;
}

/**
 * Result of bulk role update operation
 */
export interface BulkMediaRoleResult {
	success: boolean;
	totalCount: number;
	successCount: number;
	failureCount: number;
	results: BulkMediaRoleResultItem[];
}

/**
 * Event payload for media target websocket events
 * Uses snake_case to match API conventions
 */
export interface MediaTargetEventPayload {
	id: string;
	space_id: string;
	device_id: string;
	device_name: string;
	device_category: DeviceCategory;
	role: MediaRole | null;
	priority: number;
	has_on: boolean;
	has_volume: boolean;
	has_mute: boolean;
}

@Injectable()
export class SpaceMediaRoleService {
	private readonly logger = createExtensionLogger(SPACES_MODULE_NAME, 'SpaceMediaRoleService');

	constructor(
		@InjectRepository(SpaceMediaRoleEntity)
		private readonly repository: Repository<SpaceMediaRoleEntity>,
		@InjectRepository(DeviceEntity)
		private readonly deviceRepository: Repository<DeviceEntity>,
		private readonly spacesService: SpacesService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	/**
	 * Get all media role assignments for a space
	 */
	async findBySpace(spaceId: string): Promise<SpaceMediaRoleEntity[]> {
		this.logger.debug(`Fetching media roles for space id=${spaceId}`);

		// Verify space exists
		await this.spacesService.getOneOrThrow(spaceId);

		const roles = await this.repository.find({
			where: { spaceId },
			order: { role: 'ASC', priority: 'ASC' },
		});

		this.logger.debug(`Found ${roles.length} media roles for space id=${spaceId}`);

		return roles;
	}

	/**
	 * Get a single media role assignment
	 */
	async findOne(spaceId: string, deviceId: string): Promise<SpaceMediaRoleEntity | null> {
		return this.repository.findOne({
			where: { spaceId, deviceId },
		});
	}

	/**
	 * Set or update a media role assignment.
	 * Media roles operate at device level only (no channel required).
	 */
	async setRole(spaceId: string, dto: SetMediaRoleDto): Promise<SpaceMediaRoleEntity> {
		// Verify space exists
		await this.spacesService.getOneOrThrow(spaceId);

		// Verify device exists
		const device = await this.deviceRepository.findOne({
			where: { id: dto.deviceId },
		});

		if (!device) {
			throw new SpacesValidationException(`Device with id=${dto.deviceId} not found`);
		}

		// Verify device belongs to this space (works for both rooms and zones)
		const deviceInSpace = await this.spacesService.isDeviceInSpace(spaceId, dto.deviceId);
		if (!deviceInSpace) {
			throw new SpacesValidationException(`Device with id=${dto.deviceId} does not belong to space ${spaceId}`);
		}

		// Verify device is a media device
		if (!MEDIA_DEVICE_CATEGORIES.includes(device.category as (typeof MEDIA_DEVICE_CATEGORIES)[number])) {
			throw new SpacesValidationException(`Device with id=${dto.deviceId} is not a media device`);
		}

		let roleEntity: SpaceMediaRoleEntity | null = null;
		let isUpdate = false;
		let hasChanges = false;

		const newRole = dto.role;
		const newPriority = dto.priority ?? 0;

		// Use a transaction to atomically check existence and upsert
		await this.repository.manager.transaction(async (transactionalManager) => {
			// Check if this is an update or create within the transaction
			const existingRole = await transactionalManager.findOne(SpaceMediaRoleEntity, {
				where: { spaceId, deviceId: dto.deviceId },
			});
			isUpdate = existingRole !== null;

			// Detect actual changes to avoid spurious events
			if (existingRole) {
				hasChanges = existingRole.role !== newRole || existingRole.priority !== newPriority;
			} else {
				hasChanges = true; // New record is always a change
			}

			// Upsert within the same transaction to maintain atomicity
			await transactionalManager.upsert(
				SpaceMediaRoleEntity,
				{
					spaceId,
					deviceId: dto.deviceId,
					channelId: null, // Media roles are device-level only
					role: newRole,
					priority: newPriority,
				},
				{
					conflictPaths: ['spaceId', 'deviceId'],
					skipUpdateIfNoValuesChanged: true,
				},
			);

			// Fetch the saved entity within the transaction
			roleEntity = await transactionalManager.findOne(SpaceMediaRoleEntity, {
				where: { spaceId, deviceId: dto.deviceId },
			});
		});

		if (!roleEntity) {
			throw new SpacesValidationException(`Failed to save media role for device=${dto.deviceId}`);
		}

		// Only emit event if values actually changed
		if (hasChanges) {
			// Emit event for websocket clients with full media target info
			const eventPayload = await this.buildMediaTargetEventPayload(spaceId, dto.deviceId, dto.role, dto.priority ?? 0);

			if (eventPayload) {
				const eventType = isUpdate ? EventType.MEDIA_TARGET_UPDATED : EventType.MEDIA_TARGET_CREATED;
				this.eventEmitter.emit(eventType, eventPayload);
			}
		}

		return roleEntity;
	}

	/**
	 * Bulk set/update media role assignments
	 * Returns detailed results for each role operation
	 */
	async bulkSetRoles(spaceId: string, roles: SetMediaRoleDto[]): Promise<BulkMediaRoleResult> {
		// Verify space exists
		await this.spacesService.getOneOrThrow(spaceId);

		const results: BulkMediaRoleResultItem[] = [];

		for (const dto of roles) {
			try {
				await this.setRole(spaceId, dto);
				results.push({
					deviceId: dto.deviceId,
					success: true,
					role: dto.role,
					error: null,
				});
			} catch (error) {
				const err = error as Error;
				this.logger.warn(`Failed to set role for device=${dto.deviceId}: ${err.message}`);
				results.push({
					deviceId: dto.deviceId,
					success: false,
					role: null,
					error: err.message,
				});
			}
		}

		const successCount = results.filter((r) => r.success).length;

		return {
			success: successCount === results.length,
			totalCount: results.length,
			successCount,
			failureCount: results.length - successCount,
			results,
		};
	}

	/**
	 * Delete a media role assignment
	 */
	async deleteRole(spaceId: string, deviceId: string): Promise<void> {
		// Verify space exists
		await this.spacesService.getOneOrThrow(spaceId);

		const role = await this.findOne(spaceId, deviceId);

		if (role) {
			await this.repository.remove(role);

			// Emit event for websocket clients with the media target ID
			this.eventEmitter.emit(EventType.MEDIA_TARGET_DELETED, {
				id: deviceId,
				space_id: spaceId,
				device_id: deviceId,
			});
		}
	}

	/**
	 * Get all media targets in a space with their role assignments.
	 * Media targets are device-level only - all media device categories are listed
	 * regardless of their channel structure.
	 */
	async getMediaTargetsInSpace(spaceId: string): Promise<MediaTargetInfo[]> {
		this.logger.debug(`Getting media targets for space id=${spaceId}`);

		// Verify space exists
		await this.spacesService.getOneOrThrow(spaceId);

		// Get all devices in the space
		const devices = await this.spacesService.findDevicesBySpace(spaceId);

		// Get all existing role assignments for this space grouped by device
		const existingRoles = await this.findBySpace(spaceId);
		const rolesByDevice = new Map<string, SpaceMediaRoleEntity>();

		for (const role of existingRoles) {
			rolesByDevice.set(role.deviceId, role);
		}

		const mediaTargets: MediaTargetInfo[] = [];

		for (const device of devices) {
			// Only process media devices by device category
			if (!MEDIA_DEVICE_CATEGORIES.includes(device.category as (typeof MEDIA_DEVICE_CATEGORIES)[number])) {
				continue;
			}

			// Detect capabilities by scanning all channels and their properties
			let hasOn = false;
			let hasVolume = false;
			let hasMute = false;

			for (const channel of device.channels ?? []) {
				const properties = channel.properties ?? [];

				// Power control: check TELEVISION, SWITCHER channels for ON/ACTIVE properties
				if (channel.category === ChannelCategory.TELEVISION || channel.category === ChannelCategory.SWITCHER) {
					if (properties.some((p) => p.category === PropertyCategory.ON || p.category === PropertyCategory.ACTIVE)) {
						hasOn = true;
					}
				}

				// Volume control: check SPEAKER or TELEVISION channels for VOLUME property
				if (channel.category === ChannelCategory.SPEAKER || channel.category === ChannelCategory.TELEVISION) {
					if (properties.some((p) => p.category === PropertyCategory.VOLUME)) {
						hasVolume = true;
					}
					if (properties.some((p) => p.category === PropertyCategory.MUTE)) {
						hasMute = true;
					}
				}
			}

			// Get existing role assignment if any (device-level)
			const existingRole = rolesByDevice.get(device.id) ?? null;

			mediaTargets.push({
				deviceId: device.id,
				deviceName: device.name,
				deviceCategory: device.category,
				role: existingRole?.role ?? null,
				priority: existingRole?.priority ?? 0,
				hasOn,
				hasVolume,
				hasMute,
			});
		}

		this.logger.debug(`Found ${mediaTargets.length} media targets in space id=${spaceId}`);

		return mediaTargets;
	}

	/**
	 * Infer default media roles for a space based on device categories.
	 *
	 * Role assignment by device category:
	 * - Television, Projector → PRIMARY (first one) or SECONDARY (others)
	 * - AV Receiver, Set Top Box → SECONDARY
	 * - Speaker → BACKGROUND
	 * - Game Console → GAMING
	 * - Media, Streaming Service → SECONDARY
	 */
	async inferDefaultMediaRoles(spaceId: string): Promise<SetMediaRoleDto[]> {
		this.logger.debug(`Inferring default media roles for space id=${spaceId}`);

		const mediaTargets = await this.getMediaTargetsInSpace(spaceId);

		if (mediaTargets.length === 0) {
			return [];
		}

		const defaultRoles: SetMediaRoleDto[] = [];
		let hasPrimary = false;

		for (let i = 0; i < mediaTargets.length; i++) {
			const target = mediaTargets[i];
			let inferredRole: MediaRole;

			switch (target.deviceCategory) {
				case DeviceCategory.TELEVISION:
				case DeviceCategory.PROJECTOR:
					// First TV/Projector becomes PRIMARY, others become SECONDARY
					if (!hasPrimary) {
						inferredRole = MediaRole.PRIMARY;
						hasPrimary = true;
					} else {
						inferredRole = MediaRole.SECONDARY;
					}
					break;

				case DeviceCategory.AV_RECEIVER:
				case DeviceCategory.SET_TOP_BOX:
				case DeviceCategory.MEDIA:
				case DeviceCategory.STREAMING_SERVICE:
					// AV equipment and media devices are SECONDARY
					inferredRole = MediaRole.SECONDARY;
					break;

				case DeviceCategory.SPEAKER:
					// Speakers are for background audio
					inferredRole = MediaRole.BACKGROUND;
					break;

				case DeviceCategory.GAME_CONSOLE:
					// Game consoles get their dedicated role
					inferredRole = MediaRole.GAMING;
					break;

				default:
					// Fallback for any other media device
					inferredRole = MediaRole.SECONDARY;
					break;
			}

			defaultRoles.push({
				deviceId: target.deviceId,
				role: inferredRole,
				priority: i,
			});
		}

		this.logger.debug(`Inferred ${defaultRoles.length} default media roles for space id=${spaceId}`);

		return defaultRoles;
	}

	/**
	 * Get role assignments for all media in a space, indexed by device/channel
	 */
	async getRoleMap(spaceId: string): Promise<Map<string, SpaceMediaRoleEntity>> {
		const roles = await this.findBySpace(spaceId);
		const map = new Map<string, SpaceMediaRoleEntity>();

		for (const role of roles) {
			map.set(role.deviceId, role);
		}

		return map;
	}

	/**
	 * Build event payload for a media target with all required fields.
	 * Media targets are device-level - capabilities are aggregated from all channels.
	 */
	private async buildMediaTargetEventPayload(
		spaceId: string,
		deviceId: string,
		role: MediaRole | null,
		priority: number,
	): Promise<MediaTargetEventPayload | null> {
		// Fetch device with channels and properties
		const device = await this.deviceRepository.findOne({
			where: { id: deviceId },
			relations: ['channels', 'channels.properties'],
		});

		if (!device) {
			this.logger.warn(`Device ${deviceId} not found when building event payload`);
			return null;
		}

		// Detect capabilities by scanning all channels and their properties
		let hasOn = false;
		let hasVolume = false;
		let hasMute = false;

		for (const channel of device.channels ?? []) {
			const properties = channel.properties ?? [];

			// Power control: check TELEVISION, SWITCHER channels for ON/ACTIVE properties
			if (channel.category === ChannelCategory.TELEVISION || channel.category === ChannelCategory.SWITCHER) {
				if (properties.some((p) => p.category === PropertyCategory.ON || p.category === PropertyCategory.ACTIVE)) {
					hasOn = true;
				}
			}

			// Volume control: check SPEAKER or TELEVISION channels for VOLUME property
			if (channel.category === ChannelCategory.SPEAKER || channel.category === ChannelCategory.TELEVISION) {
				if (properties.some((p) => p.category === PropertyCategory.VOLUME)) {
					hasVolume = true;
				}
				if (properties.some((p) => p.category === PropertyCategory.MUTE)) {
					hasMute = true;
				}
			}
		}

		return {
			id: deviceId,
			space_id: spaceId,
			device_id: deviceId,
			device_name: device.name,
			device_category: device.category,
			role,
			priority,
			has_on: hasOn,
			has_volume: hasVolume,
			has_mute: hasMute,
		};
	}
}

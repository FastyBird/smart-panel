import { Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger';
import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../devices/devices.constants';
import { DeviceEntity } from '../../devices/entities/devices.entity';
import { SetCoversRoleDto } from '../dto/covers-role.dto';
import { SpaceCoversRoleEntity } from '../entities/space-covers-role.entity';
import { CoversRole, EventType, SPACES_MODULE_NAME } from '../spaces.constants';
import { SpacesValidationException } from '../spaces.exceptions';

import { SpacesService } from './spaces.service';

export interface CoversTargetInfo {
	deviceId: string;
	deviceName: string;
	channelId: string;
	channelName: string;
	role: CoversRole | null;
	priority: number;
	hasPosition: boolean;
	hasCommand: boolean;
	hasTilt: boolean;
	coverType: string | null;
}

/**
 * Result of a single role operation in bulk update
 */
export interface BulkCoversRoleResultItem {
	deviceId: string;
	channelId: string;
	success: boolean;
	role: CoversRole | null;
	error: string | null;
}

/**
 * Result of bulk role update operation
 */
export interface BulkCoversRoleResult {
	success: boolean;
	totalCount: number;
	successCount: number;
	failureCount: number;
	results: BulkCoversRoleResultItem[];
}

/**
 * Event payload for covers target websocket events
 * Uses snake_case to match API conventions
 */
export interface CoversTargetEventPayload {
	id: string;
	space_id: string;
	device_id: string;
	device_name: string;
	channel_id: string;
	channel_name: string;
	role: CoversRole | null;
	priority: number;
	has_position: boolean;
	has_command: boolean;
	has_tilt: boolean;
	cover_type: string | null;
}

@Injectable()
export class SpaceCoversRoleService {
	private readonly logger = createExtensionLogger(SPACES_MODULE_NAME, 'SpaceCoversRoleService');

	constructor(
		@InjectRepository(SpaceCoversRoleEntity)
		private readonly repository: Repository<SpaceCoversRoleEntity>,
		@InjectRepository(DeviceEntity)
		private readonly deviceRepository: Repository<DeviceEntity>,
		private readonly spacesService: SpacesService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	/**
	 * Get all covers role assignments for a space
	 */
	async findBySpace(spaceId: string): Promise<SpaceCoversRoleEntity[]> {
		this.logger.debug(`Fetching covers roles for space id=${spaceId}`);

		// Verify space exists
		await this.spacesService.getOneOrThrow(spaceId);

		const roles = await this.repository.find({
			where: { spaceId },
			order: { role: 'ASC', priority: 'ASC' },
		});

		this.logger.debug(`Found ${roles.length} covers roles for space id=${spaceId}`);

		return roles;
	}

	/**
	 * Get a single covers role assignment
	 */
	async findOne(spaceId: string, deviceId: string, channelId: string): Promise<SpaceCoversRoleEntity | null> {
		return this.repository.findOne({
			where: { spaceId, deviceId, channelId },
		});
	}

	/**
	 * Set or update a covers role assignment
	 */
	async setRole(spaceId: string, dto: SetCoversRoleDto): Promise<SpaceCoversRoleEntity> {
		// Verify space exists
		await this.spacesService.getOneOrThrow(spaceId);

		// Verify device exists and belongs to this space
		const device = await this.deviceRepository.findOne({
			where: { id: dto.deviceId },
			relations: ['channels'],
		});

		if (!device) {
			throw new SpacesValidationException(`Device with id=${dto.deviceId} not found`);
		}

		// Verify device belongs to this space (works for both rooms and zones)
		const deviceInSpace = await this.spacesService.isDeviceInSpace(spaceId, dto.deviceId);
		if (!deviceInSpace) {
			throw new SpacesValidationException(`Device with id=${dto.deviceId} does not belong to space ${spaceId}`);
		}

		// Verify channel exists and belongs to the device
		const channel = device.channels?.find((ch) => ch.id === dto.channelId);

		if (!channel) {
			throw new SpacesValidationException(`Channel with id=${dto.channelId} not found on device ${dto.deviceId}`);
		}

		let roleEntity: SpaceCoversRoleEntity | null = null;
		let isUpdate = false;
		let hasChanges = false;

		const newRole = dto.role;
		const newPriority = dto.priority ?? 0;

		// Use a transaction to atomically check existence and upsert
		await this.repository.manager.transaction(async (transactionalManager) => {
			// Check if this is an update or create within the transaction
			const existingRole = await transactionalManager.findOne(SpaceCoversRoleEntity, {
				where: { spaceId, deviceId: dto.deviceId, channelId: dto.channelId },
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
				SpaceCoversRoleEntity,
				{
					spaceId,
					deviceId: dto.deviceId,
					channelId: dto.channelId,
					role: newRole,
					priority: newPriority,
				},
				{
					conflictPaths: ['spaceId', 'deviceId', 'channelId'],
					skipUpdateIfNoValuesChanged: true,
				},
			);

			// Fetch the saved entity within the transaction
			roleEntity = await transactionalManager.findOne(SpaceCoversRoleEntity, {
				where: { spaceId, deviceId: dto.deviceId, channelId: dto.channelId },
			});
		});

		if (!roleEntity) {
			throw new SpacesValidationException(
				`Failed to save covers role for device=${dto.deviceId} channel=${dto.channelId}`,
			);
		}

		// Only emit event if values actually changed
		if (hasChanges) {
			// Emit event for websocket clients with full covers target info
			const eventPayload = await this.buildCoversTargetEventPayload(
				spaceId,
				dto.deviceId,
				dto.channelId,
				dto.role,
				dto.priority ?? 0,
			);

			if (eventPayload) {
				const eventType = isUpdate ? EventType.COVERS_TARGET_UPDATED : EventType.COVERS_TARGET_CREATED;
				this.eventEmitter.emit(eventType, eventPayload);
			}
		}

		return roleEntity;
	}

	/**
	 * Bulk set/update covers role assignments
	 * Returns detailed results for each role operation
	 */
	async bulkSetRoles(spaceId: string, roles: SetCoversRoleDto[]): Promise<BulkCoversRoleResult> {
		// Verify space exists
		await this.spacesService.getOneOrThrow(spaceId);

		const results: BulkCoversRoleResultItem[] = [];

		for (const dto of roles) {
			try {
				await this.setRole(spaceId, dto);
				results.push({
					deviceId: dto.deviceId,
					channelId: dto.channelId,
					success: true,
					role: dto.role,
					error: null,
				});
			} catch (error) {
				const err = error as Error;
				this.logger.warn(`Failed to set role for device=${dto.deviceId} channel=${dto.channelId}: ${err.message}`);
				results.push({
					deviceId: dto.deviceId,
					channelId: dto.channelId,
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
	 * Delete a covers role assignment
	 */
	async deleteRole(spaceId: string, deviceId: string, channelId: string): Promise<void> {
		// Verify space exists
		await this.spacesService.getOneOrThrow(spaceId);

		const role = await this.findOne(spaceId, deviceId, channelId);

		if (role) {
			await this.repository.remove(role);

			// Emit event for websocket clients with the covers target ID
			this.eventEmitter.emit(EventType.COVERS_TARGET_DELETED, {
				id: `${deviceId}:${channelId}`,
				space_id: spaceId,
				device_id: deviceId,
				channel_id: channelId,
			});
		}
	}

	/**
	 * Get all covers targets in a space with their role assignments
	 * This combines device/channel info with role data
	 */
	async getCoversTargetsInSpace(spaceId: string): Promise<CoversTargetInfo[]> {
		this.logger.debug(`Getting covers targets for space id=${spaceId}`);

		// Verify space exists
		await this.spacesService.getOneOrThrow(spaceId);

		// Get all devices in the space
		const devices = await this.spacesService.findDevicesBySpace(spaceId);

		// Get all existing role assignments for this space
		const existingRoles = await this.findBySpace(spaceId);
		const roleMap = new Map<string, SpaceCoversRoleEntity>();

		for (const role of existingRoles) {
			roleMap.set(`${role.deviceId}:${role.channelId}`, role);
		}

		const coversTargets: CoversTargetInfo[] = [];

		for (const device of devices) {
			// Only process window covering devices
			if (device.category !== DeviceCategory.WINDOW_COVERING) {
				continue;
			}

			// Find window covering channels
			for (const channel of device.channels ?? []) {
				if (channel.category !== ChannelCategory.WINDOW_COVERING) {
					continue;
				}

				// Check for properties
				const properties = channel.properties ?? [];
				const hasPosition = properties.some((p) => p.category === PropertyCategory.POSITION);
				const hasCommand = properties.some((p) => p.category === PropertyCategory.COMMAND);
				const hasTilt = properties.some((p) => p.category === PropertyCategory.TILT);

				// Get cover type if available (with runtime type validation)
				const typeProperty = properties.find((p) => p.category === PropertyCategory.TYPE);
				const typeValue = typeProperty?.value;
				const coverType = typeof typeValue === 'string' ? typeValue : null;

				// Must have at least position or command to be controllable
				if (!hasPosition && !hasCommand) {
					continue;
				}

				// Get existing role assignment if any
				const roleKey = `${device.id}:${channel.id}`;
				const existingRole = roleMap.get(roleKey);

				coversTargets.push({
					deviceId: device.id,
					deviceName: device.name,
					channelId: channel.id,
					channelName: channel.name,
					role: existingRole?.role ?? null,
					priority: existingRole?.priority ?? 0,
					hasPosition,
					hasCommand,
					hasTilt,
					coverType,
				});
			}
		}

		this.logger.debug(`Found ${coversTargets.length} covers targets in space id=${spaceId}`);

		return coversTargets;
	}

	/**
	 * Infer default covers roles for a space (quick defaults helper)
	 * - First cover becomes PRIMARY
	 * - Remaining covers are assigned based on type if available
	 */
	async inferDefaultCoversRoles(spaceId: string): Promise<SetCoversRoleDto[]> {
		this.logger.debug(`Inferring default covers roles for space id=${spaceId}`);

		const coversTargets = await this.getCoversTargetsInSpace(spaceId);

		if (coversTargets.length === 0) {
			return [];
		}

		const defaultRoles: SetCoversRoleDto[] = [];

		// First cover is PRIMARY
		defaultRoles.push({
			deviceId: coversTargets[0].deviceId,
			channelId: coversTargets[0].channelId,
			role: CoversRole.PRIMARY,
			priority: 0,
		});

		// Remaining covers - try to infer role from type
		for (let i = 1; i < coversTargets.length; i++) {
			const target = coversTargets[i];
			let inferredRole = CoversRole.PRIMARY; // Default to PRIMARY

			// Try to infer role from cover type (with runtime type safety)
			if (typeof target.coverType === 'string') {
				const typeStr = target.coverType.toLowerCase();
				if (typeStr.includes('blackout') || typeStr.includes('roller')) {
					inferredRole = CoversRole.BLACKOUT;
				} else if (typeStr.includes('sheer') || typeStr.includes('curtain')) {
					inferredRole = CoversRole.SHEER;
				} else if (typeStr.includes('outdoor') || typeStr.includes('awning') || typeStr.includes('shutter')) {
					inferredRole = CoversRole.OUTDOOR;
				}
			}

			defaultRoles.push({
				deviceId: target.deviceId,
				channelId: target.channelId,
				role: inferredRole,
				priority: i,
			});
		}

		this.logger.debug(`Inferred ${defaultRoles.length} default covers roles for space id=${spaceId}`);

		return defaultRoles;
	}

	/**
	 * Get role assignments for all covers in a space, indexed by device/channel
	 */
	async getRoleMap(spaceId: string): Promise<Map<string, SpaceCoversRoleEntity>> {
		const roles = await this.findBySpace(spaceId);
		const map = new Map<string, SpaceCoversRoleEntity>();

		for (const role of roles) {
			map.set(`${role.deviceId}:${role.channelId}`, role);
		}

		return map;
	}

	/**
	 * Build event payload for a covers target with all required fields
	 */
	private async buildCoversTargetEventPayload(
		spaceId: string,
		deviceId: string,
		channelId: string,
		role: CoversRole | null,
		priority: number,
	): Promise<CoversTargetEventPayload | null> {
		// Fetch device with channels and properties
		const device = await this.deviceRepository.findOne({
			where: { id: deviceId },
			relations: ['channels', 'channels.properties'],
		});

		if (!device) {
			this.logger.warn(`Device ${deviceId} not found when building event payload`);
			return null;
		}

		const channel = device.channels?.find((ch) => ch.id === channelId);

		if (!channel) {
			this.logger.warn(`Channel ${channelId} not found when building event payload`);
			return null;
		}

		const properties = channel.properties ?? [];
		const hasPosition = properties.some((p) => p.category === PropertyCategory.POSITION);
		const hasCommand = properties.some((p) => p.category === PropertyCategory.COMMAND);
		const hasTilt = properties.some((p) => p.category === PropertyCategory.TILT);
		const typeProperty = properties.find((p) => p.category === PropertyCategory.TYPE);
		const typeValue = typeProperty?.value;
		const coverType = typeof typeValue === 'string' ? typeValue : null;

		return {
			id: `${deviceId}:${channelId}`,
			space_id: spaceId,
			device_id: deviceId,
			device_name: device.name,
			channel_id: channelId,
			channel_name: channel.name,
			role,
			priority,
			has_position: hasPosition,
			has_command: hasCommand,
			has_tilt: hasTilt,
			cover_type: coverType,
		};
	}
}

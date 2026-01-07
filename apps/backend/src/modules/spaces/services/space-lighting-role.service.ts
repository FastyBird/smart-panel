import { Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger';
import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../devices/devices.constants';
import { DeviceEntity } from '../../devices/entities/devices.entity';
import { SetLightingRoleDto } from '../dto/lighting-role.dto';
import { SpaceLightingRoleEntity } from '../entities/space-lighting-role.entity';
import { EventType, LightingRole, SPACES_MODULE_NAME } from '../spaces.constants';
import { SpacesValidationException } from '../spaces.exceptions';

import { SpacesService } from './spaces.service';

export interface LightTargetInfo {
	deviceId: string;
	deviceName: string;
	channelId: string;
	channelName: string;
	role: LightingRole | null;
	priority: number;
	hasBrightness: boolean;
	hasColorTemp: boolean;
	hasColor: boolean;
}

/**
 * Result of a single role operation in bulk update
 */
export interface BulkRoleResultItem {
	deviceId: string;
	channelId: string;
	success: boolean;
	role: LightingRole | null;
	error: string | null;
}

/**
 * Result of bulk role update operation
 */
export interface BulkRoleResult {
	success: boolean;
	totalCount: number;
	successCount: number;
	failureCount: number;
	results: BulkRoleResultItem[];
}

/**
 * Event payload for light target websocket events
 * Uses snake_case to match API conventions
 */
export interface LightTargetEventPayload {
	id: string;
	space_id: string;
	device_id: string;
	device_name: string;
	channel_id: string;
	channel_name: string;
	role: LightingRole | null;
	priority: number;
	has_brightness: boolean;
	has_color_temp: boolean;
	has_color: boolean;
}

@Injectable()
export class SpaceLightingRoleService {
	private readonly logger = createExtensionLogger(SPACES_MODULE_NAME, 'SpaceLightingRoleService');

	constructor(
		@InjectRepository(SpaceLightingRoleEntity)
		private readonly repository: Repository<SpaceLightingRoleEntity>,
		@InjectRepository(DeviceEntity)
		private readonly deviceRepository: Repository<DeviceEntity>,
		private readonly spacesService: SpacesService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	/**
	 * Get all lighting role assignments for a space
	 */
	async findBySpace(spaceId: string): Promise<SpaceLightingRoleEntity[]> {
		this.logger.debug(`Fetching lighting roles for space id=${spaceId}`);

		// Verify space exists
		await this.spacesService.getOneOrThrow(spaceId);

		const roles = await this.repository.find({
			where: { spaceId },
			order: { role: 'ASC', priority: 'ASC' },
		});

		this.logger.debug(`Found ${roles.length} lighting roles for space id=${spaceId}`);

		return roles;
	}

	/**
	 * Get a single lighting role assignment
	 */
	async findOne(spaceId: string, deviceId: string, channelId: string): Promise<SpaceLightingRoleEntity | null> {
		return this.repository.findOne({
			where: { spaceId, deviceId, channelId },
		});
	}

	/**
	 * Set or update a lighting role assignment
	 */
	async setRole(spaceId: string, dto: SetLightingRoleDto): Promise<SpaceLightingRoleEntity> {
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

		if (device.roomId !== spaceId) {
			throw new SpacesValidationException(`Device with id=${dto.deviceId} does not belong to space ${spaceId}`);
		}

		// Verify channel exists and belongs to the device
		const channel = device.channels?.find((ch) => ch.id === dto.channelId);

		if (!channel) {
			throw new SpacesValidationException(`Channel with id=${dto.channelId} not found on device ${dto.deviceId}`);
		}

		let roleEntity: SpaceLightingRoleEntity | null = null;
		let isUpdate = false;

		// Use a transaction to atomically check existence and upsert
		// This prevents race conditions where concurrent requests could both see
		// existingRole = null, causing both to emit LIGHT_TARGET_CREATED
		await this.repository.manager.transaction(async (transactionalManager) => {
			// Check if this is an update or create within the transaction
			const existingRole = await transactionalManager.findOne(SpaceLightingRoleEntity, {
				where: { spaceId, deviceId: dto.deviceId, channelId: dto.channelId },
			});
			isUpdate = existingRole !== null;

			// Upsert within the same transaction to maintain atomicity
			await transactionalManager.upsert(
				SpaceLightingRoleEntity,
				{
					spaceId,
					deviceId: dto.deviceId,
					channelId: dto.channelId,
					role: dto.role,
					priority: dto.priority ?? 0,
				},
				{
					conflictPaths: ['spaceId', 'deviceId', 'channelId'],
					skipUpdateIfNoValuesChanged: true,
				},
			);

			// Fetch the saved entity within the transaction
			roleEntity = await transactionalManager.findOne(SpaceLightingRoleEntity, {
				where: { spaceId, deviceId: dto.deviceId, channelId: dto.channelId },
			});
		});

		if (!roleEntity) {
			throw new SpacesValidationException(
				`Failed to save lighting role for device=${dto.deviceId} channel=${dto.channelId}`,
			);
		}

		// Emit event for websocket clients with full light target info
		const eventPayload = await this.buildLightTargetEventPayload(
			spaceId,
			dto.deviceId,
			dto.channelId,
			dto.role,
			dto.priority ?? 0,
		);

		if (eventPayload) {
			const eventType = isUpdate ? EventType.LIGHT_TARGET_UPDATED : EventType.LIGHT_TARGET_CREATED;
			this.eventEmitter.emit(eventType, eventPayload);
		}

		return roleEntity;
	}

	/**
	 * Bulk set/update lighting role assignments
	 * Returns detailed results for each role operation
	 */
	async bulkSetRoles(spaceId: string, roles: SetLightingRoleDto[]): Promise<BulkRoleResult> {
		// Verify space exists
		await this.spacesService.getOneOrThrow(spaceId);

		const results: BulkRoleResultItem[] = [];

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
	 * Delete a lighting role assignment
	 */
	async deleteRole(spaceId: string, deviceId: string, channelId: string): Promise<void> {
		// Verify space exists
		await this.spacesService.getOneOrThrow(spaceId);

		const role = await this.findOne(spaceId, deviceId, channelId);

		if (role) {
			await this.repository.remove(role);

			// Emit event for websocket clients with the light target ID
			this.eventEmitter.emit(EventType.LIGHT_TARGET_DELETED, {
				id: `${deviceId}:${channelId}`,
				space_id: spaceId,
				device_id: deviceId,
				channel_id: channelId,
			});
		}
	}

	/**
	 * Get all light targets in a space with their role assignments
	 * This combines device/channel info with role data
	 */
	async getLightTargetsInSpace(spaceId: string): Promise<LightTargetInfo[]> {
		this.logger.debug(`Getting light targets for space id=${spaceId}`);

		// Verify space exists
		await this.spacesService.getOneOrThrow(spaceId);

		// Get all devices in the space
		const devices = await this.spacesService.findDevicesBySpace(spaceId);

		// Get all existing role assignments for this space
		const existingRoles = await this.findBySpace(spaceId);
		const roleMap = new Map<string, SpaceLightingRoleEntity>();

		for (const role of existingRoles) {
			roleMap.set(`${role.deviceId}:${role.channelId}`, role);
		}

		const lightTargets: LightTargetInfo[] = [];

		for (const device of devices) {
			// Only process lighting devices
			if (device.category !== DeviceCategory.LIGHTING) {
				continue;
			}

			// Find light channels
			for (const channel of device.channels ?? []) {
				if (channel.category !== ChannelCategory.LIGHT) {
					continue;
				}

				// Check for properties
				const properties = channel.properties ?? [];
				const hasOn = properties.some((p) => p.category === PropertyCategory.ON);
				const hasBrightness = properties.some((p) => p.category === PropertyCategory.BRIGHTNESS);
				const hasColorTemp = properties.some((p) => p.category === PropertyCategory.COLOR_TEMPERATURE);
				const hasColor =
					properties.some((p) => p.category === PropertyCategory.HUE) ||
					properties.some((p) => p.category === PropertyCategory.SATURATION);

				// Only include if it has the ON property (required for lights)
				if (!hasOn) {
					continue;
				}

				// Get existing role assignment if any
				const roleKey = `${device.id}:${channel.id}`;
				const existingRole = roleMap.get(roleKey);

				lightTargets.push({
					deviceId: device.id,
					deviceName: device.name,
					channelId: channel.id,
					channelName: channel.name,
					role: existingRole?.role ?? null,
					priority: existingRole?.priority ?? 0,
					hasBrightness,
					hasColorTemp,
					hasColor,
				});
			}
		}

		this.logger.debug(`Found ${lightTargets.length} light targets in space id=${spaceId}`);

		return lightTargets;
	}

	/**
	 * Infer default lighting roles for a space (quick defaults helper)
	 * - First light becomes MAIN
	 * - Remaining lights become AMBIENT
	 */
	async inferDefaultLightingRoles(spaceId: string): Promise<SetLightingRoleDto[]> {
		this.logger.debug(`Inferring default lighting roles for space id=${spaceId}`);

		const lightTargets = await this.getLightTargetsInSpace(spaceId);

		if (lightTargets.length === 0) {
			return [];
		}

		const defaultRoles: SetLightingRoleDto[] = [];

		// First light is MAIN
		defaultRoles.push({
			deviceId: lightTargets[0].deviceId,
			channelId: lightTargets[0].channelId,
			role: LightingRole.MAIN,
			priority: 0,
		});

		// Remaining lights are AMBIENT
		for (let i = 1; i < lightTargets.length; i++) {
			defaultRoles.push({
				deviceId: lightTargets[i].deviceId,
				channelId: lightTargets[i].channelId,
				role: LightingRole.AMBIENT,
				priority: i,
			});
		}

		this.logger.debug(`Inferred ${defaultRoles.length} default lighting roles for space id=${spaceId}`);

		return defaultRoles;
	}

	/**
	 * Get role assignments for all lights in a space, indexed by device/channel
	 */
	async getRoleMap(spaceId: string): Promise<Map<string, SpaceLightingRoleEntity>> {
		const roles = await this.findBySpace(spaceId);
		const map = new Map<string, SpaceLightingRoleEntity>();

		for (const role of roles) {
			map.set(`${role.deviceId}:${role.channelId}`, role);
		}

		return map;
	}

	/**
	 * Build event payload for a light target with all required fields
	 */
	private async buildLightTargetEventPayload(
		spaceId: string,
		deviceId: string,
		channelId: string,
		role: LightingRole | null,
		priority: number,
	): Promise<LightTargetEventPayload | null> {
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
		const hasBrightness = properties.some((p) => p.category === PropertyCategory.BRIGHTNESS);
		const hasColorTemp = properties.some((p) => p.category === PropertyCategory.COLOR_TEMPERATURE);
		const hasColor =
			properties.some((p) => p.category === PropertyCategory.HUE) ||
			properties.some((p) => p.category === PropertyCategory.SATURATION);

		return {
			id: `${deviceId}:${channelId}`,
			space_id: spaceId,
			device_id: deviceId,
			device_name: device.name,
			channel_id: channelId,
			channel_name: channel.name,
			role,
			priority,
			has_brightness: hasBrightness,
			has_color_temp: hasColorTemp,
			has_color: hasColor,
		};
	}
}

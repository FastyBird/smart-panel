import { Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger';
import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../devices/devices.constants';
import { DeviceEntity } from '../../devices/entities/devices.entity';
import { SetLightingRoleDto } from '../dto/lighting-role.dto';
import { SpaceLightingRoleEntity } from '../entities/space-lighting-role.entity';
import { LightingRole, SPACES_MODULE_NAME } from '../spaces.constants';
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

@Injectable()
export class SpaceLightingRoleService {
	private readonly logger = createExtensionLogger(SPACES_MODULE_NAME, 'SpaceLightingRoleService');

	constructor(
		@InjectRepository(SpaceLightingRoleEntity)
		private readonly repository: Repository<SpaceLightingRoleEntity>,
		@InjectRepository(DeviceEntity)
		private readonly deviceRepository: Repository<DeviceEntity>,
		private readonly spacesService: SpacesService,
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
		this.logger.debug(`Setting lighting role for space=${spaceId} device=${dto.deviceId} channel=${dto.channelId}`);

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

		if (device.spaceId !== spaceId) {
			throw new SpacesValidationException(`Device with id=${dto.deviceId} does not belong to space ${spaceId}`);
		}

		// Verify channel exists and belongs to the device
		const channel = device.channels?.find((ch) => ch.id === dto.channelId);

		if (!channel) {
			throw new SpacesValidationException(`Channel with id=${dto.channelId} not found on device ${dto.deviceId}`);
		}

		// Use upsert to atomically insert or update, avoiding race conditions
		// that could cause unique constraint violations with concurrent requests
		await this.repository.upsert(
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

		// Fetch the saved entity to return
		const roleEntity = await this.findOne(spaceId, dto.deviceId, dto.channelId);

		if (!roleEntity) {
			throw new SpacesValidationException(
				`Failed to save lighting role for device=${dto.deviceId} channel=${dto.channelId}`,
			);
		}

		this.logger.debug(`Successfully set lighting role=${dto.role} for device=${dto.deviceId} channel=${dto.channelId}`);

		return roleEntity;
	}

	/**
	 * Bulk set/update lighting role assignments
	 */
	async bulkSetRoles(spaceId: string, roles: SetLightingRoleDto[]): Promise<number> {
		this.logger.debug(`Bulk setting ${roles.length} lighting roles for space id=${spaceId}`);

		// Verify space exists
		await this.spacesService.getOneOrThrow(spaceId);

		let updatedCount = 0;

		for (const dto of roles) {
			try {
				await this.setRole(spaceId, dto);
				updatedCount++;
			} catch (error) {
				this.logger.warn(`Failed to set role for device=${dto.deviceId} channel=${dto.channelId}: ${error}`);
			}
		}

		this.logger.debug(`Successfully bulk set ${updatedCount}/${roles.length} lighting roles for space id=${spaceId}`);

		return updatedCount;
	}

	/**
	 * Delete a lighting role assignment
	 */
	async deleteRole(spaceId: string, deviceId: string, channelId: string): Promise<void> {
		this.logger.debug(`Deleting lighting role for space=${spaceId} device=${deviceId} channel=${channelId}`);

		// Verify space exists
		await this.spacesService.getOneOrThrow(spaceId);

		const role = await this.findOne(spaceId, deviceId, channelId);

		if (role) {
			await this.repository.remove(role);
			this.logger.debug(`Successfully deleted lighting role for device=${deviceId} channel=${channelId}`);
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
}

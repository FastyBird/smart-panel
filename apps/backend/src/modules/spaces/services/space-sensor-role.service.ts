import { Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger';
import { ChannelCategory, DeviceCategory } from '../../devices/devices.constants';
import { ChannelEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { SetSensorRoleDto } from '../dto/sensor-role.dto';
import { SpaceSensorRoleEntity } from '../entities/space-sensor-role.entity';
import {
	EventType,
	SENSOR_AIR_QUALITY_CHANNEL_CATEGORIES,
	SENSOR_CHANNEL_CATEGORIES,
	SENSOR_ENERGY_CHANNEL_CATEGORIES,
	SENSOR_ENVIRONMENT_CHANNEL_CATEGORIES,
	SENSOR_SAFETY_CHANNEL_CATEGORIES,
	SENSOR_SECURITY_CHANNEL_CATEGORIES,
	SensorRole,
	SPACES_MODULE_NAME,
} from '../spaces.constants';
import { SpacesValidationException } from '../spaces.exceptions';

import { SpacesService } from './spaces.service';

export interface SensorTargetInfo {
	deviceId: string;
	deviceName: string;
	deviceCategory: DeviceCategory;
	channelId: string;
	channelName: string;
	channelCategory: ChannelCategory;
	role: SensorRole | null;
	priority: number;
}

/**
 * Result of a single role operation in bulk update
 */
export interface BulkSensorRoleResultItem {
	deviceId: string;
	channelId: string;
	success: boolean;
	role: SensorRole | null;
	error: string | null;
}

/**
 * Result of bulk role update operation
 */
export interface BulkSensorRoleResult {
	success: boolean;
	totalCount: number;
	successCount: number;
	failureCount: number;
	results: BulkSensorRoleResultItem[];
}

/**
 * Event payload for sensor target websocket events
 * Uses snake_case to match API conventions
 */
export interface SensorTargetEventPayload {
	id: string;
	space_id: string;
	device_id: string;
	device_name: string;
	device_category: DeviceCategory;
	channel_id: string;
	channel_name: string;
	channel_category: ChannelCategory;
	role: SensorRole | null;
	priority: number;
}

@Injectable()
export class SpaceSensorRoleService {
	private readonly logger = createExtensionLogger(SPACES_MODULE_NAME, 'SpaceSensorRoleService');

	constructor(
		@InjectRepository(SpaceSensorRoleEntity)
		private readonly repository: Repository<SpaceSensorRoleEntity>,
		@InjectRepository(DeviceEntity)
		private readonly deviceRepository: Repository<DeviceEntity>,
		@InjectRepository(ChannelEntity)
		private readonly channelRepository: Repository<ChannelEntity>,
		private readonly spacesService: SpacesService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	/**
	 * Get all sensor role assignments for a space
	 */
	async findBySpace(spaceId: string): Promise<SpaceSensorRoleEntity[]> {
		this.logger.debug(`Fetching sensor roles for space id=${spaceId}`);

		// Verify space exists
		await this.spacesService.getOneOrThrow(spaceId);

		const roles = await this.repository.find({
			where: { spaceId },
			order: { role: 'ASC', priority: 'ASC' },
		});

		this.logger.debug(`Found ${roles.length} sensor roles for space id=${spaceId}`);

		return roles;
	}

	/**
	 * Get a single sensor role assignment
	 */
	async findOne(spaceId: string, deviceId: string, channelId: string): Promise<SpaceSensorRoleEntity | null> {
		return this.repository.findOne({
			where: { spaceId, deviceId, channelId },
		});
	}

	/**
	 * Set, update, or remove a sensor role assignment
	 * - If role is null/undefined, the role assignment is removed
	 * - Sensor roles always require channelId
	 */
	async setRole(spaceId: string, dto: SetSensorRoleDto): Promise<SpaceSensorRoleEntity | null> {
		// Verify space exists
		await this.spacesService.getOneOrThrow(spaceId);

		const channelId = dto.channelId;

		// If role is null/undefined, delete the role assignment
		if (dto.role === null || dto.role === undefined) {
			await this.deleteRole(spaceId, dto.deviceId, channelId);
			return null;
		}

		// Verify device exists and belongs to this space
		const device = await this.deviceRepository.findOne({
			where: { id: dto.deviceId },
			relations: ['channels', 'channels.properties'],
		});

		if (!device) {
			throw new SpacesValidationException(`Device with id=${dto.deviceId} not found`);
		}

		// Verify device belongs to this space (works for both rooms and zones)
		const deviceInSpace = await this.spacesService.isDeviceInSpace(spaceId, dto.deviceId);
		if (!deviceInSpace) {
			throw new SpacesValidationException(`Device with id=${dto.deviceId} does not belong to space ${spaceId}`);
		}

		// Verify channel exists on device
		const channel = device.channels?.find((c) => c.id === channelId);
		if (!channel) {
			throw new SpacesValidationException(`Channel with id=${channelId} not found on device ${dto.deviceId}`);
		}

		// Verify channel is a valid sensor channel category
		const isSensorChannel = SENSOR_CHANNEL_CATEGORIES.includes(
			channel.category as (typeof SENSOR_CHANNEL_CATEGORIES)[number],
		);
		if (!isSensorChannel) {
			throw new SpacesValidationException(
				`Channel ${channelId} is not a sensor channel. Valid sensor channels include temperature, humidity, motion, contact, smoke, etc.`,
			);
		}

		let roleEntity: SpaceSensorRoleEntity | null = null;
		let isUpdate = false;
		let hasChanges = false;

		const newRole = dto.role;
		const newPriority = dto.priority ?? 0;

		// Use a transaction to atomically check existence and upsert
		await this.repository.manager.transaction(async (transactionalManager) => {
			// Check if this is an update or create within the transaction
			const existingRole = await transactionalManager.findOne(SpaceSensorRoleEntity, {
				where: { spaceId, deviceId: dto.deviceId, channelId },
			});
			isUpdate = existingRole !== null;

			// Detect actual changes to avoid spurious events
			if (existingRole) {
				hasChanges = existingRole.role !== newRole || existingRole.priority !== newPriority;
			} else {
				hasChanges = true; // New record is always a change
			}

			if (existingRole) {
				// Update existing role
				existingRole.role = newRole;
				existingRole.priority = newPriority;
				roleEntity = await transactionalManager.save(existingRole);
			} else {
				// Create new role
				const newEntity = transactionalManager.create(SpaceSensorRoleEntity, {
					spaceId,
					deviceId: dto.deviceId,
					channelId,
					role: newRole,
					priority: newPriority,
				});
				roleEntity = await transactionalManager.save(newEntity);
			}
		});

		if (!roleEntity) {
			throw new SpacesValidationException(`Failed to save sensor role for device=${dto.deviceId}`);
		}

		// Only emit event if values actually changed
		if (hasChanges) {
			// Emit event for websocket clients with full sensor target info
			const eventPayload = await this.buildSensorTargetEventPayload(
				spaceId,
				dto.deviceId,
				channelId,
				dto.role,
				dto.priority ?? 0,
			);

			if (eventPayload) {
				const eventType = isUpdate ? EventType.SENSOR_TARGET_UPDATED : EventType.SENSOR_TARGET_CREATED;
				this.eventEmitter.emit(eventType, eventPayload);
			}
		}

		return roleEntity;
	}

	/**
	 * Bulk set/update sensor role assignments
	 * Returns detailed results for each role operation
	 */
	async bulkSetRoles(spaceId: string, roles: SetSensorRoleDto[]): Promise<BulkSensorRoleResult> {
		// Verify space exists
		await this.spacesService.getOneOrThrow(spaceId);

		const results: BulkSensorRoleResultItem[] = [];

		for (const dto of roles) {
			try {
				await this.setRole(spaceId, dto);
				results.push({
					deviceId: dto.deviceId,
					channelId: dto.channelId,
					success: true,
					role: dto.role ?? null,
					error: null,
				});
			} catch (error) {
				const err = error as Error;
				this.logger.warn(`Failed to set role for device=${dto.deviceId}, channel=${dto.channelId}: ${err.message}`);
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
	 * Delete a sensor role assignment
	 */
	async deleteRole(spaceId: string, deviceId: string, channelId: string): Promise<void> {
		// Verify space exists
		await this.spacesService.getOneOrThrow(spaceId);

		const role = await this.findOne(spaceId, deviceId, channelId);

		if (role) {
			await this.repository.remove(role);

			// Emit event for websocket clients
			const targetId = `${deviceId}:${channelId}`;
			this.eventEmitter.emit(EventType.SENSOR_TARGET_DELETED, {
				id: targetId,
				space_id: spaceId,
				device_id: deviceId,
				channel_id: channelId,
			});
		}
	}

	/**
	 * Get all sensor targets in a space with their role assignments
	 * Each sensor channel is a separate target
	 */
	async getSensorTargetsInSpace(spaceId: string): Promise<SensorTargetInfo[]> {
		this.logger.debug(`Getting sensor targets for space id=${spaceId}`);

		// Verify space exists
		await this.spacesService.getOneOrThrow(spaceId);

		// Get all devices in the space
		const devices = await this.spacesService.findDevicesBySpace(spaceId);

		// Get all existing role assignments for this space
		const existingRoles = await this.findBySpace(spaceId);
		const roleMap = new Map<string, SpaceSensorRoleEntity>();

		for (const role of existingRoles) {
			const key = `${role.deviceId}:${role.channelId}`;
			roleMap.set(key, role);
		}

		const sensorTargets: SensorTargetInfo[] = [];

		for (const device of devices) {
			// Process any device that has sensor channels
			for (const channel of device.channels ?? []) {
				// Only include channels that are sensor channel types
				const isSensorChannel = SENSOR_CHANNEL_CATEGORIES.includes(
					channel.category as (typeof SENSOR_CHANNEL_CATEGORIES)[number],
				);
				if (!isSensorChannel) {
					continue;
				}

				const key = `${device.id}:${channel.id}`;
				const existingRole = roleMap.get(key);

				sensorTargets.push({
					deviceId: device.id,
					deviceName: device.name,
					deviceCategory: device.category,
					channelId: channel.id,
					channelName: channel.name ?? channel.category,
					channelCategory: channel.category,
					role: existingRole?.role ?? null,
					priority: existingRole?.priority ?? 0,
				});
			}
		}

		this.logger.debug(`Found ${sensorTargets.length} sensor targets in space id=${spaceId}`);

		return sensorTargets;
	}

	/**
	 * Infer default sensor roles for a space based on channel categories
	 */
	async inferDefaultSensorRoles(spaceId: string): Promise<SetSensorRoleDto[]> {
		this.logger.debug(`Inferring default sensor roles for space id=${spaceId}`);

		const sensorTargets = await this.getSensorTargetsInSpace(spaceId);

		if (sensorTargets.length === 0) {
			return [];
		}

		const defaultRoles: SetSensorRoleDto[] = [];

		for (let i = 0; i < sensorTargets.length; i++) {
			const target = sensorTargets[i];
			const role = this.inferRoleFromChannelCategory(target.channelCategory);

			defaultRoles.push({
				deviceId: target.deviceId,
				channelId: target.channelId,
				role,
				priority: i,
			});
		}

		this.logger.debug(`Inferred ${defaultRoles.length} default sensor roles for space id=${spaceId}`);

		return defaultRoles;
	}

	/**
	 * Infer sensor role from channel category
	 */
	private inferRoleFromChannelCategory(channelCategory: ChannelCategory): SensorRole {
		if (
			SENSOR_ENVIRONMENT_CHANNEL_CATEGORIES.includes(
				channelCategory as (typeof SENSOR_ENVIRONMENT_CHANNEL_CATEGORIES)[number],
			)
		) {
			return SensorRole.ENVIRONMENT;
		}

		if (
			SENSOR_SAFETY_CHANNEL_CATEGORIES.includes(channelCategory as (typeof SENSOR_SAFETY_CHANNEL_CATEGORIES)[number])
		) {
			return SensorRole.SAFETY;
		}

		if (
			SENSOR_SECURITY_CHANNEL_CATEGORIES.includes(
				channelCategory as (typeof SENSOR_SECURITY_CHANNEL_CATEGORIES)[number],
			)
		) {
			return SensorRole.SECURITY;
		}

		if (
			SENSOR_AIR_QUALITY_CHANNEL_CATEGORIES.includes(
				channelCategory as (typeof SENSOR_AIR_QUALITY_CHANNEL_CATEGORIES)[number],
			)
		) {
			return SensorRole.AIR_QUALITY;
		}

		if (
			SENSOR_ENERGY_CHANNEL_CATEGORIES.includes(channelCategory as (typeof SENSOR_ENERGY_CHANNEL_CATEGORIES)[number])
		) {
			return SensorRole.ENERGY;
		}

		return SensorRole.OTHER;
	}

	/**
	 * Get role assignments for all sensor targets in a space, indexed by target key.
	 * Key format: deviceId:channelId
	 */
	async getRoleMap(spaceId: string): Promise<Map<string, SpaceSensorRoleEntity>> {
		const roles = await this.findBySpace(spaceId);
		const map = new Map<string, SpaceSensorRoleEntity>();

		for (const role of roles) {
			const key = `${role.deviceId}:${role.channelId}`;
			map.set(key, role);
		}

		return map;
	}

	/**
	 * Build event payload for a sensor target with all required fields
	 */
	private async buildSensorTargetEventPayload(
		spaceId: string,
		deviceId: string,
		channelId: string,
		role: SensorRole | null,
		priority: number,
	): Promise<SensorTargetEventPayload | null> {
		// Fetch device with channels
		const device = await this.deviceRepository.findOne({
			where: { id: deviceId },
			relations: ['channels'],
		});

		if (!device) {
			this.logger.warn(`Device ${deviceId} not found when building event payload`);
			return null;
		}

		const channel = device.channels?.find((c) => c.id === channelId);
		if (!channel) {
			this.logger.warn(`Channel ${channelId} not found on device ${deviceId} when building event payload`);
			return null;
		}

		const id = `${deviceId}:${channelId}`;

		return {
			id,
			space_id: spaceId,
			device_id: deviceId,
			device_name: device.name,
			device_category: device.category,
			channel_id: channelId,
			channel_name: channel.name ?? channel.category,
			channel_category: channel.category,
			role,
			priority,
		};
	}
}

import { Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger';
import { DeviceCategory, PropertyCategory } from '../../devices/devices.constants';
import { DeviceEntity } from '../../devices/entities/devices.entity';
import { SetClimateRoleDto } from '../dto/climate-role.dto';
import { SpaceClimateRoleEntity } from '../entities/space-climate-role.entity';
import { ClimateRole, EventType, SPACES_MODULE_NAME } from '../spaces.constants';
import { SpacesValidationException } from '../spaces.exceptions';

import { SpacesService } from './spaces.service';

/**
 * Climate device categories for filtering
 */
const CLIMATE_DEVICE_CATEGORIES = [
	DeviceCategory.THERMOSTAT,
	DeviceCategory.HEATER,
	DeviceCategory.AIR_CONDITIONER,
	DeviceCategory.FAN,
	DeviceCategory.AIR_HUMIDIFIER,
	DeviceCategory.AIR_DEHUMIDIFIER,
	DeviceCategory.AIR_PURIFIER,
];

export interface ClimateTargetInfo {
	deviceId: string;
	deviceName: string;
	deviceCategory: DeviceCategory;
	role: ClimateRole | null;
	priority: number;
	hasTemperature: boolean;
	hasHumidity: boolean;
	hasMode: boolean;
}

/**
 * Result of a single role operation in bulk update
 */
export interface BulkClimateRoleResultItem {
	deviceId: string;
	success: boolean;
	role: ClimateRole | null;
	error: string | null;
}

/**
 * Result of bulk role update operation
 */
export interface BulkClimateRoleResult {
	success: boolean;
	totalCount: number;
	successCount: number;
	failureCount: number;
	results: BulkClimateRoleResultItem[];
}

/**
 * Event payload for climate target websocket events
 * Uses snake_case to match API conventions
 */
export interface ClimateTargetEventPayload {
	id: string;
	space_id: string;
	device_id: string;
	device_name: string;
	device_category: DeviceCategory;
	role: ClimateRole | null;
	priority: number;
	has_temperature: boolean;
	has_humidity: boolean;
	has_mode: boolean;
}

@Injectable()
export class SpaceClimateRoleService {
	private readonly logger = createExtensionLogger(SPACES_MODULE_NAME, 'SpaceClimateRoleService');

	constructor(
		@InjectRepository(SpaceClimateRoleEntity)
		private readonly repository: Repository<SpaceClimateRoleEntity>,
		@InjectRepository(DeviceEntity)
		private readonly deviceRepository: Repository<DeviceEntity>,
		private readonly spacesService: SpacesService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	/**
	 * Get all climate role assignments for a space
	 */
	async findBySpace(spaceId: string): Promise<SpaceClimateRoleEntity[]> {
		this.logger.debug(`Fetching climate roles for space id=${spaceId}`);

		// Verify space exists
		await this.spacesService.getOneOrThrow(spaceId);

		const roles = await this.repository.find({
			where: { spaceId },
			order: { role: 'ASC', priority: 'ASC' },
		});

		this.logger.debug(`Found ${roles.length} climate roles for space id=${spaceId}`);

		return roles;
	}

	/**
	 * Get a single climate role assignment
	 */
	async findOne(spaceId: string, deviceId: string): Promise<SpaceClimateRoleEntity | null> {
		return this.repository.findOne({
			where: { spaceId, deviceId },
		});
	}

	/**
	 * Set or update a climate role assignment
	 */
	async setRole(spaceId: string, dto: SetClimateRoleDto): Promise<SpaceClimateRoleEntity> {
		// Verify space exists
		await this.spacesService.getOneOrThrow(spaceId);

		// Verify device exists and belongs to this space
		const device = await this.deviceRepository.findOne({
			where: { id: dto.deviceId },
			relations: ['channels', 'channels.properties'],
		});

		if (!device) {
			throw new SpacesValidationException(`Device with id=${dto.deviceId} not found`);
		}

		if (device.roomId !== spaceId) {
			throw new SpacesValidationException(`Device with id=${dto.deviceId} does not belong to space ${spaceId}`);
		}

		// Verify device is a climate device
		if (!CLIMATE_DEVICE_CATEGORIES.includes(device.category)) {
			throw new SpacesValidationException(`Device with id=${dto.deviceId} is not a climate device`);
		}

		let roleEntity: SpaceClimateRoleEntity | null = null;
		let isUpdate = false;
		let hasChanges = false;

		const newRole = dto.role;
		const newPriority = dto.priority ?? 0;

		// Use a transaction to atomically check existence and upsert
		await this.repository.manager.transaction(async (transactionalManager) => {
			// Check if this is an update or create within the transaction
			const existingRole = await transactionalManager.findOne(SpaceClimateRoleEntity, {
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
				SpaceClimateRoleEntity,
				{
					spaceId,
					deviceId: dto.deviceId,
					role: newRole,
					priority: newPriority,
				},
				{
					conflictPaths: ['spaceId', 'deviceId'],
					skipUpdateIfNoValuesChanged: true,
				},
			);

			// Fetch the saved entity within the transaction
			roleEntity = await transactionalManager.findOne(SpaceClimateRoleEntity, {
				where: { spaceId, deviceId: dto.deviceId },
			});
		});

		if (!roleEntity) {
			throw new SpacesValidationException(`Failed to save climate role for device=${dto.deviceId}`);
		}

		// Only emit event if values actually changed
		if (hasChanges) {
			// Emit event for websocket clients with full climate target info
			const eventPayload = await this.buildClimateTargetEventPayload(
				spaceId,
				dto.deviceId,
				dto.role,
				dto.priority ?? 0,
			);

			if (eventPayload) {
				const eventType = isUpdate ? EventType.CLIMATE_TARGET_UPDATED : EventType.CLIMATE_TARGET_CREATED;
				this.eventEmitter.emit(eventType, eventPayload);
			}
		}

		return roleEntity;
	}

	/**
	 * Bulk set/update climate role assignments
	 * Returns detailed results for each role operation
	 */
	async bulkSetRoles(spaceId: string, roles: SetClimateRoleDto[]): Promise<BulkClimateRoleResult> {
		// Verify space exists
		await this.spacesService.getOneOrThrow(spaceId);

		const results: BulkClimateRoleResultItem[] = [];

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
	 * Delete a climate role assignment
	 */
	async deleteRole(spaceId: string, deviceId: string): Promise<void> {
		// Verify space exists
		await this.spacesService.getOneOrThrow(spaceId);

		const role = await this.findOne(spaceId, deviceId);

		if (role) {
			await this.repository.remove(role);

			// Emit event for websocket clients with the climate target ID
			this.eventEmitter.emit(EventType.CLIMATE_TARGET_DELETED, {
				id: deviceId,
				space_id: spaceId,
				device_id: deviceId,
			});
		}
	}

	/**
	 * Get all climate targets in a space with their role assignments
	 * This works at device level - each climate device is a target
	 */
	async getClimateTargetsInSpace(spaceId: string): Promise<ClimateTargetInfo[]> {
		this.logger.debug(`Getting climate targets for space id=${spaceId}`);

		// Verify space exists
		await this.spacesService.getOneOrThrow(spaceId);

		// Get all devices in the space
		const devices = await this.spacesService.findDevicesBySpace(spaceId);

		// Get all existing role assignments for this space
		const existingRoles = await this.findBySpace(spaceId);
		const roleMap = new Map<string, SpaceClimateRoleEntity>();

		for (const role of existingRoles) {
			roleMap.set(role.deviceId, role);
		}

		const climateTargets: ClimateTargetInfo[] = [];

		for (const device of devices) {
			// Only process climate devices
			if (!CLIMATE_DEVICE_CATEGORIES.includes(device.category)) {
				continue;
			}

			// Aggregate capabilities from all device channels
			let hasTemperature = false;
			let hasHumidity = false;
			let hasMode = false;

			for (const channel of device.channels ?? []) {
				const properties = channel.properties ?? [];
				if (properties.some((p) => p.category === PropertyCategory.TEMPERATURE)) {
					hasTemperature = true;
				}
				if (properties.some((p) => p.category === PropertyCategory.HUMIDITY)) {
					hasHumidity = true;
				}
				if (properties.some((p) => p.category === PropertyCategory.MODE)) {
					hasMode = true;
				}
			}

			// Get existing role assignment if any
			const existingRole = roleMap.get(device.id);

			climateTargets.push({
				deviceId: device.id,
				deviceName: device.name,
				deviceCategory: device.category,
				role: existingRole?.role ?? null,
				priority: existingRole?.priority ?? 0,
				hasTemperature,
				hasHumidity,
				hasMode,
			});
		}

		this.logger.debug(`Found ${climateTargets.length} climate targets in space id=${spaceId}`);

		return climateTargets;
	}

	/**
	 * Infer default climate roles for a space (quick defaults helper)
	 * - Thermostats become PRIMARY
	 * - Heaters/AC become AUXILIARY
	 * - Fans become VENTILATION
	 * - Humidifiers/Dehumidifiers become HUMIDITY
	 * - Others become OTHER
	 */
	async inferDefaultClimateRoles(spaceId: string): Promise<SetClimateRoleDto[]> {
		this.logger.debug(`Inferring default climate roles for space id=${spaceId}`);

		const climateTargets = await this.getClimateTargetsInSpace(spaceId);

		if (climateTargets.length === 0) {
			return [];
		}

		const defaultRoles: SetClimateRoleDto[] = [];
		let primaryFound = false;

		for (let i = 0; i < climateTargets.length; i++) {
			const target = climateTargets[i];
			let role: ClimateRole;

			// Assign role based on device category
			if (target.deviceCategory === DeviceCategory.THERMOSTAT && !primaryFound) {
				role = ClimateRole.PRIMARY;
				primaryFound = true;
			} else if (
				target.deviceCategory === DeviceCategory.HEATER ||
				target.deviceCategory === DeviceCategory.AIR_CONDITIONER ||
				target.deviceCategory === DeviceCategory.THERMOSTAT
			) {
				role = ClimateRole.AUXILIARY;
			} else if (target.deviceCategory === DeviceCategory.FAN) {
				role = ClimateRole.VENTILATION;
			} else if (
				target.deviceCategory === DeviceCategory.AIR_HUMIDIFIER ||
				target.deviceCategory === DeviceCategory.AIR_DEHUMIDIFIER ||
				target.deviceCategory === DeviceCategory.AIR_PURIFIER
			) {
				role = ClimateRole.HUMIDITY;
			} else {
				role = ClimateRole.OTHER;
			}

			defaultRoles.push({
				deviceId: target.deviceId,
				role,
				priority: i,
			});
		}

		this.logger.debug(`Inferred ${defaultRoles.length} default climate roles for space id=${spaceId}`);

		return defaultRoles;
	}

	/**
	 * Get role assignments for all climate devices in a space, indexed by device ID
	 */
	async getRoleMap(spaceId: string): Promise<Map<string, SpaceClimateRoleEntity>> {
		const roles = await this.findBySpace(spaceId);
		const map = new Map<string, SpaceClimateRoleEntity>();

		for (const role of roles) {
			map.set(role.deviceId, role);
		}

		return map;
	}

	/**
	 * Build event payload for a climate target with all required fields
	 */
	private async buildClimateTargetEventPayload(
		spaceId: string,
		deviceId: string,
		role: ClimateRole | null,
		priority: number,
	): Promise<ClimateTargetEventPayload | null> {
		// Fetch device with channels and properties
		const device = await this.deviceRepository.findOne({
			where: { id: deviceId },
			relations: ['channels', 'channels.properties'],
		});

		if (!device) {
			this.logger.warn(`Device ${deviceId} not found when building event payload`);
			return null;
		}

		// Aggregate capabilities from all device channels
		let hasTemperature = false;
		let hasHumidity = false;
		let hasMode = false;

		for (const channel of device.channels ?? []) {
			const properties = channel.properties ?? [];
			if (properties.some((p) => p.category === PropertyCategory.TEMPERATURE)) {
				hasTemperature = true;
			}
			if (properties.some((p) => p.category === PropertyCategory.HUMIDITY)) {
				hasHumidity = true;
			}
			if (properties.some((p) => p.category === PropertyCategory.MODE)) {
				hasMode = true;
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
			has_temperature: hasTemperature,
			has_humidity: hasHumidity,
			has_mode: hasMode,
		};
	}
}

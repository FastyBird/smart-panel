import { Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger';
import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../devices/devices.constants';
import { ChannelEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { SetClimateRoleDto } from '../dto/climate-role.dto';
import { SpaceClimateRoleEntity } from '../entities/space-climate-role.entity';
import {
	CLIMATE_SENSOR_CHANNEL_CATEGORIES,
	CLIMATE_SENSOR_ROLES,
	CLIMATE_UNIVERSAL_ROLES,
	ClimateRole,
	EventType,
	SPACES_MODULE_NAME,
} from '../spaces.constants';
import { SpacesValidationException } from '../spaces.exceptions';

import { SpacesService } from './spaces.service';

/**
 * Climate device categories for filtering (actuators)
 * These are the device types that can be controlled in the climate domain.
 * The panel app works with these devices for heating/cooling control.
 */
const CLIMATE_ACTUATOR_CATEGORIES = [
	DeviceCategory.THERMOSTAT,
	DeviceCategory.HEATING_UNIT,
	DeviceCategory.AIR_CONDITIONER,
];

/**
 * All climate device categories (actuators + sensors)
 */
const CLIMATE_DEVICE_CATEGORIES = [...CLIMATE_ACTUATOR_CATEGORIES, DeviceCategory.SENSOR];

export interface ClimateTargetInfo {
	deviceId: string;
	deviceName: string;
	deviceCategory: DeviceCategory;
	channelId: string | null;
	channelName: string | null;
	channelCategory: ChannelCategory | null;
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
	channelId: string | null;
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
	channel_id: string | null;
	channel_name: string | null;
	channel_category: ChannelCategory | null;
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
		@InjectRepository(ChannelEntity)
		private readonly channelRepository: Repository<ChannelEntity>,
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
	async findOne(spaceId: string, deviceId: string, channelId?: string | null): Promise<SpaceClimateRoleEntity | null> {
		return this.repository.findOne({
			where: { spaceId, deviceId, channelId: channelId ?? null },
		});
	}

	/**
	 * Set or update a climate role assignment
	 * - PRIMARY role can only be assigned to one device per space
	 * - Sensor roles (TEMPERATURE_SENSOR, HUMIDITY_SENSOR) require channelId
	 * - Actuator roles require channelId to be null
	 */
	async setRole(spaceId: string, dto: SetClimateRoleDto): Promise<SpaceClimateRoleEntity> {
		// Verify space exists
		await this.spacesService.getOneOrThrow(spaceId);

		const isSensorRole = CLIMATE_SENSOR_ROLES.includes(dto.role as (typeof CLIMATE_SENSOR_ROLES)[number]);
		const isUniversalRole = CLIMATE_UNIVERSAL_ROLES.includes(dto.role as (typeof CLIMATE_UNIVERSAL_ROLES)[number]);
		const channelId = dto.channelId ?? null;

		// Validate channelId requirements
		if (isSensorRole && !channelId) {
			throw new SpacesValidationException(`Sensor roles (${dto.role}) require a channel_id to be specified`);
		}
		// Universal roles (like HIDDEN) can be used with or without channelId
		if (!isSensorRole && !isUniversalRole && channelId) {
			throw new SpacesValidationException(
				`Actuator roles (${dto.role}) must not have a channel_id - they operate at device level`,
			);
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

		// Verify device is a climate device
		if (!CLIMATE_DEVICE_CATEGORIES.includes(device.category)) {
			throw new SpacesValidationException(`Device with id=${dto.deviceId} is not a climate device`);
		}

		// For sensor roles, verify the channel exists and belongs to the device
		if (isSensorRole && channelId) {
			const channel = device.channels?.find((c) => c.id === channelId);
			if (!channel) {
				throw new SpacesValidationException(`Channel with id=${channelId} not found on device ${dto.deviceId}`);
			}

			// Verify channel is a climate sensor channel (temperature, humidity, air quality, etc.)
			const isClimateSensorChannel = CLIMATE_SENSOR_CHANNEL_CATEGORIES.includes(
				channel.category as (typeof CLIMATE_SENSOR_CHANNEL_CATEGORIES)[number],
			);
			if (!isClimateSensorChannel) {
				throw new SpacesValidationException(
					`Channel ${channelId} is not a climate sensor channel (expected: temperature, humidity, air_quality, air_particulate, carbon_dioxide, volatile_organic_compounds, or pressure)`,
				);
			}
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
				where: { spaceId, deviceId: dto.deviceId, channelId },
			});
			isUpdate = existingRole !== null;

			// Detect actual changes to avoid spurious events
			if (existingRole) {
				hasChanges =
					existingRole.role !== newRole ||
					existingRole.priority !== newPriority ||
					existingRole.channelId !== channelId;
			} else {
				hasChanges = true; // New record is always a change
			}

			// Use explicit insert/update instead of upsert to handle NULL channelId correctly
			// SQLite treats NULL as distinct in unique constraints, so upsert's conflictPaths
			// won't detect conflicts when channelId is NULL (actuator roles)
			if (existingRole) {
				// Update existing role
				existingRole.role = newRole;
				existingRole.priority = newPriority;
				existingRole.channelId = channelId;
				roleEntity = await transactionalManager.save(existingRole);
			} else {
				// Create new role
				const newEntity = transactionalManager.create(SpaceClimateRoleEntity, {
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
			throw new SpacesValidationException(`Failed to save climate role for device=${dto.deviceId}`);
		}

		// Only emit event if values actually changed
		if (hasChanges) {
			// Emit event for websocket clients with full climate target info
			const eventPayload = await this.buildClimateTargetEventPayload(
				spaceId,
				dto.deviceId,
				channelId,
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
					channelId: dto.channelId ?? null,
					success: true,
					role: dto.role,
					error: null,
				});
			} catch (error) {
				const err = error as Error;
				this.logger.warn(`Failed to set role for device=${dto.deviceId}: ${err.message}`);
				results.push({
					deviceId: dto.deviceId,
					channelId: dto.channelId ?? null,
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
	 * - For actuator roles: only deviceId is needed (channelId is null)
	 * - For sensor roles: channelId must be provided to identify the specific channel
	 */
	async deleteRole(spaceId: string, deviceId: string, channelId?: string | null): Promise<void> {
		// Verify space exists
		await this.spacesService.getOneOrThrow(spaceId);

		const role = await this.findOne(spaceId, deviceId, channelId);

		if (role) {
			await this.repository.remove(role);

			// Emit event for websocket clients with the climate target ID
			// For sensors, the target ID includes the channelId
			const targetId = channelId ? `${deviceId}:${channelId}` : deviceId;
			this.eventEmitter.emit(EventType.CLIMATE_TARGET_DELETED, {
				id: targetId,
				space_id: spaceId,
				device_id: deviceId,
				channel_id: channelId ?? null,
			});
		}
	}

	/**
	 * Get all climate targets in a space with their role assignments
	 * - Actuators (thermostat, heater, AC, etc.) are device-level targets with channelId: null
	 * - Sensors are channel-level targets - each channel with temperature/humidity is a separate target
	 */
	async getClimateTargetsInSpace(spaceId: string): Promise<ClimateTargetInfo[]> {
		this.logger.debug(`Getting climate targets for space id=${spaceId}`);

		// Verify space exists
		await this.spacesService.getOneOrThrow(spaceId);

		// Get all devices in the space
		const devices = await this.spacesService.findDevicesBySpace(spaceId);

		// Get all existing role assignments for this space
		const existingRoles = await this.findBySpace(spaceId);
		// Key format: deviceId or deviceId:channelId for sensor channels
		const roleMap = new Map<string, SpaceClimateRoleEntity>();

		for (const role of existingRoles) {
			const key = role.channelId ? `${role.deviceId}:${role.channelId}` : role.deviceId;
			roleMap.set(key, role);
		}

		const climateTargets: ClimateTargetInfo[] = [];

		for (const device of devices) {
			// Only process climate devices
			if (!CLIMATE_DEVICE_CATEGORIES.includes(device.category)) {
				continue;
			}

			if (device.category === DeviceCategory.SENSOR) {
				// For sensors, create a target for each channel that is a climate sensor type
				for (const channel of device.channels ?? []) {
					// Only include channels that are climate sensor channels
					const isClimateSensorChannel = CLIMATE_SENSOR_CHANNEL_CATEGORIES.includes(
						channel.category as (typeof CLIMATE_SENSOR_CHANNEL_CATEGORIES)[number],
					);
					if (!isClimateSensorChannel) {
						continue;
					}

					const properties = channel.properties ?? [];
					const hasTemperature = properties.some((p) => p.category === PropertyCategory.TEMPERATURE);
					const hasHumidity = properties.some((p) => p.category === PropertyCategory.HUMIDITY);

					const key = `${device.id}:${channel.id}`;
					const existingRole = roleMap.get(key);

					climateTargets.push({
						deviceId: device.id,
						deviceName: device.name,
						deviceCategory: device.category,
						channelId: channel.id,
						channelName: channel.name ?? null,
						channelCategory: channel.category,
						role: existingRole?.role ?? null,
						priority: existingRole?.priority ?? 0,
						hasTemperature,
						hasHumidity,
						hasMode: false, // Sensors don't have mode
					});
				}
			} else {
				// For actuators, create a device-level target
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

				const existingRole = roleMap.get(device.id);

				climateTargets.push({
					deviceId: device.id,
					deviceName: device.name,
					deviceCategory: device.category,
					channelId: null,
					channelName: null,
					channelCategory: null,
					role: existingRole?.role ?? null,
					priority: existingRole?.priority ?? 0,
					hasTemperature,
					hasHumidity,
					hasMode,
				});
			}
		}

		this.logger.debug(`Found ${climateTargets.length} climate targets in space id=${spaceId}`);

		return climateTargets;
	}

	/**
	 * Infer default climate roles for a space (quick defaults helper)
	 *
	 * Control roles (actuators):
	 * - Thermostats: AUTO (can be used for both heating and cooling)
	 * - Heating units: HEATING_ONLY
	 * - Air conditioners: COOLING_ONLY
	 *
	 * Read roles (sensors):
	 * - All climate sensor channels: SENSOR (included in climate domain)
	 */
	async inferDefaultClimateRoles(spaceId: string): Promise<SetClimateRoleDto[]> {
		this.logger.debug(`Inferring default climate roles for space id=${spaceId}`);

		const climateTargets = await this.getClimateTargetsInSpace(spaceId);

		if (climateTargets.length === 0) {
			return [];
		}

		const defaultRoles: SetClimateRoleDto[] = [];

		for (let i = 0; i < climateTargets.length; i++) {
			const target = climateTargets[i];
			let role: ClimateRole;

			if (target.deviceCategory === DeviceCategory.SENSOR) {
				// All climate sensors get SENSOR role (included in climate domain)
				role = ClimateRole.SENSOR;
			} else {
				// Actuators get control roles based on device category
				if (target.deviceCategory === DeviceCategory.THERMOSTAT) {
					// Thermostats can do both heating and cooling
					role = ClimateRole.AUTO;
				} else if (target.deviceCategory === DeviceCategory.HEATING_UNIT) {
					// Heating units can only heat
					role = ClimateRole.HEATING_ONLY;
				} else if (target.deviceCategory === DeviceCategory.AIR_CONDITIONER) {
					// Air conditioners can only cool
					role = ClimateRole.COOLING_ONLY;
				} else {
					// Default to AUTO for any other climate actuator
					role = ClimateRole.AUTO;
				}
			}

			defaultRoles.push({
				deviceId: target.deviceId,
				channelId: target.channelId,
				role,
				priority: i,
			});
		}

		this.logger.debug(`Inferred ${defaultRoles.length} default climate roles for space id=${spaceId}`);

		return defaultRoles;
	}

	/**
	 * Get role assignments for all climate targets in a space, indexed by target key.
	 * Key format: deviceId for actuators, deviceId:channelId for sensor channels.
	 */
	async getRoleMap(spaceId: string): Promise<Map<string, SpaceClimateRoleEntity>> {
		const roles = await this.findBySpace(spaceId);
		const map = new Map<string, SpaceClimateRoleEntity>();

		for (const role of roles) {
			const key = role.channelId ? `${role.deviceId}:${role.channelId}` : role.deviceId;
			map.set(key, role);
		}

		return map;
	}

	/**
	 * Build event payload for a climate target with all required fields
	 */
	private async buildClimateTargetEventPayload(
		spaceId: string,
		deviceId: string,
		channelId: string | null,
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

		// For sensors, get capabilities from the specific channel
		// For actuators, aggregate from all channels
		let hasTemperature = false;
		let hasHumidity = false;
		let hasMode = false;
		let channelName: string | null = null;
		let channelCategory: ChannelCategory | null = null;

		if (channelId) {
			// Sensor - get capabilities from specific channel
			const channel = device.channels?.find((c) => c.id === channelId);
			if (channel) {
				channelName = channel.name ?? null;
				channelCategory = channel.category;
				const properties = channel.properties ?? [];
				hasTemperature = properties.some((p) => p.category === PropertyCategory.TEMPERATURE);
				hasHumidity = properties.some((p) => p.category === PropertyCategory.HUMIDITY);
			}
		} else {
			// Actuator - aggregate from all channels
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
		}

		// Use deviceId:channelId as id for sensors, deviceId for actuators
		const id = channelId ? `${deviceId}:${channelId}` : deviceId;

		return {
			id,
			space_id: spaceId,
			device_id: deviceId,
			device_name: device.name,
			device_category: device.category,
			channel_id: channelId,
			channel_name: channelName,
			channel_category: channelCategory,
			role,
			priority,
			has_temperature: hasTemperature,
			has_humidity: hasHumidity,
			has_mode: hasMode,
		};
	}
}

import { Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger';
import { DeviceCategory, PropertyCategory } from '../../devices/devices.constants';
import { ChannelEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { SetClimateRoleDto } from '../dto/climate-role.dto';
import { SpaceClimateRoleEntity } from '../entities/space-climate-role.entity';
import { CLIMATE_SENSOR_ROLES, ClimateRole, EventType, SPACES_MODULE_NAME } from '../spaces.constants';
import { SpacesValidationException } from '../spaces.exceptions';

import { SpacesService } from './spaces.service';

/**
 * Climate device categories for filtering (actuators)
 */
const CLIMATE_ACTUATOR_CATEGORIES = [
	DeviceCategory.THERMOSTAT,
	DeviceCategory.HEATER,
	DeviceCategory.AIR_CONDITIONER,
	DeviceCategory.FAN,
	DeviceCategory.AIR_HUMIDIFIER,
	DeviceCategory.AIR_DEHUMIDIFIER,
	DeviceCategory.AIR_PURIFIER,
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
	async findOne(
		spaceId: string,
		deviceId: string,
		channelId?: string | null,
	): Promise<SpaceClimateRoleEntity | null> {
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
		const channelId = dto.channelId ?? null;

		// Validate channelId requirements
		if (isSensorRole && !channelId) {
			throw new SpacesValidationException(
				`Sensor roles (${dto.role}) require a channel_id to be specified`,
			);
		}
		if (!isSensorRole && channelId) {
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

		if (device.roomId !== spaceId) {
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
				throw new SpacesValidationException(
					`Channel with id=${channelId} not found on device ${dto.deviceId}`,
				);
			}

			// Verify channel has the required property for the sensor role
			const properties = channel.properties ?? [];
			if (dto.role === ClimateRole.TEMPERATURE_SENSOR) {
				if (!properties.some((p) => p.category === PropertyCategory.TEMPERATURE)) {
					throw new SpacesValidationException(
						`Channel ${channelId} does not have a temperature property`,
					);
				}
			} else if (dto.role === ClimateRole.HUMIDITY_SENSOR) {
				if (!properties.some((p) => p.category === PropertyCategory.HUMIDITY)) {
					throw new SpacesValidationException(`Channel ${channelId} does not have a humidity property`);
				}
			}
		}

		let roleEntity: SpaceClimateRoleEntity | null = null;
		let isUpdate = false;
		let hasChanges = false;

		const newRole = dto.role;
		const newPriority = dto.priority ?? 0;

		// Use a transaction to atomically check existence and upsert
		await this.repository.manager.transaction(async (transactionalManager) => {
			// If setting PRIMARY role, check no other device has PRIMARY in this space
			if (dto.role === ClimateRole.PRIMARY) {
				const existingPrimary = await transactionalManager.findOne(SpaceClimateRoleEntity, {
					where: { spaceId, role: ClimateRole.PRIMARY },
				});
				// Allow if updating the same device/channel, otherwise reject
				if (
					existingPrimary &&
					(existingPrimary.deviceId !== dto.deviceId || existingPrimary.channelId !== channelId)
				) {
					throw new SpacesValidationException(
						`Space already has a PRIMARY climate device (device_id=${existingPrimary.deviceId}). Only one PRIMARY device is allowed per space.`,
					);
				}
			}

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

			// Upsert within the same transaction to maintain atomicity
			await transactionalManager.upsert(
				SpaceClimateRoleEntity,
				{
					spaceId,
					deviceId: dto.deviceId,
					channelId,
					role: newRole,
					priority: newPriority,
				},
				{
					conflictPaths: ['spaceId', 'deviceId', 'channelId'],
					skipUpdateIfNoValuesChanged: true,
				},
			);

			// Fetch the saved entity within the transaction
			roleEntity = await transactionalManager.findOne(SpaceClimateRoleEntity, {
				where: { spaceId, deviceId: dto.deviceId, channelId },
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
				// For sensors, create a target for each channel with temperature or humidity properties
				for (const channel of device.channels ?? []) {
					const properties = channel.properties ?? [];
					const hasTemperature = properties.some((p) => p.category === PropertyCategory.TEMPERATURE);
					const hasHumidity = properties.some((p) => p.category === PropertyCategory.HUMIDITY);

					// Only include channels that have temperature or humidity properties
					if (!hasTemperature && !hasHumidity) {
						continue;
					}

					const key = `${device.id}:${channel.id}`;
					const existingRole = roleMap.get(key);

					climateTargets.push({
						deviceId: device.id,
						deviceName: device.name,
						deviceCategory: device.category,
						channelId: channel.id,
						channelName: channel.name ?? null,
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
	 * - First thermostat becomes PRIMARY (only one allowed)
	 * - Other thermostats, heaters, AC become AUXILIARY
	 * - Fans become VENTILATION
	 * - Humidifiers/Dehumidifiers become HUMIDITY_CONTROL
	 * - Air purifiers and others become OTHER
	 *
	 * Read roles (sensors):
	 * - Temperature sensor channels become TEMPERATURE_SENSOR
	 * - Humidity sensor channels become HUMIDITY_SENSOR
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

			if (target.deviceCategory === DeviceCategory.SENSOR) {
				// Sensors get sensor roles based on their capabilities
				// Prefer temperature sensor, fall back to humidity sensor
				if (target.hasTemperature) {
					role = ClimateRole.TEMPERATURE_SENSOR;
				} else if (target.hasHumidity) {
					role = ClimateRole.HUMIDITY_SENSOR;
				} else {
					continue; // Skip sensors without relevant properties
				}
			} else {
				// Actuators get control roles based on device category
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
					target.deviceCategory === DeviceCategory.AIR_DEHUMIDIFIER
				) {
					role = ClimateRole.HUMIDITY_CONTROL;
				} else {
					role = ClimateRole.OTHER;
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

		if (channelId) {
			// Sensor - get capabilities from specific channel
			const channel = device.channels?.find((c) => c.id === channelId);
			if (channel) {
				channelName = channel.name ?? null;
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
			role,
			priority,
			has_temperature: hasTemperature,
			has_humidity: hasHumidity,
			has_mode: hasMode,
		};
	}
}

/**
 * Scenario Executor Service
 *
 * Executes scenario configurations to create rooms, devices, and scenes.
 */
import { v4 as uuidv4 } from 'uuid';

import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import {
	ChannelCategory,
	ConnectionState,
	DeviceCategory,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { CreateDeviceChannelPropertyDto } from '../../../modules/devices/dto/create-device-channel-property.dto';
import { CreateDeviceChannelDto } from '../../../modules/devices/dto/create-device-channel.dto';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import {
	getPropertyDefaultValue,
	getPropertyMetadata,
	getRequiredChannels,
	getRequiredProperties,
} from '../../../modules/devices/utils/schema.utils';
import { ScenesService } from '../../../modules/scenes/services/scenes.service';
import { SetLightingRoleDto } from '../../../modules/spaces/dto/lighting-role.dto';
import { SpaceClimateRoleService } from '../../../modules/spaces/services/space-climate-role.service';
import { SpaceCoversRoleService } from '../../../modules/spaces/services/space-covers-role.service';
import { SpaceLightingRoleService } from '../../../modules/spaces/services/space-lighting-role.service';
import { SpaceMediaActivityBindingService } from '../../../modules/spaces/services/space-media-activity-binding.service';
import { SpaceSensorRoleService } from '../../../modules/spaces/services/space-sensor-role.service';
import { SpacesService } from '../../../modules/spaces/services/spaces.service';
import {
	ClimateRole,
	CoversRole,
	LightingRole,
	SensorRole,
	SpaceRoomCategory,
	SpaceType,
	SpaceZoneCategory,
} from '../../../modules/spaces/spaces.constants';
import { SCENES_LOCAL_TYPE } from '../../scenes-local/scenes-local.constants';
import { SimulatorDeviceEntity } from '../entities/simulator.entity';
import {
	ScenarioChannelDefinition,
	ScenarioConfig,
	ScenarioDeviceDefinition,
	ScenarioExecutionOptions,
	ScenarioExecutionResult,
	ScenarioPropertyDefinition,
	ScenarioSceneDefinition,
} from '../scenarios/scenario.types';
import { SIMULATOR_PLUGIN_NAME, SIMULATOR_TYPE } from '../simulator.constants';

import { ScenarioLoaderService } from './scenario-loader.service';

@Injectable()
export class ScenarioExecutorService {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(SIMULATOR_PLUGIN_NAME, 'ScenarioExecutor');

	constructor(
		private readonly scenarioLoader: ScenarioLoaderService,
		private readonly devicesService: DevicesService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly deviceConnectivityService: DeviceConnectivityService,
		private readonly spacesService: SpacesService,
		private readonly scenesService: ScenesService,
		private readonly spaceLightingRoleService: SpaceLightingRoleService,
		private readonly spaceClimateRoleService: SpaceClimateRoleService,
		private readonly spaceSensorRoleService: SpaceSensorRoleService,
		private readonly spaceCoversRoleService: SpaceCoversRoleService,
		private readonly spaceMediaActivityBindingService: SpaceMediaActivityBindingService,
	) {}

	/**
	 * Execute a scenario by name
	 */
	async executeByName(scenarioName: string, options: ScenarioExecutionOptions = {}): Promise<ScenarioExecutionResult> {
		const loadResult = this.scenarioLoader.loadScenarioByName(scenarioName);

		if (!loadResult.success || !loadResult.config) {
			return {
				success: false,
				devicesCreated: 0,
				roomsCreated: 0,
				scenesCreated: 0,
				rolesApplied: 0,
				deviceIds: [],
				roomIds: [],
				sceneIds: [],
				errors: loadResult.errors ?? ['Failed to load scenario'],
			};
		}

		return this.execute(loadResult.config, options);
	}

	/**
	 * Execute a scenario from file path
	 */
	async executeFromFile(filePath: string, options: ScenarioExecutionOptions = {}): Promise<ScenarioExecutionResult> {
		const loadResult = this.scenarioLoader.loadScenarioFile(filePath);

		if (!loadResult.success || !loadResult.config) {
			return {
				success: false,
				devicesCreated: 0,
				roomsCreated: 0,
				scenesCreated: 0,
				rolesApplied: 0,
				deviceIds: [],
				roomIds: [],
				sceneIds: [],
				errors: loadResult.errors ?? ['Failed to load scenario'],
			};
		}

		return this.execute(loadResult.config, options);
	}

	/**
	 * Execute a scenario configuration
	 */
	async execute(config: ScenarioConfig, options: ScenarioExecutionOptions = {}): Promise<ScenarioExecutionResult> {
		const errors: string[] = [];
		const deviceIds: string[] = [];
		const roomIds: string[] = [];
		const sceneIds: string[] = [];
		const roomIdMap = new Map<string, string>(); // scenario room id -> database room id
		const zoneIds = new Set<string>(); // scenario room ids that are zones
		const deviceRoles = new Map<string, ScenarioDeviceDefinition>(); // deviceId -> YAML def with role declarations

		this.logger.log(`Executing scenario: ${config.name}`);

		// Create rooms if enabled
		if (options.createRooms !== false && config.rooms && config.rooms.length > 0) {
			for (const roomDef of config.rooms) {
				if (options.dryRun) {
					this.logger.log(`[DRY RUN] Would create room: ${roomDef.name}`);
					continue;
				}

				try {
					const spaceType = roomDef.type === 'zone' ? SpaceType.ZONE : SpaceType.ROOM;

					const room = await this.spacesService.create({
						name: roomDef.name,
						type: spaceType,
						...(roomDef.category ? { category: roomDef.category as SpaceRoomCategory | SpaceZoneCategory } : {}),
					});

					roomIdMap.set(roomDef.id, room.id);

					if (roomDef.type === 'zone') {
						zoneIds.add(roomDef.id);
					}
					roomIds.push(room.id);

					this.logger.log(`Created ${roomDef.type ?? 'room'}: ${roomDef.name} (${room.id})`);
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error);
					errors.push(`Failed to create room '${roomDef.name}': ${message}`);
					this.logger.error(`Failed to create room: ${roomDef.name}`, { error: message });
				}
			}
		}

		// Create devices
		for (const deviceDef of config.devices) {
			if (options.dryRun) {
				this.logger.log(`[DRY RUN] Would create device: ${deviceDef.name} (${deviceDef.category})`);
				continue;
			}

			try {
				// Check if device already exists (upsert = skip-if-exists)
				if (deviceDef.id) {
					const existing = await this.devicesService.findOne(deviceDef.id);

					if (existing) {
						this.logger.log(`Device already exists, skipping: ${deviceDef.name} (${deviceDef.id})`);
						continue;
					}
				}

				// Resolve space assignment - rooms use room_id, zones use zone_ids
				let roomId: string | null = null;
				let deviceZoneIds: string[] = [];
				if (deviceDef.room) {
					const resolvedId = roomIdMap.get(deviceDef.room) ?? null;
					if (resolvedId && zoneIds.has(deviceDef.room)) {
						deviceZoneIds = [resolvedId];
					} else {
						roomId = resolvedId;
					}
				}

				const device = await this.createDevice(deviceDef, roomId, deviceZoneIds);
				deviceIds.push(device.id);

				if (deviceDef.lighting_role || deviceDef.climate_role || deviceDef.sensor_role || deviceDef.covers_role) {
					deviceRoles.set(device.id, deviceDef);
				}

				this.logger.log(`Created device: ${deviceDef.name} (${device.id})`);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				errors.push(`Failed to create device '${deviceDef.name}': ${message}`);
				this.logger.error(`Failed to create device: ${deviceDef.name}`, { error: message });
			}
		}

		// Create scenes if enabled
		if (options.createScenes !== false && config.scenes && config.scenes.length > 0) {
			for (const sceneDef of config.scenes) {
				if (options.dryRun) {
					this.logger.log(`[DRY RUN] Would create scene: ${sceneDef.name}`);
					continue;
				}

				try {
					const sceneId = await this.createScene(sceneDef, roomIdMap);

					if (sceneId) {
						sceneIds.push(sceneId);
						this.logger.log(`Created scene: ${sceneDef.name} (${sceneId})`);
					}
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error);
					errors.push(`Failed to create scene '${sceneDef.name}': ${message}`);
					this.logger.error(`Failed to create scene: ${sceneDef.name}`, { error: message });
				}
			}
		}

		// Apply default domain roles and media bindings for each room
		let rolesApplied = 0;

		if (options.applyRoles !== false && roomIds.length > 0 && !options.dryRun) {
			for (const roomId of roomIds) {
				try {
					await this.applyDomainDefaults(roomId, deviceRoles);
					rolesApplied++;
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error);
					errors.push(`Failed to apply domain defaults for room '${roomId}': ${message}`);
					this.logger.error(`Failed to apply domain defaults for room: ${roomId}`, { error: message });
				}
			}

			if (rolesApplied > 0) {
				this.logger.log(`Applied domain roles and media bindings for ${rolesApplied} rooms`);
			}
		}

		const success = errors.length === 0;

		if (options.dryRun) {
			this.logger.log(`[DRY RUN] Scenario '${config.name}' preview complete`);
		} else {
			this.logger.log(`Scenario '${config.name}' execution ${success ? 'completed' : 'completed with errors'}`);
		}

		return {
			success,
			devicesCreated: deviceIds.length,
			roomsCreated: roomIds.length,
			scenesCreated: sceneIds.length,
			rolesApplied,
			deviceIds,
			roomIds,
			sceneIds,
			errors,
		};
	}

	/**
	 * Create a scene from scenario definition
	 */
	private async createScene(sceneDef: ScenarioSceneDefinition, roomIdMap: Map<string, string>): Promise<string | null> {
		// Check if scene already exists (upsert = skip-if-exists)
		if (sceneDef.id) {
			const existing = await this.scenesService.findOne(sceneDef.id);

			if (existing) {
				this.logger.log(`Scene already exists, skipping: ${sceneDef.name} (${sceneDef.id})`);
				return null;
			}
		}

		// Resolve room reference to space ID
		let primarySpaceId: string | null = null;
		if (sceneDef.room) {
			primarySpaceId = roomIdMap.get(sceneDef.room) ?? null;
		}

		// Build actions — resolve channel_id (and device_id) from property relations if not provided
		const actions = await Promise.all(
			sceneDef.actions.map(async (actionDef) => {
				let deviceId = actionDef.device_id;
				let channelId = actionDef.channel_id;

				// Resolve channel_id (and optionally device_id) from property relations
				if (!channelId || !deviceId) {
					const property = await this.channelsPropertiesService.findOne(actionDef.property_id);

					if (property) {
						const channel = property.channel;

						if (channel && typeof channel !== 'string') {
							channelId = channelId ?? channel.id;

							if (!deviceId) {
								const device = channel.device;

								if (device && typeof device !== 'string') {
									deviceId = device.id;
								}
							}
						}
					}

					if (!channelId) {
						this.logger.warn(
							`Could not resolve channel_id for property ${actionDef.property_id} in scene "${sceneDef.name}"`,
						);
					}
				}

				return {
					type: SCENES_LOCAL_TYPE,
					device_id: deviceId,
					...(channelId ? { channel_id: channelId } : {}),
					property_id: actionDef.property_id,
					value: actionDef.value,
				};
			}),
		);

		// Resolve category
		const category = sceneDef.category
			? (this.scenarioLoader.resolveSceneCategory(sceneDef.category) ?? undefined)
			: undefined;

		const scene = await this.scenesService.create({
			id: sceneDef.id ?? uuidv4(),
			name: sceneDef.name,
			...(sceneDef.description ? { description: sceneDef.description } : {}),
			...(category ? { category } : {}),
			...(primarySpaceId ? { primary_space_id: primarySpaceId } : {}),
			...(sceneDef.enabled !== undefined ? { enabled: sceneDef.enabled } : {}),
			actions,
		});

		return scene.id;
	}

	/**
	 * Apply domain roles and media activity bindings for a room.
	 * Uses YAML-declared roles when available, falls back to service defaults.
	 */
	private async applyDomainDefaults(
		spaceId: string,
		deviceRoles: Map<string, ScenarioDeviceDefinition>,
	): Promise<void> {
		// Lighting roles — use YAML declarations, fall back to service defaults
		const lightTargets = await this.spaceLightingRoleService.getLightTargetsInSpace(spaceId);

		if (lightTargets.length > 0) {
			const hasYamlLightingRoles = lightTargets.some((t) => deviceRoles.get(t.deviceId)?.lighting_role);

			let lightingRoles: SetLightingRoleDto[];

			if (hasYamlLightingRoles) {
				lightingRoles = lightTargets.map((target, i) => {
					const declared = deviceRoles.get(target.deviceId)?.lighting_role;

					return {
						deviceId: target.deviceId,
						channelId: target.channelId,
						role: (declared as LightingRole) ?? LightingRole.MAIN,
						priority: i,
					};
				});
			} else {
				lightingRoles = await this.spaceLightingRoleService.inferDefaultLightingRoles(spaceId);
			}

			if (lightingRoles.length > 0) {
				await this.spaceLightingRoleService.bulkSetRoles(spaceId, lightingRoles);
				this.logger.log(`Applied ${lightingRoles.length} lighting roles for space ${spaceId}`);
			}
		}

		// Climate roles — use YAML overrides or service defaults
		const climateRoles = await this.spaceClimateRoleService.inferDefaultClimateRoles(spaceId);

		for (const role of climateRoles) {
			const declared = deviceRoles.get(role.deviceId)?.climate_role;

			if (declared) {
				role.role = declared as ClimateRole;
			}
		}

		if (climateRoles.length > 0) {
			await this.spaceClimateRoleService.bulkSetRoles(spaceId, climateRoles);
			this.logger.log(`Applied ${climateRoles.length} climate roles for space ${spaceId}`);
		}

		// Sensor roles — use YAML overrides or service defaults
		const sensorRoles = await this.spaceSensorRoleService.inferDefaultSensorRoles(spaceId);

		for (const role of sensorRoles) {
			const declared = deviceRoles.get(role.deviceId)?.sensor_role;

			if (declared) {
				role.role = declared as SensorRole;
			}
		}

		if (sensorRoles.length > 0) {
			await this.spaceSensorRoleService.bulkSetRoles(spaceId, sensorRoles);
			this.logger.log(`Applied ${sensorRoles.length} sensor roles for space ${spaceId}`);
		}

		// Covers roles — use YAML overrides or service defaults
		const coversRoles = await this.spaceCoversRoleService.inferDefaultCoversRoles(spaceId);

		for (const role of coversRoles) {
			const declared = deviceRoles.get(role.deviceId)?.covers_role;

			if (declared) {
				role.role = declared as CoversRole;
			}
		}

		if (coversRoles.length > 0) {
			await this.spaceCoversRoleService.bulkSetRoles(spaceId, coversRoles);
			this.logger.log(`Applied ${coversRoles.length} covers roles for space ${spaceId}`);
		}

		// Media activity bindings
		const mediaBindings = await this.spaceMediaActivityBindingService.applyDefaults(spaceId);

		if (mediaBindings.length > 0) {
			this.logger.log(`Applied ${mediaBindings.length} media activity bindings for space ${spaceId}`);
		}
	}

	/**
	 * Create a device from scenario definition
	 */
	private async createDevice(
		deviceDef: ScenarioDeviceDefinition,
		roomId: string | null,
		zoneIds: string[] = [],
	): Promise<SimulatorDeviceEntity> {
		const deviceCategory = this.scenarioLoader.resolveDeviceCategory(deviceDef.category);

		if (!deviceCategory) {
			throw new Error(`Invalid device category: ${deviceDef.category}`);
		}

		// Build channels - merge scenario definition with required channels from spec
		const channels = this.buildChannels(deviceDef.channels, deviceCategory);

		// Create device
		const deviceData = {
			id: deviceDef.id ?? uuidv4(),
			type: SIMULATOR_TYPE,
			category: deviceCategory,
			name: deviceDef.name,
			description: deviceDef.description ?? null,
			room_id: roomId,
			...(zoneIds.length > 0 ? { zone_ids: zoneIds } : {}),
			auto_simulate: deviceDef.auto_simulate ?? false,
			simulate_interval: deviceDef.simulate_interval ?? 5000,
			behavior_mode: deviceDef.behavior_mode ?? 'default',
			channels,
		};

		const device = await this.devicesService.create<SimulatorDeviceEntity, any>(deviceData);

		// Set initial connection state
		await this.deviceConnectivityService.setConnectionState(device.id, {
			state: ConnectionState.CONNECTED,
			reason: 'Simulator device created via scenario',
		});

		return device;
	}

	/**
	 * Build channel DTOs from scenario definitions, merging with required channels from spec
	 */
	private buildChannels(
		channelDefs: ScenarioChannelDefinition[],
		deviceCategory: DeviceCategory,
	): CreateDeviceChannelDto[] {
		// Get required channels from spec
		const requiredChannelCategories = getRequiredChannels(deviceCategory);

		// Track which channels are defined in the scenario
		const definedChannelCategories = new Set<ChannelCategory>();

		// Build channels from scenario definition
		const channels = channelDefs.map((channelDef) => {
			const channelCategory = this.scenarioLoader.resolveChannelCategory(channelDef.category);

			if (!channelCategory) {
				throw new Error(`Invalid channel category: ${channelDef.category}`);
			}

			definedChannelCategories.add(channelCategory);

			// Build properties - merge scenario definition with required properties from spec
			const properties = this.buildProperties(channelDef.properties, channelCategory);

			return {
				id: channelDef.id ?? uuidv4(),
				type: SIMULATOR_TYPE,
				category: channelCategory,
				name: channelDef.name ?? this.formatName(channelDef.category),
				properties,
			};
		});

		// Add any missing required channels with their required properties
		for (const requiredCategory of requiredChannelCategories) {
			if (!definedChannelCategories.has(requiredCategory)) {
				// Create channel with only required properties (using default values)
				const properties = this.buildRequiredPropertiesForChannel(requiredCategory);

				channels.push({
					id: uuidv4(),
					type: SIMULATOR_TYPE,
					category: requiredCategory,
					name: this.formatName(requiredCategory),
					properties,
				});

				this.logger.debug(
					`Added missing required channel '${requiredCategory}' for device category '${deviceCategory}'`,
				);
			}
		}

		return channels;
	}

	/**
	 * Build property DTOs from scenario definitions, merging with required properties from spec
	 */
	private buildProperties(
		propertyDefs: ScenarioPropertyDefinition[],
		channelCategory: ChannelCategory,
	): CreateDeviceChannelPropertyDto[] {
		// Get required properties from spec
		const requiredPropertyCategories = getRequiredProperties(channelCategory);

		// Track which properties are defined in the scenario
		const definedPropertyCategories = new Set<PropertyCategory>();

		// Build properties from scenario definition
		const properties = propertyDefs.map((propertyDef) => {
			const propertyCategory = this.scenarioLoader.resolvePropertyCategory(propertyDef.category);

			if (!propertyCategory) {
				throw new Error(`Invalid property category: ${propertyDef.category}`);
			}

			definedPropertyCategories.add(propertyCategory);

			// Get property metadata from schema
			const metadata = getPropertyMetadata(channelCategory, propertyCategory);

			if (!metadata) {
				throw new Error(`Property '${propertyDef.category}' is not defined for channel '${channelCategory}'`);
			}

			// Determine value - use provided value or generate default
			let value = propertyDef.value;
			if (value === undefined) {
				value = this.getDefaultValue(metadata.data_type, metadata.format);
			}

			return {
				id: propertyDef.id ?? uuidv4(),
				type: SIMULATOR_TYPE,
				category: propertyCategory,
				name: this.formatName(propertyDef.category),
				permissions: metadata.permissions,
				data_type: metadata.data_type,
				format: metadata.format,
				invalid: metadata.invalid as string | number | boolean | undefined,
				step: metadata.step,
				value,
			};
		});

		// Add any missing required properties with default values
		for (const requiredCategory of requiredPropertyCategories) {
			if (!definedPropertyCategories.has(requiredCategory)) {
				const metadata = getPropertyMetadata(channelCategory, requiredCategory);

				if (metadata) {
					// Get default value from schema utils
					const defaultValue = getPropertyDefaultValue(channelCategory, requiredCategory);

					properties.push({
						id: uuidv4(),
						type: SIMULATOR_TYPE,
						category: requiredCategory,
						name: this.formatName(requiredCategory),
						permissions: metadata.permissions,
						data_type: metadata.data_type,
						format: metadata.format,
						invalid: metadata.invalid as string | number | boolean | undefined,
						step: metadata.step,
						value: defaultValue,
					});

					this.logger.debug(`Added missing required property '${requiredCategory}' for channel '${channelCategory}'`);
				}
			}
		}

		return properties;
	}

	/**
	 * Build required properties for a channel (used when adding missing required channels)
	 */
	private buildRequiredPropertiesForChannel(channelCategory: ChannelCategory): CreateDeviceChannelPropertyDto[] {
		const requiredPropertyCategories = getRequiredProperties(channelCategory);
		const properties: CreateDeviceChannelPropertyDto[] = [];

		for (const propertyCategory of requiredPropertyCategories) {
			const metadata = getPropertyMetadata(channelCategory, propertyCategory);

			if (metadata) {
				const defaultValue = getPropertyDefaultValue(channelCategory, propertyCategory);

				properties.push({
					id: uuidv4(),
					type: SIMULATOR_TYPE,
					category: propertyCategory,
					name: this.formatName(propertyCategory),
					permissions: metadata.permissions,
					data_type: metadata.data_type,
					format: metadata.format,
					invalid: metadata.invalid as string | number | boolean | undefined,
					step: metadata.step,
					value: defaultValue,
				});
			}
		}

		return properties;
	}

	/**
	 * Get a default value for a property based on its data type
	 */
	private getDefaultValue(dataType: string, format: string[] | number[] | null): string | number | boolean | null {
		switch (dataType) {
			case 'bool':
				return false;
			case 'enum':
				if (Array.isArray(format) && format.length > 0) {
					return format[0] as string;
				}
				return null;
			case 'string':
				return '';
			case 'uchar':
			case 'ushort':
			case 'uint':
			case 'char':
			case 'short':
			case 'int':
			case 'float':
				if (Array.isArray(format) && format.length === 2) {
					return format[0] as number;
				}
				return 0;
			default:
				return null;
		}
	}

	/**
	 * Format a category string to a human-readable name
	 */
	private formatName(category: string): string {
		return category
			.split('_')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
			.join(' ');
	}

	/**
	 * Get preview of what would be created (dry run)
	 * Calculates actual counts including auto-added required channels/properties
	 */
	preview(config: ScenarioConfig): {
		rooms: { name: string; type: 'room' | 'zone' }[];
		devices: { name: string; category: string; channelCount: number; propertyCount: number }[];
		scenes: { name: string; category: string; actionCount: number }[];
	} {
		const rooms = config.rooms?.map((r) => ({ name: r.name, type: r.type ?? 'room' })) ?? [];

		const devices = config.devices.map((d) => {
			const deviceCategory = this.scenarioLoader.resolveDeviceCategory(d.category);
			if (!deviceCategory) {
				// Invalid category - return YAML counts (will fail during execution)
				const propertyCount = d.channels.reduce((sum, ch) => sum + ch.properties.length, 0);
				return {
					name: d.name,
					category: d.category,
					channelCount: d.channels.length,
					propertyCount,
				};
			}

			// Calculate actual channel count including required channels
			const requiredChannelCategories = getRequiredChannels(deviceCategory);
			const definedChannelCategories = new Set<ChannelCategory>();
			d.channels.forEach((ch) => {
				const cat = this.scenarioLoader.resolveChannelCategory(ch.category);
				if (cat) definedChannelCategories.add(cat);
			});
			const missingChannelCount = requiredChannelCategories.filter((c) => !definedChannelCategories.has(c)).length;
			const actualChannelCount = d.channels.length + missingChannelCount;

			// Calculate actual property count including required properties
			let actualPropertyCount = 0;
			for (const ch of d.channels) {
				const channelCategory = this.scenarioLoader.resolveChannelCategory(ch.category);
				if (!channelCategory) {
					actualPropertyCount += ch.properties.length;
					continue;
				}

				const requiredPropertyCategories = getRequiredProperties(channelCategory);
				const definedPropertyCategories = new Set<PropertyCategory>();
				ch.properties.forEach((p) => {
					const cat = this.scenarioLoader.resolvePropertyCategory(p.category);
					if (cat) definedPropertyCategories.add(cat);
				});
				const missingPropertyCount = requiredPropertyCategories.filter((p) => !definedPropertyCategories.has(p)).length;
				actualPropertyCount += ch.properties.length + missingPropertyCount;
			}

			// Add properties for missing required channels
			for (const requiredChannelCat of requiredChannelCategories) {
				if (!definedChannelCategories.has(requiredChannelCat)) {
					actualPropertyCount += getRequiredProperties(requiredChannelCat).length;
				}
			}

			return {
				name: d.name,
				category: d.category,
				channelCount: actualChannelCount,
				propertyCount: actualPropertyCount,
			};
		});

		const scenes =
			config.scenes?.map((s) => ({
				name: s.name,
				category: s.category ?? 'generic',
				actionCount: s.actions.length,
			})) ?? [];

		return { rooms, devices, scenes };
	}
}

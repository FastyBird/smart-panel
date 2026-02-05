/**
 * Scenario Executor Service
 *
 * Executes scenario configurations to create rooms and devices.
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
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import {
	getPropertyDefaultValue,
	getPropertyMetadata,
	getRequiredChannels,
	getRequiredProperties,
} from '../../../modules/devices/utils/schema.utils';
import { SpacesService } from '../../../modules/spaces/services/spaces.service';
import { SpaceType } from '../../../modules/spaces/spaces.constants';
import { DEVICES_SIMULATOR_PLUGIN_NAME, DEVICES_SIMULATOR_TYPE } from '../devices-simulator.constants';
import { SimulatorDeviceEntity } from '../entities/devices-simulator.entity';
import {
	ScenarioChannelDefinition,
	ScenarioConfig,
	ScenarioDeviceDefinition,
	ScenarioExecutionOptions,
	ScenarioExecutionResult,
	ScenarioPropertyDefinition,
} from '../scenarios/scenario.types';

import { ScenarioLoaderService } from './scenario-loader.service';

@Injectable()
export class ScenarioExecutorService {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_SIMULATOR_PLUGIN_NAME,
		'ScenarioExecutor',
	);

	constructor(
		private readonly scenarioLoader: ScenarioLoaderService,
		private readonly devicesService: DevicesService,
		private readonly deviceConnectivityService: DeviceConnectivityService,
		private readonly spacesService: SpacesService,
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
				deviceIds: [],
				roomIds: [],
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
				deviceIds: [],
				roomIds: [],
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
		const roomIdMap = new Map<string, string>(); // scenario room id -> database room id

		this.logger.log(`Executing scenario: ${config.name}`);

		// Create rooms if enabled
		if (options.createRooms !== false && config.rooms && config.rooms.length > 0) {
			for (const roomDef of config.rooms) {
				if (options.dryRun) {
					this.logger.log(`[DRY RUN] Would create room: ${roomDef.name}`);
					continue;
				}

				try {
					const room = await this.spacesService.create({
						name: roomDef.name,
						type: SpaceType.ROOM,
					});

					roomIdMap.set(roomDef.id, room.id);
					roomIds.push(room.id);

					this.logger.log(`Created room: ${roomDef.name} (${room.id})`);
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
				// Resolve room ID
				let roomId: string | null = null;
				if (deviceDef.room) {
					roomId = roomIdMap.get(deviceDef.room) ?? null;
				}

				const device = await this.createDevice(deviceDef, roomId);
				deviceIds.push(device.id);

				this.logger.log(`Created device: ${deviceDef.name} (${device.id})`);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				errors.push(`Failed to create device '${deviceDef.name}': ${message}`);
				this.logger.error(`Failed to create device: ${deviceDef.name}`, { error: message });
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
			deviceIds,
			roomIds,
			errors,
		};
	}

	/**
	 * Create a device from scenario definition
	 */
	private async createDevice(
		deviceDef: ScenarioDeviceDefinition,
		roomId: string | null,
	): Promise<SimulatorDeviceEntity> {
		const deviceCategory = this.scenarioLoader.resolveDeviceCategory(deviceDef.category);

		if (!deviceCategory) {
			throw new Error(`Invalid device category: ${deviceDef.category}`);
		}

		// Build channels - merge scenario definition with required channels from spec
		const channels = this.buildChannels(deviceDef.channels, deviceCategory);

		// Create device
		const deviceData = {
			id: uuidv4(),
			type: DEVICES_SIMULATOR_TYPE,
			category: deviceCategory,
			name: deviceDef.name,
			description: deviceDef.description ?? null,
			room_id: roomId,
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
				id: uuidv4(),
				type: DEVICES_SIMULATOR_TYPE,
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
					type: DEVICES_SIMULATOR_TYPE,
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
				id: uuidv4(),
				type: DEVICES_SIMULATOR_TYPE,
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
						type: DEVICES_SIMULATOR_TYPE,
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
					type: DEVICES_SIMULATOR_TYPE,
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
		rooms: { name: string }[];
		devices: { name: string; category: string; channelCount: number; propertyCount: number }[];
	} {
		const rooms = config.rooms?.map((r) => ({ name: r.name })) ?? [];

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

		return { rooms, devices };
	}
}

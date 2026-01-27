import { Repository } from 'typeorm';

import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger';
import { PropertyCategory } from '../../devices/devices.constants';
import { IDevicePropertyData } from '../../devices/platforms/device.platform';
import { PlatformRegistryService } from '../../devices/services/platform.registry.service';
import { CreateMediaRoutingDto, UpdateMediaRoutingDto } from '../dto/media-routing.dto';
import { SpaceMediaEndpointEntity } from '../entities/space-media-endpoint.entity';
import { SpaceMediaRoutingEntity } from '../entities/space-media-routing.entity';
import {
	MediaCapabilityMappingModel,
	MediaExecutionPlanModel,
	MediaExecutionStepModel,
	MediaExecutionStepResultModel,
	MediaRoutingActivationResultModel,
	MediaStateV2Model,
} from '../models/media-routing.model';
import {
	EventType,
	MEDIA_ROUTING_DEFAULTS,
	MediaPowerPolicy,
	MediaRoutingType,
	SPACES_MODULE_NAME,
} from '../spaces.constants';
import { SpacesValidationException } from '../spaces.exceptions';

import { SpaceMediaEndpointService } from './space-media-endpoint.service';
import { SpacesService } from './spaces.service';

/**
 * In-memory cache for active routing per space
 */
const activeRoutingCache = new Map<string, string>();

@Injectable()
export class SpaceMediaRoutingService {
	private readonly logger = createExtensionLogger(SPACES_MODULE_NAME, 'SpaceMediaRoutingService');

	constructor(
		@InjectRepository(SpaceMediaRoutingEntity)
		private readonly repository: Repository<SpaceMediaRoutingEntity>,
		@InjectRepository(SpaceMediaEndpointEntity)
		private readonly endpointRepository: Repository<SpaceMediaEndpointEntity>,
		private readonly spacesService: SpacesService,
		@Inject(forwardRef(() => SpaceMediaEndpointService))
		private readonly endpointService: SpaceMediaEndpointService,
		private readonly platformRegistryService: PlatformRegistryService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	/**
	 * Get all media routings for a space
	 */
	async findBySpace(spaceId: string): Promise<SpaceMediaRoutingEntity[]> {
		this.logger.debug(`Fetching media routings for space id=${spaceId}`);

		// Verify space exists
		await this.spacesService.getOneOrThrow(spaceId);

		const routings = await this.repository.find({
			where: { spaceId },
			order: { type: 'ASC' },
			relations: ['displayEndpoint', 'audioEndpoint', 'sourceEndpoint', 'remoteTargetEndpoint'],
		});

		this.logger.debug(`Found ${routings.length} media routings for space id=${spaceId}`);

		return routings;
	}

	/**
	 * Get a single media routing by ID
	 */
	async findOne(routingId: string): Promise<SpaceMediaRoutingEntity | null> {
		return this.repository.findOne({
			where: { id: routingId },
			relations: ['displayEndpoint', 'audioEndpoint', 'sourceEndpoint', 'remoteTargetEndpoint'],
		});
	}

	/**
	 * Get a single media routing or throw
	 */
	async getOneOrThrow(routingId: string): Promise<SpaceMediaRoutingEntity> {
		const routing = await this.findOne(routingId);

		if (!routing) {
			throw new SpacesValidationException(`Media routing with id=${routingId} not found`);
		}

		return routing;
	}

	/**
	 * Get routing by type for a space
	 */
	async findByType(spaceId: string, type: MediaRoutingType): Promise<SpaceMediaRoutingEntity | null> {
		return this.repository.findOne({
			where: { spaceId, type },
			relations: ['displayEndpoint', 'audioEndpoint', 'sourceEndpoint', 'remoteTargetEndpoint'],
		});
	}

	/**
	 * Create a new media routing
	 */
	async create(spaceId: string, dto: CreateMediaRoutingDto): Promise<SpaceMediaRoutingEntity> {
		// Verify space exists
		await this.spacesService.getOneOrThrow(spaceId);

		// Check for existing routing with same type
		const existing = await this.findByType(spaceId, dto.type);

		if (existing) {
			throw new SpacesValidationException(`Routing of type ${dto.type} already exists in space ${spaceId}`);
		}

		// Validate endpoint IDs if provided
		if (dto.displayEndpointId) {
			await this.validateEndpoint(dto.displayEndpointId, spaceId);
		}
		if (dto.audioEndpointId) {
			await this.validateEndpoint(dto.audioEndpointId, spaceId);
		}
		if (dto.sourceEndpointId) {
			await this.validateEndpoint(dto.sourceEndpointId, spaceId);
		}
		if (dto.remoteTargetEndpointId) {
			await this.validateEndpoint(dto.remoteTargetEndpointId, spaceId);
		}

		// Get defaults for this routing type
		const defaults = MEDIA_ROUTING_DEFAULTS[dto.type];

		// Create the routing
		const routing = this.repository.create({
			spaceId,
			type: dto.type,
			name: dto.name ?? defaults.name,
			icon: dto.icon ?? defaults.icon,
			displayEndpointId: dto.displayEndpointId ?? null,
			audioEndpointId: dto.audioEndpointId ?? null,
			sourceEndpointId: dto.sourceEndpointId ?? null,
			remoteTargetEndpointId: dto.remoteTargetEndpointId ?? null,
			displayInput: dto.displayInput ?? null,
			audioInput: dto.audioInput ?? null,
			audioVolumePreset: dto.audioVolumePreset ?? defaults.audioVolumePreset,
			powerPolicy: dto.powerPolicy ?? defaults.powerPolicy,
			isDefault: false,
		});

		const saved = await this.repository.save(routing);

		this.logger.debug(`Created media routing id=${saved.id} type=${dto.type} for space=${spaceId}`);

		return saved;
	}

	/**
	 * Update an existing media routing
	 */
	async update(routingId: string, dto: UpdateMediaRoutingDto): Promise<SpaceMediaRoutingEntity> {
		const routing = await this.getOneOrThrow(routingId);

		// Validate endpoint IDs if being updated
		if (dto.displayEndpointId !== undefined && dto.displayEndpointId !== null) {
			await this.validateEndpoint(dto.displayEndpointId, routing.spaceId);
		}
		if (dto.audioEndpointId !== undefined && dto.audioEndpointId !== null) {
			await this.validateEndpoint(dto.audioEndpointId, routing.spaceId);
		}
		if (dto.sourceEndpointId !== undefined && dto.sourceEndpointId !== null) {
			await this.validateEndpoint(dto.sourceEndpointId, routing.spaceId);
		}
		if (dto.remoteTargetEndpointId !== undefined && dto.remoteTargetEndpointId !== null) {
			await this.validateEndpoint(dto.remoteTargetEndpointId, routing.spaceId);
		}

		// Update fields
		if (dto.name !== undefined) {
			routing.name = dto.name;
		}
		if (dto.icon !== undefined) {
			routing.icon = dto.icon ?? null;
		}
		if (dto.displayEndpointId !== undefined) {
			routing.displayEndpointId = dto.displayEndpointId ?? null;
		}
		if (dto.audioEndpointId !== undefined) {
			routing.audioEndpointId = dto.audioEndpointId ?? null;
		}
		if (dto.sourceEndpointId !== undefined) {
			routing.sourceEndpointId = dto.sourceEndpointId ?? null;
		}
		if (dto.remoteTargetEndpointId !== undefined) {
			routing.remoteTargetEndpointId = dto.remoteTargetEndpointId ?? null;
		}
		if (dto.displayInput !== undefined) {
			routing.displayInput = dto.displayInput ?? null;
		}
		if (dto.audioInput !== undefined) {
			routing.audioInput = dto.audioInput ?? null;
		}
		if (dto.audioVolumePreset !== undefined) {
			routing.audioVolumePreset = dto.audioVolumePreset ?? null;
		}
		if (dto.powerPolicy !== undefined) {
			routing.powerPolicy = dto.powerPolicy;
		}
		if (dto.isDefault !== undefined) {
			routing.isDefault = dto.isDefault;
		}

		const saved = await this.repository.save(routing);

		this.logger.debug(`Updated media routing id=${routingId}`);

		return saved;
	}

	/**
	 * Delete a media routing
	 */
	async delete(routingId: string): Promise<void> {
		const routing = await this.findOne(routingId);

		if (routing) {
			// Clear active routing cache if this was active
			if (activeRoutingCache.get(routing.spaceId) === routingId) {
				activeRoutingCache.delete(routing.spaceId);
			}

			await this.repository.remove(routing);

			this.logger.debug(`Deleted media routing id=${routingId}`);
		}
	}

	/**
	 * Validate that an endpoint exists and belongs to the space
	 */
	private async validateEndpoint(endpointId: string, spaceId: string): Promise<void> {
		const endpoint = await this.endpointRepository.findOne({
			where: { id: endpointId },
		});

		if (!endpoint) {
			throw new SpacesValidationException(`Endpoint with id=${endpointId} not found`);
		}

		if (endpoint.spaceId !== spaceId) {
			throw new SpacesValidationException(`Endpoint with id=${endpointId} does not belong to space ${spaceId}`);
		}
	}

	/**
	 * Auto-create default routings for a space
	 */
	async autoCreateRoutings(spaceId: string): Promise<SpaceMediaRoutingEntity[]> {
		this.logger.debug(`Auto-creating default media routings for space id=${spaceId}`);

		const existingRoutings = await this.findBySpace(spaceId);
		const existingTypes = new Set(existingRoutings.map((r) => r.type));
		const created: SpaceMediaRoutingEntity[] = [];

		// Create default routings for types that don't exist
		const defaultTypes = [MediaRoutingType.WATCH, MediaRoutingType.LISTEN, MediaRoutingType.OFF];

		for (const type of defaultTypes) {
			if (!existingTypes.has(type)) {
				try {
					const defaults = MEDIA_ROUTING_DEFAULTS[type];
					const routing = this.repository.create({
						spaceId,
						type,
						name: defaults.name,
						icon: defaults.icon,
						powerPolicy: defaults.powerPolicy,
						audioVolumePreset: defaults.audioVolumePreset,
						isDefault: true,
					});

					const saved = await this.repository.save(routing);
					created.push(saved);
				} catch (error) {
					const err = error as Error;
					this.logger.warn(`Failed to auto-create routing type=${type}: ${err.message}`);
				}
			}
		}

		this.logger.debug(`Auto-created ${created.length} default routings for space id=${spaceId}`);

		return created;
	}

	/**
	 * Build an execution plan for activating a routing
	 */
	async buildExecutionPlan(routingId: string): Promise<MediaExecutionPlanModel> {
		const routing = await this.getOneOrThrow(routingId);
		const steps: MediaExecutionStepModel[] = [];
		let order = 0;

		// Get all endpoints involved in this routing
		const endpointIds = [
			routing.displayEndpointId,
			routing.audioEndpointId,
			routing.sourceEndpointId,
			routing.remoteTargetEndpointId,
		].filter((id): id is string => id !== null);

		// Fetch endpoints with their devices
		const endpoints = await this.endpointRepository.find({
			where: endpointIds.map((id) => ({ id })),
			relations: ['device', 'device.channels', 'device.channels.properties'],
		});

		// Build steps based on power policy and routing configuration
		for (const endpoint of endpoints) {
			const capabilities = endpoint.capabilities
				? (JSON.parse(endpoint.capabilities) as Record<string, MediaCapabilityMappingModel>)
				: null;

			if (!capabilities) {
				continue;
			}

			// Power control
			if (capabilities.power && routing.powerPolicy !== MediaPowerPolicy.UNCHANGED) {
				const powerValue = routing.powerPolicy === MediaPowerPolicy.ON;
				steps.push({
					order: order++,
					endpointId: endpoint.id,
					deviceId: endpoint.deviceId,
					channelId: capabilities.power.channelId ?? endpoint.channelId ?? '',
					propertyId: capabilities.power.propertyId,
					action: 'set_property',
					value: powerValue,
					critical: true,
					description: `${powerValue ? 'Power on' : 'Power off'} ${endpoint.name ?? 'device'}`,
				});
			}

			// Input switching for display
			if (endpoint.id === routing.displayEndpointId && routing.displayInput && capabilities.input) {
				steps.push({
					order: order++,
					endpointId: endpoint.id,
					deviceId: endpoint.deviceId,
					channelId: capabilities.input.channelId ?? endpoint.channelId ?? '',
					propertyId: capabilities.input.propertyId,
					action: 'set_property',
					value: routing.displayInput,
					critical: false,
					description: `Set display input to ${routing.displayInput}`,
				});
			}

			// Input switching for audio
			if (endpoint.id === routing.audioEndpointId && routing.audioInput && capabilities.input) {
				steps.push({
					order: order++,
					endpointId: endpoint.id,
					deviceId: endpoint.deviceId,
					channelId: capabilities.input.channelId ?? endpoint.channelId ?? '',
					propertyId: capabilities.input.propertyId,
					action: 'set_property',
					value: routing.audioInput,
					critical: false,
					description: `Set audio input to ${routing.audioInput}`,
				});
			}

			// Volume preset for audio endpoint
			if (endpoint.id === routing.audioEndpointId && routing.audioVolumePreset !== null && capabilities.volume) {
				steps.push({
					order: order++,
					endpointId: endpoint.id,
					deviceId: endpoint.deviceId,
					channelId: capabilities.volume.channelId ?? endpoint.channelId ?? '',
					propertyId: capabilities.volume.propertyId,
					action: 'set_property',
					value: routing.audioVolumePreset,
					critical: false,
					description: `Set volume to ${routing.audioVolumePreset}%`,
				});
			}
		}

		return {
			routingId: routing.id,
			spaceId: routing.spaceId,
			routingType: routing.type,
			steps,
			totalSteps: steps.length,
			criticalSteps: steps.filter((s) => s.critical).length,
		};
	}

	/**
	 * Execute a routing activation
	 */
	async activateRouting(routingId: string): Promise<MediaRoutingActivationResultModel> {
		const routing = await this.getOneOrThrow(routingId);
		const plan = await this.buildExecutionPlan(routingId);

		this.logger.debug(`Activating routing id=${routingId} type=${routing.type} steps=${plan.totalSteps}`);

		const stepResults: MediaExecutionStepResultModel[] = [];
		const offlineDeviceIds: string[] = [];
		let stepsExecuted = 0;
		let stepsFailed = 0;
		let stepsSkipped = 0;

		// Get unique devices involved
		const deviceIds = [...new Set(plan.steps.map((s) => s.deviceId))];
		const devices = await this.spacesService.findDevicesByIds(deviceIds);
		const deviceMap = new Map(devices.map((d) => [d.id, d]));

		// Execute each step
		for (const step of plan.steps) {
			const device = deviceMap.get(step.deviceId);

			if (!device) {
				stepsFailed++;
				stepResults.push({
					order: step.order,
					deviceId: step.deviceId,
					status: 'failed',
					error: 'Device not found',
				});
				continue;
			}

			// Check if device is online
			if (!device.status?.online) {
				stepsSkipped++;
				if (!offlineDeviceIds.includes(step.deviceId)) {
					offlineDeviceIds.push(step.deviceId);
				}
				stepResults.push({
					order: step.order,
					deviceId: step.deviceId,
					status: 'skipped',
					error: 'Device offline',
				});
				continue;
			}

			// Find the channel and property
			const channel = device.channels?.find((ch) => ch.id === step.channelId);
			const property = channel?.properties?.find((p) => p.id === step.propertyId);

			if (!channel || !property) {
				stepsFailed++;
				stepResults.push({
					order: step.order,
					deviceId: step.deviceId,
					status: 'failed',
					error: 'Channel or property not found',
				});
				continue;
			}

			// Execute the command
			const platform = this.platformRegistryService.get(device);

			if (!platform) {
				stepsFailed++;
				stepResults.push({
					order: step.order,
					deviceId: step.deviceId,
					status: 'failed',
					error: 'No platform for device',
				});
				continue;
			}

			try {
				const command: IDevicePropertyData = {
					device,
					channel,
					property,
					value: step.value as string | number | boolean,
				};

				const success = await platform.processBatch([command]);

				if (success) {
					stepsExecuted++;
					stepResults.push({
						order: step.order,
						deviceId: step.deviceId,
						status: 'success',
					});
				} else {
					stepsFailed++;
					stepResults.push({
						order: step.order,
						deviceId: step.deviceId,
						status: 'failed',
						error: 'Command execution failed',
					});

					// If critical step failed, abort
					if (step.critical) {
						this.logger.warn(`Critical step failed, aborting routing activation`);
						break;
					}
				}
			} catch (error) {
				const err = error as Error;
				stepsFailed++;
				stepResults.push({
					order: step.order,
					deviceId: step.deviceId,
					status: 'failed',
					error: err.message,
				});

				if (step.critical) {
					this.logger.warn(`Critical step threw error, aborting: ${err.message}`);
					break;
				}
			}
		}

		// Update active routing cache
		const overallSuccess = stepsFailed === 0 || stepsExecuted > 0;
		if (overallSuccess) {
			activeRoutingCache.set(routing.spaceId, routingId);
		}

		// Emit state change event
		void this.emitMediaStateChange(routing.spaceId);

		const result: MediaRoutingActivationResultModel = {
			success: overallSuccess,
			routingId,
			routingType: routing.type,
			stepsExecuted,
			stepsFailed,
			stepsSkipped,
			stepResults,
			offlineDeviceIds: offlineDeviceIds.length > 0 ? offlineDeviceIds : undefined,
		};

		this.logger.debug(
			`Routing activation complete id=${routingId} success=${overallSuccess} ` +
				`executed=${stepsExecuted} failed=${stepsFailed} skipped=${stepsSkipped}`,
		);

		return result;
	}

	/**
	 * Deactivate media (activate OFF routing or just power off)
	 */
	async deactivateMedia(spaceId: string): Promise<MediaRoutingActivationResultModel> {
		// Try to find and activate OFF routing
		const offRouting = await this.findByType(spaceId, MediaRoutingType.OFF);

		if (offRouting) {
			return this.activateRouting(offRouting.id);
		}

		// If no OFF routing exists, just clear the active routing
		activeRoutingCache.delete(spaceId);

		// Emit state change
		void this.emitMediaStateChange(spaceId);

		return {
			success: true,
			routingId: '',
			routingType: MediaRoutingType.OFF,
			stepsExecuted: 0,
			stepsFailed: 0,
			stepsSkipped: 0,
		};
	}

	/**
	 * Get the current active routing for a space
	 */
	async getActiveRouting(spaceId: string): Promise<SpaceMediaRoutingEntity | null> {
		const activeId = activeRoutingCache.get(spaceId);

		if (!activeId) {
			return null;
		}

		return this.findOne(activeId);
	}

	/**
	 * Get the current media state for a space (V2)
	 */
	async getMediaStateV2(spaceId: string): Promise<MediaStateV2Model> {
		// Verify space exists
		await this.spacesService.getOneOrThrow(spaceId);

		const endpoints = await this.endpointService.findBySpace(spaceId);
		const routings = await this.findBySpace(spaceId);
		const activeRouting = await this.getActiveRouting(spaceId);

		// Get device status
		const deviceIds = [...new Set(endpoints.map((e) => e.deviceId))];
		const devices = await this.spacesService.findDevicesByIds(deviceIds);

		let onlineCount = 0;
		let offlineCount = 0;
		let anyOn = false;

		for (const device of devices) {
			if (device.status?.online) {
				onlineCount++;
				// Check if any device is powered on by looking at power properties
				for (const channel of device.channels ?? []) {
					for (const property of channel.properties ?? []) {
						if (
							(property.category === PropertyCategory.ON || property.category === PropertyCategory.ACTIVE) &&
							property.value === true
						) {
							anyOn = true;
						}
					}
				}
			} else {
				offlineCount++;
			}
		}

		// Get current volume and mute from active audio endpoint
		let currentVolume: number | undefined;
		let isMuted: boolean | undefined;

		if (activeRouting?.audioEndpoint) {
			const audioDevice = devices.find((d) => d.id === activeRouting.audioEndpoint?.deviceId);
			if (audioDevice) {
				// Find volume and mute properties
				for (const channel of audioDevice.channels ?? []) {
					for (const property of channel.properties ?? []) {
						if (property.category === PropertyCategory.VOLUME && property.value !== undefined) {
							currentVolume = Number(property.value);
						}
						if (property.category === PropertyCategory.MUTE && property.value !== undefined) {
							isMuted = Boolean(property.value);
						}
					}
				}
			}
		}

		return {
			hasMedia: endpoints.length > 0,
			activeRoutingId: activeRouting?.id,
			activeRoutingType: activeRouting?.type,
			anyOn,
			currentVolume,
			isMuted,
			endpointsCount: endpoints.length,
			routingsCount: routings.length,
			onlineDevicesCount: onlineCount,
			offlineDevicesCount: offlineCount,
		};
	}

	/**
	 * Emit media state change event
	 */
	private async emitMediaStateChange(spaceId: string): Promise<void> {
		try {
			const state = await this.getMediaStateV2(spaceId);

			this.eventEmitter.emit(EventType.MEDIA_STATE_CHANGED, {
				space_id: spaceId,
				state,
			});

			this.logger.debug(`Emitted media state change event spaceId=${spaceId}`);
		} catch (error) {
			this.logger.error(`Failed to emit media state change: ${error}`);
		}
	}
}

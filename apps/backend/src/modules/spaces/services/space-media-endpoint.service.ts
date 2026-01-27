import { Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger';
import { ChannelCategory, DeviceCategory, PermissionType, PropertyCategory } from '../../devices/devices.constants';
import { DeviceEntity } from '../../devices/entities/devices.entity';
import { CreateMediaEndpointDto, UpdateMediaEndpointDto } from '../dto/media-endpoint.dto';
import { SpaceMediaEndpointEntity } from '../entities/space-media-endpoint.entity';
import {
	MediaCapabilitySummaryModel,
	MediaCapabilityMappingModel,
} from '../models/media-routing.model';
import {
	EventType,
	MEDIA_CHANNEL_CATEGORIES,
	MEDIA_DEVICE_CATEGORIES,
	MediaCapabilityPermission,
	MediaEndpointType,
	SPACES_MODULE_NAME,
} from '../spaces.constants';
import { SpacesValidationException } from '../spaces.exceptions';

import { SpacesService } from './spaces.service';

/**
 * Event payload for media endpoint websocket events
 */
export interface MediaEndpointEventPayload {
	id: string;
	space_id: string;
	device_id: string;
	type: MediaEndpointType;
	name: string | null;
}

@Injectable()
export class SpaceMediaEndpointService {
	private readonly logger = createExtensionLogger(SPACES_MODULE_NAME, 'SpaceMediaEndpointService');

	constructor(
		@InjectRepository(SpaceMediaEndpointEntity)
		private readonly repository: Repository<SpaceMediaEndpointEntity>,
		@InjectRepository(DeviceEntity)
		private readonly deviceRepository: Repository<DeviceEntity>,
		private readonly spacesService: SpacesService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	/**
	 * Get all media endpoints for a space
	 */
	async findBySpace(spaceId: string): Promise<SpaceMediaEndpointEntity[]> {
		this.logger.debug(`Fetching media endpoints for space id=${spaceId}`);

		// Verify space exists
		await this.spacesService.getOneOrThrow(spaceId);

		const endpoints = await this.repository.find({
			where: { spaceId },
			order: { type: 'ASC', name: 'ASC' },
		});

		this.logger.debug(`Found ${endpoints.length} media endpoints for space id=${spaceId}`);

		return endpoints;
	}

	/**
	 * Get a single media endpoint by ID
	 */
	async findOne(endpointId: string): Promise<SpaceMediaEndpointEntity | null> {
		return this.repository.findOne({
			where: { id: endpointId },
		});
	}

	/**
	 * Get a single media endpoint or throw
	 */
	async getOneOrThrow(endpointId: string): Promise<SpaceMediaEndpointEntity> {
		const endpoint = await this.findOne(endpointId);

		if (!endpoint) {
			throw new SpacesValidationException(`Media endpoint with id=${endpointId} not found`);
		}

		return endpoint;
	}

	/**
	 * Create a new media endpoint
	 */
	async create(spaceId: string, dto: CreateMediaEndpointDto): Promise<SpaceMediaEndpointEntity> {
		// Verify space exists
		await this.spacesService.getOneOrThrow(spaceId);

		// Verify device exists
		const device = await this.deviceRepository.findOne({
			where: { id: dto.deviceId },
			relations: ['channels', 'channels.properties'],
		});

		if (!device) {
			throw new SpacesValidationException(`Device with id=${dto.deviceId} not found`);
		}

		// Verify device belongs to this space
		const deviceInSpace = await this.spacesService.isDeviceInSpace(spaceId, dto.deviceId);
		if (!deviceInSpace) {
			throw new SpacesValidationException(`Device with id=${dto.deviceId} does not belong to space ${spaceId}`);
		}

		// Verify channel if specified
		if (dto.channelId) {
			const channel = device.channels?.find((ch) => ch.id === dto.channelId);
			if (!channel) {
				throw new SpacesValidationException(`Channel with id=${dto.channelId} not found on device ${dto.deviceId}`);
			}
		}

		// Check for existing endpoint with same device and type
		const existing = await this.repository.findOne({
			where: { spaceId, deviceId: dto.deviceId, type: dto.type },
		});

		if (existing) {
			throw new SpacesValidationException(
				`Endpoint of type ${dto.type} already exists for device ${dto.deviceId} in space ${spaceId}`,
			);
		}

		// Detect capabilities from device
		const capabilities = this.detectCapabilities(device, dto.channelId ?? null);

		// Create the endpoint
		const endpoint = this.repository.create({
			spaceId,
			deviceId: dto.deviceId,
			channelId: dto.channelId ?? null,
			type: dto.type,
			name: dto.name ?? device.name,
			capabilities: capabilities ? JSON.stringify(capabilities) : null,
			preferredFor: dto.preferredFor ? JSON.stringify(dto.preferredFor) : null,
		});

		const saved = await this.repository.save(endpoint);

		// Emit creation event
		this.eventEmitter.emit(EventType.MEDIA_TARGET_CREATED, {
			id: saved.id,
			space_id: spaceId,
			device_id: dto.deviceId,
			type: dto.type,
			name: saved.name,
		} as MediaEndpointEventPayload);

		this.logger.debug(`Created media endpoint id=${saved.id} type=${dto.type} for device=${dto.deviceId}`);

		return saved;
	}

	/**
	 * Update an existing media endpoint
	 */
	async update(endpointId: string, dto: UpdateMediaEndpointDto): Promise<SpaceMediaEndpointEntity> {
		const endpoint = await this.getOneOrThrow(endpointId);

		// Update fields
		if (dto.name !== undefined) {
			endpoint.name = dto.name ?? null;
		}

		if (dto.preferredFor !== undefined) {
			endpoint.preferredFor = dto.preferredFor ? JSON.stringify(dto.preferredFor) : null;
		}

		const saved = await this.repository.save(endpoint);

		// Emit update event
		this.eventEmitter.emit(EventType.MEDIA_TARGET_UPDATED, {
			id: saved.id,
			space_id: saved.spaceId,
			device_id: saved.deviceId,
			type: saved.type,
			name: saved.name,
		} as MediaEndpointEventPayload);

		this.logger.debug(`Updated media endpoint id=${endpointId}`);

		return saved;
	}

	/**
	 * Delete a media endpoint
	 */
	async delete(endpointId: string): Promise<void> {
		const endpoint = await this.findOne(endpointId);

		if (endpoint) {
			await this.repository.remove(endpoint);

			// Emit deletion event
			this.eventEmitter.emit(EventType.MEDIA_TARGET_DELETED, {
				id: endpointId,
				space_id: endpoint.spaceId,
				device_id: endpoint.deviceId,
				type: endpoint.type,
			});

			this.logger.debug(`Deleted media endpoint id=${endpointId}`);
		}
	}

	/**
	 * Bulk create media endpoints
	 */
	async bulkCreate(spaceId: string, endpoints: CreateMediaEndpointDto[]): Promise<SpaceMediaEndpointEntity[]> {
		const results: SpaceMediaEndpointEntity[] = [];

		for (const dto of endpoints) {
			try {
				const endpoint = await this.create(spaceId, dto);
				results.push(endpoint);
			} catch (error) {
				const err = error as Error;
				this.logger.warn(`Failed to create endpoint for device=${dto.deviceId}: ${err.message}`);
			}
		}

		return results;
	}

	/**
	 * Get all media devices in a space with their capability summaries
	 */
	async getMediaCapabilitiesInSpace(spaceId: string): Promise<MediaCapabilitySummaryModel[]> {
		this.logger.debug(`Getting media capabilities for space id=${spaceId}`);

		// Verify space exists
		await this.spacesService.getOneOrThrow(spaceId);

		// Get all devices in the space
		const devices = await this.spacesService.findDevicesBySpace(spaceId);

		const summaries: MediaCapabilitySummaryModel[] = [];

		for (const device of devices) {
			// Only process media devices
			if (!MEDIA_DEVICE_CATEGORIES.includes(device.category as (typeof MEDIA_DEVICE_CATEGORIES)[number])) {
				continue;
			}

			const summary = this.buildCapabilitySummary(device);
			if (summary) {
				summaries.push(summary);
			}
		}

		this.logger.debug(`Found ${summaries.length} media devices with capabilities in space id=${spaceId}`);

		return summaries;
	}

	/**
	 * Get endpoint map for a space (indexed by ID)
	 */
	async getEndpointMap(spaceId: string): Promise<Map<string, SpaceMediaEndpointEntity>> {
		const endpoints = await this.findBySpace(spaceId);
		const map = new Map<string, SpaceMediaEndpointEntity>();

		for (const endpoint of endpoints) {
			map.set(endpoint.id, endpoint);
		}

		return map;
	}

	/**
	 * Detect capabilities from a device's channels and properties
	 */
	private detectCapabilities(
		device: DeviceEntity,
		preferredChannelId: string | null,
	): Record<string, MediaCapabilityMappingModel> | null {
		const capabilities: Record<string, MediaCapabilityMappingModel> = {};

		// Find relevant media channels
		const mediaChannels = device.channels?.filter((ch) => {
			if (preferredChannelId && ch.id === preferredChannelId) {
				return true;
			}
			return MEDIA_CHANNEL_CATEGORIES.includes(ch.category as (typeof MEDIA_CHANNEL_CATEGORIES)[number]);
		}) ?? [];

		for (const channel of mediaChannels) {
			const isTelevision = channel.category === ChannelCategory.TELEVISION;
			const isSwitcher = channel.category === ChannelCategory.SWITCHER;
			const isSpeaker = channel.category === ChannelCategory.SPEAKER;
			const isPlayback = channel.category === ChannelCategory.MEDIA_PLAYBACK;
			const isInput = channel.category === ChannelCategory.MEDIA_INPUT;

			for (const property of channel.properties ?? []) {
				const permission = this.mapPermissions(property.permissions);

				// Power (from television/switcher)
				if ((isTelevision || isSwitcher) && (property.category === PropertyCategory.ON || property.category === PropertyCategory.ACTIVE)) {
					if (!capabilities.power) {
						capabilities.power = { propertyId: property.id, channelId: channel.id, permission };
					}
				}

				// Volume (from speaker or television)
				if ((isSpeaker || isTelevision) && property.category === PropertyCategory.VOLUME) {
					if (!capabilities.volume) {
						capabilities.volume = { propertyId: property.id, channelId: channel.id, permission };
					}
				}

				// Mute (from speaker or television)
				if ((isSpeaker || isTelevision) && property.category === PropertyCategory.MUTE) {
					if (!capabilities.mute) {
						capabilities.mute = { propertyId: property.id, channelId: channel.id, permission };
					}
				}

				// Playback command
				if (isPlayback && property.category === PropertyCategory.COMMAND) {
					if (!capabilities.playback) {
						capabilities.playback = { propertyId: property.id, channelId: channel.id, permission };
					}
				}

				// Playback state
				if (isPlayback && property.category === PropertyCategory.STATE) {
					if (!capabilities.playbackState) {
						capabilities.playbackState = { propertyId: property.id, channelId: channel.id, permission };
					}
				}

				// Input/source
				if ((isTelevision || isInput) && property.category === PropertyCategory.SOURCE) {
					if (!capabilities.input) {
						capabilities.input = { propertyId: property.id, channelId: channel.id, permission };
					}
				}

				// Remote key
				if (isTelevision && property.category === PropertyCategory.REMOTE_KEY) {
					if (!capabilities.remote) {
						capabilities.remote = { propertyId: property.id, channelId: channel.id, permission };
					}
				}
			}
		}

		return Object.keys(capabilities).length > 0 ? capabilities : null;
	}

	/**
	 * Build a capability summary for a device
	 */
	private buildCapabilitySummary(device: DeviceEntity): MediaCapabilitySummaryModel | null {
		const capabilities = this.detectCapabilities(device, null);

		if (!capabilities) {
			return null;
		}

		const summary: MediaCapabilitySummaryModel = {
			deviceId: device.id,
			deviceName: device.name,
			deviceCategory: device.category,
			isOnline: device.status?.online ?? false,
			suggestedEndpointTypes: [],
		};

		// Map capabilities to summary
		if (capabilities.power) {
			summary.power = capabilities.power;
		}
		if (capabilities.volume) {
			summary.volume = capabilities.volume;
		}
		if (capabilities.mute) {
			summary.mute = capabilities.mute;
		}
		if (capabilities.playback) {
			summary.playback = capabilities.playback;
		}
		if (capabilities.playbackState) {
			summary.playbackState = capabilities.playbackState;
		}
		if (capabilities.input) {
			summary.input = capabilities.input;
		}
		if (capabilities.remote) {
			summary.remote = capabilities.remote;
		}

		// Suggest endpoint types based on device category and capabilities
		summary.suggestedEndpointTypes = this.suggestEndpointTypes(device, capabilities);

		return summary;
	}

	/**
	 * Suggest endpoint types based on device category and capabilities
	 */
	private suggestEndpointTypes(
		device: DeviceEntity,
		capabilities: Record<string, MediaCapabilityMappingModel>,
	): MediaEndpointType[] {
		const types: MediaEndpointType[] = [];

		switch (device.category) {
			case DeviceCategory.TELEVISION:
			case DeviceCategory.PROJECTOR:
				types.push(MediaEndpointType.DISPLAY);
				if (capabilities.volume) {
					types.push(MediaEndpointType.AUDIO_OUTPUT);
				}
				if (capabilities.remote) {
					types.push(MediaEndpointType.REMOTE_TARGET);
				}
				break;

			case DeviceCategory.AV_RECEIVER:
				types.push(MediaEndpointType.AUDIO_OUTPUT);
				if (capabilities.input) {
					types.push(MediaEndpointType.SOURCE);
				}
				break;

			case DeviceCategory.SPEAKER:
				types.push(MediaEndpointType.AUDIO_OUTPUT);
				break;

			case DeviceCategory.SET_TOP_BOX:
			case DeviceCategory.GAME_CONSOLE:
			case DeviceCategory.STREAMING_SERVICE:
				types.push(MediaEndpointType.SOURCE);
				if (capabilities.remote) {
					types.push(MediaEndpointType.REMOTE_TARGET);
				}
				break;

			case DeviceCategory.MEDIA:
				// Generic media device - check capabilities
				if (capabilities.playback) {
					types.push(MediaEndpointType.SOURCE);
				}
				if (capabilities.volume) {
					types.push(MediaEndpointType.AUDIO_OUTPUT);
				}
				if (capabilities.remote) {
					types.push(MediaEndpointType.REMOTE_TARGET);
				}
				break;
		}

		return types;
	}

	/**
	 * Map property permissions array to capability permission
	 */
	private mapPermissions(permissions: PermissionType[]): MediaCapabilityPermission {
		const hasRead = permissions.includes(PermissionType.READ_ONLY) || permissions.includes(PermissionType.READ_WRITE);
		const hasWrite = permissions.includes(PermissionType.WRITE_ONLY) || permissions.includes(PermissionType.READ_WRITE);

		if (hasRead && hasWrite) {
			return MediaCapabilityPermission.READ_WRITE;
		} else if (hasWrite) {
			return MediaCapabilityPermission.WRITE;
		} else {
			return MediaCapabilityPermission.READ;
		}
	}

	/**
	 * Auto-create endpoints for a space based on device capabilities
	 */
	async autoCreateEndpoints(spaceId: string): Promise<SpaceMediaEndpointEntity[]> {
		this.logger.debug(`Auto-creating media endpoints for space id=${spaceId}`);

		const capabilities = await this.getMediaCapabilitiesInSpace(spaceId);
		const existingEndpoints = await this.findBySpace(spaceId);
		const created: SpaceMediaEndpointEntity[] = [];

		// Build set of existing device+type combinations
		const existingSet = new Set(existingEndpoints.map((e) => `${e.deviceId}:${e.type}`));

		for (const cap of capabilities) {
			for (const type of cap.suggestedEndpointTypes) {
				const key = `${cap.deviceId}:${type}`;

				if (!existingSet.has(key)) {
					try {
						const endpoint = await this.create(spaceId, {
							deviceId: cap.deviceId,
							type,
							name: cap.deviceName,
						});
						created.push(endpoint);
						existingSet.add(key);
					} catch (error) {
						const err = error as Error;
						this.logger.warn(`Failed to auto-create endpoint: ${err.message}`);
					}
				}
			}
		}

		this.logger.debug(`Auto-created ${created.length} media endpoints for space id=${spaceId}`);

		return created;
	}
}

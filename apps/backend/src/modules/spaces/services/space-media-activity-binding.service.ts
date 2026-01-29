import { Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger';
import { CreateMediaActivityBindingDto, UpdateMediaActivityBindingDto } from '../dto/media-activity-binding.dto';
import { SpaceMediaActivityBindingEntity } from '../entities/space-media-activity-binding.entity';
import { DerivedMediaEndpointModel } from '../models/derived-media-endpoint.model';
import { MediaActivityKey, MediaEndpointType, SPACES_MODULE_NAME } from '../spaces.constants';
import { SpacesValidationException } from '../spaces.exceptions';

import { DerivedMediaEndpointService } from './derived-media-endpoint.service';
import { SpacesService } from './spaces.service';

/**
 * Slot-to-endpoint-type mapping for validation
 */
const SLOT_TYPE_MAP: Record<string, MediaEndpointType> = {
	displayEndpointId: MediaEndpointType.DISPLAY,
	audioEndpointId: MediaEndpointType.AUDIO_OUTPUT,
	sourceEndpointId: MediaEndpointType.SOURCE,
	remoteEndpointId: MediaEndpointType.REMOTE_TARGET,
};

/**
 * Normalize empty strings to null for endpoint ID fields
 */
function normalizeEndpointId(value: string | null | undefined): string | null {
	if (value === undefined || value === null || value === '') {
		return null;
	}

	return value;
}

@Injectable()
export class SpaceMediaActivityBindingService {
	private readonly logger = createExtensionLogger(SPACES_MODULE_NAME, 'SpaceMediaActivityBindingService');

	constructor(
		@InjectRepository(SpaceMediaActivityBindingEntity)
		private readonly repository: Repository<SpaceMediaActivityBindingEntity>,
		private readonly spacesService: SpacesService,
		private readonly derivedMediaEndpointService: DerivedMediaEndpointService,
	) {}

	/**
	 * Get all activity bindings for a space
	 */
	async findBySpace(spaceId: string): Promise<SpaceMediaActivityBindingEntity[]> {
		await this.spacesService.getOneOrThrow(spaceId);

		return this.repository.find({
			where: { spaceId },
			order: { activityKey: 'ASC' },
		});
	}

	/**
	 * Get a single binding by ID
	 */
	async findOne(bindingId: string): Promise<SpaceMediaActivityBindingEntity | null> {
		return this.repository.findOne({ where: { id: bindingId } });
	}

	/**
	 * Get a single binding or throw
	 */
	async getOneOrThrow(bindingId: string): Promise<SpaceMediaActivityBindingEntity> {
		const binding = await this.findOne(bindingId);

		if (!binding) {
			throw new SpacesValidationException(`Activity binding with id=${bindingId} not found`);
		}

		return binding;
	}

	/**
	 * Get a single binding or throw, verifying it belongs to the given space
	 */
	async getOneOrThrowForSpace(spaceId: string, bindingId: string): Promise<SpaceMediaActivityBindingEntity> {
		await this.spacesService.getOneOrThrow(spaceId);

		const binding = await this.getOneOrThrow(bindingId);

		if (binding.spaceId !== spaceId) {
			throw new SpacesValidationException(`Activity binding with id=${bindingId} does not belong to space ${spaceId}`);
		}

		return binding;
	}

	/**
	 * Create a new activity binding
	 */
	async create(spaceId: string, dto: CreateMediaActivityBindingDto): Promise<SpaceMediaActivityBindingEntity> {
		await this.spacesService.getOneOrThrow(spaceId);

		// Check for existing binding with same activity key
		const existing = await this.repository.findOne({
			where: { spaceId, activityKey: dto.activityKey },
		});

		if (existing) {
			throw new SpacesValidationException(
				`Activity binding for key "${dto.activityKey}" already exists in space ${spaceId}`,
			);
		}

		// Normalize empty strings to null
		const displayEndpointId = normalizeEndpointId(dto.displayEndpointId);
		const audioEndpointId = normalizeEndpointId(dto.audioEndpointId);
		const sourceEndpointId = normalizeEndpointId(dto.sourceEndpointId);
		const remoteEndpointId = normalizeEndpointId(dto.remoteEndpointId);
		const displayInputId = normalizeEndpointId(dto.displayInputId);

		// Validate endpoint IDs and overrides
		const endpoints = await this.buildEndpointMap(spaceId);
		this.validateSlots({ displayEndpointId, audioEndpointId, sourceEndpointId, remoteEndpointId }, endpoints);
		this.validateOverrides(
			{ displayEndpointId, audioEndpointId, displayInputId, audioVolumePreset: dto.audioVolumePreset },
			endpoints,
		);

		const binding = this.repository.create({
			spaceId,
			activityKey: dto.activityKey,
			displayEndpointId,
			audioEndpointId,
			sourceEndpointId,
			remoteEndpointId,
			displayInputId,
			audioVolumePreset: dto.audioVolumePreset ?? null,
		});

		const saved = await this.repository.save(binding);

		this.logger.debug(`Created activity binding id=${saved.id} key=${dto.activityKey} for space=${spaceId}`);

		return saved;
	}

	/**
	 * Update an existing activity binding, verifying it belongs to the given space
	 */
	async updateForSpace(
		spaceId: string,
		bindingId: string,
		dto: UpdateMediaActivityBindingDto,
	): Promise<SpaceMediaActivityBindingEntity> {
		const binding = await this.getOneOrThrowForSpace(spaceId, bindingId);

		return this.applyUpdate(binding, dto);
	}

	/**
	 * Update an existing activity binding
	 */
	async update(bindingId: string, dto: UpdateMediaActivityBindingDto): Promise<SpaceMediaActivityBindingEntity> {
		const binding = await this.getOneOrThrow(bindingId);

		return this.applyUpdate(binding, dto);
	}

	/**
	 * Delete an activity binding, verifying it belongs to the given space
	 */
	async deleteForSpace(spaceId: string, bindingId: string): Promise<void> {
		const binding = await this.getOneOrThrowForSpace(spaceId, bindingId);

		await this.repository.remove(binding);

		this.logger.debug(`Deleted activity binding id=${bindingId}`);
	}

	/**
	 * Delete an activity binding
	 */
	async delete(bindingId: string): Promise<void> {
		const binding = await this.findOne(bindingId);

		if (binding) {
			await this.repository.remove(binding);
			this.logger.debug(`Deleted activity binding id=${bindingId}`);
		}
	}

	/**
	 * Apply default bindings for a space.
	 * Creates missing bindings with heuristic endpoint assignments.
	 * Does not overwrite existing bindings.
	 */
	async applyDefaults(spaceId: string): Promise<SpaceMediaActivityBindingEntity[]> {
		await this.spacesService.getOneOrThrow(spaceId);

		const existing = await this.findBySpace(spaceId);
		const existingKeys = new Set(existing.map((b) => b.activityKey));
		const endpoints = await this.buildEndpointMap(spaceId);
		const endpointList = Array.from(endpoints.values());

		const displays = endpointList.filter((e) => e.type === MediaEndpointType.DISPLAY);
		const audioOutputs = endpointList.filter((e) => e.type === MediaEndpointType.AUDIO_OUTPUT);
		const sources = endpointList.filter((e) => e.type === MediaEndpointType.SOURCE);
		const remotes = endpointList.filter((e) => e.type === MediaEndpointType.REMOTE_TARGET);

		// Prefer audio with playback capability for listen
		const playbackAudio = audioOutputs.find((e) => e.capabilities.playback) ?? audioOutputs[0];

		const defaults: Record<MediaActivityKey, Partial<SpaceMediaActivityBindingEntity>> = {
			[MediaActivityKey.WATCH]: {
				displayEndpointId: displays[0]?.endpointId ?? null,
				audioEndpointId: audioOutputs[0]?.endpointId ?? null,
				sourceEndpointId: sources[0]?.endpointId ?? null,
				remoteEndpointId:
					(displays[0] ? this.findRemoteForDevice(displays[0], remotes) : null) ?? remotes[0]?.endpointId ?? null,
			},
			[MediaActivityKey.LISTEN]: {
				displayEndpointId: null,
				audioEndpointId: playbackAudio?.endpointId ?? null,
				sourceEndpointId: sources[0]?.endpointId ?? null,
				remoteEndpointId: null,
			},
			[MediaActivityKey.GAMING]: {
				displayEndpointId: displays[0]?.endpointId ?? null,
				audioEndpointId: audioOutputs[0]?.endpointId ?? null,
				sourceEndpointId:
					sources.find((s) => s.name.toLowerCase().includes('game'))?.endpointId ?? sources[0]?.endpointId ?? null,
				remoteEndpointId: remotes[0]?.endpointId ?? null,
			},
			[MediaActivityKey.BACKGROUND]: {
				displayEndpointId: null,
				audioEndpointId: playbackAudio?.endpointId ?? null,
				sourceEndpointId: null,
				remoteEndpointId: null,
			},
			[MediaActivityKey.OFF]: {
				displayEndpointId: null,
				audioEndpointId: null,
				sourceEndpointId: null,
				remoteEndpointId: null,
			},
		};

		const created: SpaceMediaActivityBindingEntity[] = [];

		for (const key of Object.values(MediaActivityKey)) {
			if (existingKeys.has(key)) {
				continue;
			}

			try {
				const def = defaults[key];
				const binding = this.repository.create({
					spaceId,
					activityKey: key,
					displayEndpointId: def.displayEndpointId ?? null,
					audioEndpointId: def.audioEndpointId ?? null,
					sourceEndpointId: def.sourceEndpointId ?? null,
					remoteEndpointId: def.remoteEndpointId ?? null,
					displayInputId: null,
					audioVolumePreset: null,
				});

				const saved = await this.repository.save(binding);
				created.push(saved);
			} catch (error) {
				const err = error as Error;
				this.logger.warn(`Failed to auto-create binding for key=${key}: ${err.message}`);
			}
		}

		this.logger.debug(`Applied defaults: created ${created.length} bindings for space=${spaceId}`);

		// Return all bindings (existing + newly created)
		return this.findBySpace(spaceId);
	}

	/**
	 * Apply an update DTO to a binding entity
	 */
	private async applyUpdate(
		binding: SpaceMediaActivityBindingEntity,
		dto: UpdateMediaActivityBindingDto,
	): Promise<SpaceMediaActivityBindingEntity> {
		// Build effective state for validation (merge existing + updates)
		// For endpoint IDs, normalize empty strings and null to consistent null
		const effective = {
			displayEndpointId:
				dto.displayEndpointId !== undefined
					? normalizeEndpointId(dto.displayEndpointId)
					: (binding.displayEndpointId ?? undefined),
			audioEndpointId:
				dto.audioEndpointId !== undefined
					? normalizeEndpointId(dto.audioEndpointId)
					: (binding.audioEndpointId ?? undefined),
			sourceEndpointId:
				dto.sourceEndpointId !== undefined
					? normalizeEndpointId(dto.sourceEndpointId)
					: (binding.sourceEndpointId ?? undefined),
			remoteEndpointId:
				dto.remoteEndpointId !== undefined
					? normalizeEndpointId(dto.remoteEndpointId)
					: (binding.remoteEndpointId ?? undefined),
			displayInputId:
				dto.displayInputId !== undefined
					? normalizeEndpointId(dto.displayInputId)
					: (binding.displayInputId ?? undefined),
			audioVolumePreset:
				dto.audioVolumePreset !== undefined
					? (dto.audioVolumePreset ?? undefined)
					: (binding.audioVolumePreset ?? undefined),
		};

		const endpoints = await this.buildEndpointMap(binding.spaceId);
		this.validateSlots(effective, endpoints);
		this.validateOverrides(effective, endpoints);

		// Apply updates — normalize empty strings
		if (dto.displayEndpointId !== undefined) {
			binding.displayEndpointId = normalizeEndpointId(dto.displayEndpointId);
		}
		if (dto.audioEndpointId !== undefined) {
			binding.audioEndpointId = normalizeEndpointId(dto.audioEndpointId);
		}
		if (dto.sourceEndpointId !== undefined) {
			binding.sourceEndpointId = normalizeEndpointId(dto.sourceEndpointId);
		}
		if (dto.remoteEndpointId !== undefined) {
			binding.remoteEndpointId = normalizeEndpointId(dto.remoteEndpointId);
		}
		if (dto.displayInputId !== undefined) {
			binding.displayInputId = normalizeEndpointId(dto.displayInputId);
		}
		if (dto.audioVolumePreset !== undefined) {
			binding.audioVolumePreset = dto.audioVolumePreset ?? null;
		}

		const saved = await this.repository.save(binding);

		this.logger.debug(`Updated activity binding id=${binding.id}`);

		return saved;
	}

	/**
	 * Build a map of derived endpoint ID → endpoint model for a space
	 */
	private async buildEndpointMap(spaceId: string): Promise<Map<string, DerivedMediaEndpointModel>> {
		const result = await this.derivedMediaEndpointService.buildEndpointsForSpace(spaceId);
		const map = new Map<string, DerivedMediaEndpointModel>();

		for (const endpoint of result.endpoints) {
			map.set(endpoint.endpointId, endpoint);
		}

		return map;
	}

	/**
	 * Validate that all slot endpoint IDs exist and match the expected type.
	 * Null/undefined values are skipped (partial bindings are allowed).
	 */
	private validateSlots(
		dto: {
			displayEndpointId?: string | null;
			audioEndpointId?: string | null;
			sourceEndpointId?: string | null;
			remoteEndpointId?: string | null;
		},
		endpoints: Map<string, DerivedMediaEndpointModel>,
	): void {
		for (const [field, expectedType] of Object.entries(SLOT_TYPE_MAP)) {
			const endpointId = dto[field as keyof typeof dto];

			if (endpointId === undefined || endpointId === null) {
				continue;
			}

			const endpoint = endpoints.get(endpointId);

			if (!endpoint) {
				const snakeField = field.replace(/([A-Z])/g, '_$1').toLowerCase();

				throw new SpacesValidationException(
					`Endpoint "${endpointId}" referenced in ${snakeField} does not exist in this space`,
				);
			}

			if (endpoint.type !== expectedType) {
				const snakeField = field.replace(/([A-Z])/g, '_$1').toLowerCase();

				throw new SpacesValidationException(
					`Endpoint "${endpointId}" has type "${endpoint.type}" but ${snakeField} requires type "${expectedType}"`,
				);
			}
		}
	}

	/**
	 * Validate override fields against endpoint capabilities
	 */
	private validateOverrides(
		dto: {
			displayEndpointId?: string | null;
			audioEndpointId?: string | null;
			displayInputId?: string | null;
			audioVolumePreset?: number;
		},
		endpoints: Map<string, DerivedMediaEndpointModel>,
	): void {
		// displayInputId requires display endpoint with inputSelect capability
		if (dto.displayInputId) {
			if (!dto.displayEndpointId) {
				throw new SpacesValidationException('display_input_id requires a display_endpoint_id to be set');
			}

			const display = endpoints.get(dto.displayEndpointId);

			if (display && !display.capabilities.inputSelect) {
				throw new SpacesValidationException(
					`Display endpoint "${dto.displayEndpointId}" does not support input selection (inputSelect capability required)`,
				);
			}
		}

		// audioVolumePreset requires audio endpoint with volume capability
		if (dto.audioVolumePreset !== undefined && dto.audioVolumePreset !== null) {
			if (!dto.audioEndpointId) {
				throw new SpacesValidationException('audio_volume_preset requires an audio_endpoint_id to be set');
			}

			const audio = endpoints.get(dto.audioEndpointId);

			if (audio && !audio.capabilities.volume) {
				throw new SpacesValidationException(
					`Audio endpoint "${dto.audioEndpointId}" does not support volume control (volume capability required)`,
				);
			}
		}
	}

	/**
	 * Find a remote endpoint for the same device as a given display
	 */
	private findRemoteForDevice(display: DerivedMediaEndpointModel, remotes: DerivedMediaEndpointModel[]): string | null {
		const match = remotes.find((r) => r.deviceId === display.deviceId);

		return match?.endpointId ?? null;
	}
}

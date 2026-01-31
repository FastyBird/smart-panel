import { Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger';
import { DeviceCategory } from '../../devices/devices.constants';
import { CreateMediaActivityBindingDto, UpdateMediaActivityBindingDto } from '../dto/media-activity-binding.dto';
import { SpaceMediaActivityBindingEntity } from '../entities/space-media-activity-binding.entity';
import { DerivedMediaEndpointModel } from '../models/derived-media-endpoint.model';
import { MediaActivityKey, MediaEndpointType, SPACES_MODULE_NAME } from '../spaces.constants';
import { SpacesValidationException } from '../spaces.exceptions';

import { DerivedMediaEndpointService } from './derived-media-endpoint.service';
import { MediaCapabilityService } from './media-capability.service';
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
		private readonly mediaCapabilityService: MediaCapabilityService,
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
	 *
	 * Heuristic priorities:
	 * - Watch: display w/ inputSelect, AVR audio > TV audio > speaker, streamer source, display remote
	 * - Listen: playback-capable audio, playback source, source remote
	 * - Gaming: display w/ inputSelect, AVR audio, game console source, display remote
	 * - Background: playback-capable audio, volume preset 20
	 * - Off: empty
	 */
	async applyDefaults(spaceId: string): Promise<SpaceMediaActivityBindingEntity[]> {
		await this.spacesService.getOneOrThrow(spaceId);

		const existing = await this.findBySpace(spaceId);
		const existingKeys = new Set(existing.map((b) => b.activityKey));
		const endpoints = await this.buildEndpointMap(spaceId);
		const endpointList = Array.from(endpoints.values());

		// Load capability summaries for device category awareness
		const summaries = await this.mediaCapabilityService.getMediaCapabilitiesInSpace(spaceId);
		const categoryMap = new Map<string, DeviceCategory>();

		for (const s of summaries) {
			categoryMap.set(s.deviceId, s.deviceCategory as DeviceCategory);
		}

		const displays = endpointList.filter((e) => e.type === MediaEndpointType.DISPLAY);
		const audioOutputs = endpointList.filter((e) => e.type === MediaEndpointType.AUDIO_OUTPUT);
		const sources = endpointList.filter((e) => e.type === MediaEndpointType.SOURCE);
		const remotes = endpointList.filter((e) => e.type === MediaEndpointType.REMOTE_TARGET);

		// Sort displays: prefer those with inputSelect
		const sortedDisplays = [...displays].sort((a, b) => {
			const aScore = (a.capabilities.inputSelect ? 2 : 0) + (a.capabilities.remoteCommands ? 1 : 0);
			const bScore = (b.capabilities.inputSelect ? 2 : 0) + (b.capabilities.remoteCommands ? 1 : 0);

			return bScore - aScore;
		});

		// Audio ranking helper: AVR=3, TV speaker=2, speaker=1, other=0
		const audioRank = (ep: DerivedMediaEndpointModel): number => {
			const cat = categoryMap.get(ep.deviceId);

			if (cat === DeviceCategory.AV_RECEIVER) {
				return 3;
			}
			if (cat === DeviceCategory.TELEVISION || cat === DeviceCategory.PROJECTOR) {
				return 2;
			}
			if (cat === DeviceCategory.SPEAKER) {
				return 1;
			}

			return 0;
		};

		// Best audio for video activities (volume-capable, prefer AVR > TV > speaker)
		const videoAudio = [...audioOutputs]
			.filter((e) => e.capabilities.volume)
			.sort((a, b) => audioRank(b) - audioRank(a));
		const bestVideoAudio = videoAudio[0] ?? audioOutputs[0];

		// Best audio for listen/background (prefer playback/track capable, then speaker-like)
		const playbackAudioSorted = [...audioOutputs].sort((a, b) => {
			const aPlay = a.capabilities.playback ? 2 : 0;
			const bPlay = b.capabilities.playback ? 2 : 0;
			const aSpeaker = categoryMap.get(a.deviceId) === DeviceCategory.SPEAKER ? 1 : 0;
			const bSpeaker = categoryMap.get(b.deviceId) === DeviceCategory.SPEAKER ? 1 : 0;

			return bPlay + bSpeaker - (aPlay + aSpeaker);
		});
		const bestListenAudio = playbackAudioSorted[0] ?? audioOutputs[0];

		// Game source: prefer game console, then set-top-box, then name-match
		const gameSource =
			sources.find((s) => categoryMap.get(s.deviceId) === DeviceCategory.GAME_CONSOLE) ??
			sources.find((s) => s.name.toLowerCase().includes('game')) ??
			sources.find((s) => categoryMap.get(s.deviceId) === DeviceCategory.SET_TOP_BOX);

		// Streamer source: prefer streaming service, then source with playback
		const streamerSource =
			sources.find((s) => categoryMap.get(s.deviceId) === DeviceCategory.STREAMING_SERVICE) ??
			sources.find((s) => s.capabilities.playback);

		// Playback-capable source for Listen
		const playbackSource = sources.find((s) => s.capabilities.playback || s.capabilities.track);

		const bestDisplay = sortedDisplays[0];

		const defaults: Record<
			MediaActivityKey,
			Partial<SpaceMediaActivityBindingEntity> & { audioVolumePreset?: number | null }
		> = {
			[MediaActivityKey.WATCH]: {
				displayEndpointId: bestDisplay?.endpointId ?? null,
				audioEndpointId: bestVideoAudio?.endpointId ?? null,
				sourceEndpointId: streamerSource?.endpointId ?? sources[0]?.endpointId ?? null,
				remoteEndpointId:
					(bestDisplay ? this.findRemoteForDevice(bestDisplay, remotes) : null) ?? remotes[0]?.endpointId ?? null,
				audioVolumePreset: null,
			},
			[MediaActivityKey.LISTEN]: {
				displayEndpointId: null,
				audioEndpointId: bestListenAudio?.endpointId ?? null,
				sourceEndpointId: playbackSource?.endpointId ?? sources[0]?.endpointId ?? null,
				remoteEndpointId: this.findListenRemote(playbackSource, bestListenAudio, remotes, bestDisplay),
				audioVolumePreset: null,
			},
			[MediaActivityKey.GAMING]: {
				displayEndpointId: bestDisplay?.endpointId ?? null,
				audioEndpointId: bestVideoAudio?.endpointId ?? null,
				sourceEndpointId: gameSource?.endpointId ?? sources[0]?.endpointId ?? null,
				remoteEndpointId:
					(bestDisplay ? this.findRemoteForDevice(bestDisplay, remotes) : null) ?? remotes[0]?.endpointId ?? null,
				audioVolumePreset: null,
			},
			[MediaActivityKey.BACKGROUND]: {
				displayEndpointId: null,
				audioEndpointId: bestListenAudio?.endpointId ?? null,
				sourceEndpointId: null,
				remoteEndpointId: null,
				audioVolumePreset: bestListenAudio ? 20 : null,
			},
			[MediaActivityKey.OFF]: {
				displayEndpointId: null,
				audioEndpointId: null,
				sourceEndpointId: null,
				remoteEndpointId: null,
				audioVolumePreset: null,
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
					audioVolumePreset: def.audioVolumePreset ?? null,
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
	 * Validate all bindings for a space and return a diagnostic report.
	 */
	async validateBindings(spaceId: string): Promise<BindingValidationReport[]> {
		await this.spacesService.getOneOrThrow(spaceId);

		const bindings = await this.findBySpace(spaceId);
		const endpoints = await this.buildEndpointMap(spaceId);
		const reports: BindingValidationReport[] = [];

		for (const binding of bindings) {
			const issues: BindingValidationIssue[] = [];

			// Check each slot
			this.validateSlotForReport(
				binding.displayEndpointId,
				'displayEndpointId',
				MediaEndpointType.DISPLAY,
				endpoints,
				issues,
			);
			this.validateSlotForReport(
				binding.audioEndpointId,
				'audioEndpointId',
				MediaEndpointType.AUDIO_OUTPUT,
				endpoints,
				issues,
			);
			this.validateSlotForReport(
				binding.sourceEndpointId,
				'sourceEndpointId',
				MediaEndpointType.SOURCE,
				endpoints,
				issues,
			);
			this.validateSlotForReport(
				binding.remoteEndpointId,
				'remoteEndpointId',
				MediaEndpointType.REMOTE_TARGET,
				endpoints,
				issues,
			);

			// Check missing slots that are typically expected
			if (binding.activityKey === MediaActivityKey.WATCH || binding.activityKey === MediaActivityKey.GAMING) {
				if (!binding.displayEndpointId) {
					issues.push({
						slot: 'displayEndpointId',
						severity: 'warning',
						message: 'Missing display endpoint for video activity',
					});
				}
				if (!binding.audioEndpointId) {
					issues.push({
						slot: 'audioEndpointId',
						severity: 'warning',
						message: 'Missing audio endpoint for video activity',
					});
				}
			}

			if (binding.activityKey === MediaActivityKey.LISTEN || binding.activityKey === MediaActivityKey.BACKGROUND) {
				if (!binding.audioEndpointId) {
					issues.push({
						slot: 'audioEndpointId',
						severity: 'warning',
						message: 'Missing audio endpoint for audio activity',
					});
				}
			}

			// Check overrides
			if (binding.displayInputId && binding.displayEndpointId) {
				const ep = endpoints.get(binding.displayEndpointId);

				if (ep && !ep.capabilities.inputSelect) {
					issues.push({
						slot: 'displayInputId',
						severity: 'error',
						message: 'Display endpoint does not support input selection',
					});
				}
			}

			if (binding.audioVolumePreset !== null && binding.audioEndpointId) {
				const ep = endpoints.get(binding.audioEndpointId);

				if (ep && !ep.capabilities.volume) {
					issues.push({
						slot: 'audioVolumePreset',
						severity: 'error',
						message: 'Audio endpoint does not support volume control',
					});
				}
			}

			reports.push({
				activityKey: binding.activityKey,
				bindingId: binding.id,
				issues,
				valid: issues.filter((i) => i.severity === 'error').length === 0,
			});
		}

		// Report missing bindings
		for (const key of Object.values(MediaActivityKey)) {
			if (!bindings.find((b) => b.activityKey === key)) {
				reports.push({
					activityKey: key,
					bindingId: null,
					issues: [{ slot: null, severity: 'info', message: `No binding configured for activity "${key}"` }],
					valid: true,
				});
			}
		}

		return reports;
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

		// Auto-clear dependent overrides when parent endpoint is being cleared
		if (effective.displayEndpointId === null) {
			effective.displayInputId = undefined;
		}
		if (effective.audioEndpointId === null) {
			effective.audioVolumePreset = undefined;
		}

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
		// Apply dependent override from dto only if parent endpoint is not being cleared;
		// otherwise force-clear the override to maintain the invariant
		if (effective.displayEndpointId === null) {
			binding.displayInputId = null;
		} else if (dto.displayInputId !== undefined) {
			binding.displayInputId = normalizeEndpointId(dto.displayInputId);
		}
		if (effective.audioEndpointId === null) {
			binding.audioVolumePreset = null;
		} else if (dto.audioVolumePreset !== undefined) {
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

	/**
	 * Find the best remote for Listen activity:
	 * 1) source remote if available
	 * 2) audio device remote if available
	 * 3) display remote as fallback
	 */
	private findListenRemote(
		source: DerivedMediaEndpointModel | undefined,
		audio: DerivedMediaEndpointModel | undefined,
		remotes: DerivedMediaEndpointModel[],
		display: DerivedMediaEndpointModel | undefined,
	): string | null {
		if (source) {
			const sourceRemote = remotes.find((r) => r.deviceId === source.deviceId);

			if (sourceRemote) {
				return sourceRemote.endpointId;
			}
		}

		if (audio) {
			const audioRemote = remotes.find((r) => r.deviceId === audio.deviceId);

			if (audioRemote) {
				return audioRemote.endpointId;
			}
		}

		if (display) {
			const displayRemote = remotes.find((r) => r.deviceId === display.deviceId);

			if (displayRemote) {
				return displayRemote.endpointId;
			}
		}

		return remotes[0]?.endpointId ?? null;
	}

	/**
	 * Validate a single slot for the diagnostic report
	 */
	private validateSlotForReport(
		endpointId: string | null,
		slotName: string,
		expectedType: MediaEndpointType,
		endpoints: Map<string, DerivedMediaEndpointModel>,
		issues: BindingValidationIssue[],
	): void {
		if (!endpointId) {
			return;
		}

		const ep = endpoints.get(endpointId);

		if (!ep) {
			issues.push({ slot: slotName, severity: 'error', message: `Endpoint "${endpointId}" not found in space` });

			return;
		}

		if (ep.type !== expectedType) {
			issues.push({
				slot: slotName,
				severity: 'error',
				message: `Endpoint type "${ep.type}" does not match expected "${expectedType}"`,
			});
		}
	}
}

/**
 * Diagnostic issue for a binding slot
 */
export interface BindingValidationIssue {
	slot: string | null;
	severity: 'error' | 'warning' | 'info';
	message: string;
}

/**
 * Diagnostic report for a single activity binding
 */
export interface BindingValidationReport {
	activityKey: MediaActivityKey;
	bindingId: string | null;
	issues: BindingValidationIssue[];
	valid: boolean;
}

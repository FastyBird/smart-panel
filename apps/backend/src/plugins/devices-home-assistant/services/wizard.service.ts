import { randomUUID } from 'crypto';

import { Injectable, OnModuleDestroy } from '@nestjs/common';

import { ChannelCategory } from '../../../modules/devices/devices.constants';
import { DeviceValidationService } from '../../../modules/devices/services/device-validation.service';
import { AdoptHelperRequestDto } from '../dto/helper-mapping-preview.dto';
import { AdoptDeviceRequestDto } from '../dto/mapping-preview.dto';
import { HelperMappingPreviewModel } from '../models/helper-mapping-preview.model';
import { MappingPreviewModel } from '../models/mapping-preview.model';
import {
	HomeAssistantWizardAdoptionResultModel,
	HomeAssistantWizardCandidateModel,
	HomeAssistantWizardSessionModel,
} from '../models/wizard.model';
import { buildHelperDeviceStructure } from '../utils/helper-structure.utils';

import { DeviceAdoptionService } from './device-adoption.service';
import { HelperAdoptionService } from './helper-adoption.service';
import { HelperMappingPreviewService } from './helper-mapping-preview.service';
import { HomeAssistantHttpService } from './home-assistant.http.service';
import { MappingPreviewService } from './mapping-preview.service';

interface HomeAssistantWizardCandidate {
	snapshot: HomeAssistantWizardCandidateModel;
	request: AdoptDeviceRequestDto | AdoptHelperRequestDto | null;
}

interface HomeAssistantWizardSession {
	id: string;
	startedAt: Date;
	candidates: Map<string, HomeAssistantWizardCandidate>;
	idleTimer?: NodeJS.Timeout;
}

@Injectable()
export class HomeAssistantWizardService implements OnModuleDestroy {
	private static readonly IDLE_TTL_MS = 10 * 60_000;

	private readonly sessions = new Map<string, HomeAssistantWizardSession>();

	constructor(
		private readonly mappingPreviewService: MappingPreviewService,
		private readonly helperMappingPreviewService: HelperMappingPreviewService,
		private readonly deviceAdoptionService: DeviceAdoptionService,
		private readonly helperAdoptionService: HelperAdoptionService,
		private readonly homeAssistantHttpService: HomeAssistantHttpService,
		private readonly deviceValidationService: DeviceValidationService,
	) {}

	async start(): Promise<HomeAssistantWizardSessionModel> {
		const inventory = await this.homeAssistantHttpService.getDiscoveredInventory();
		const [devicePreviewResults, helperPreviewResults] = await Promise.all([
			this.mappingPreviewService.generateSettledPreviews(inventory.devices),
			this.helperMappingPreviewService.generateSettledPreviews(inventory.helpers),
		]);
		const adoptedBySourceId = new Map<string, string>();
		for (const item of [...inventory.devices, ...inventory.helpers]) {
			const sourceId = 'id' in item ? item.id : item.entityId;
			if (item.adoptedDeviceId) {
				adoptedBySourceId.set(sourceId, item.adoptedDeviceId);
			}
		}
		const id = randomUUID();
		const session: HomeAssistantWizardSession = {
			id,
			startedAt: new Date(),
			candidates: new Map(),
		};

		for (const result of devicePreviewResults) {
			const candidate = result.preview
				? this.createDeviceCandidate(result.preview, adoptedBySourceId.get(result.source.id) ?? null)
				: this.createFailedCandidate('device', result.source.id, result.source.name, null, null, result.error);
			session.candidates.set(candidate.snapshot.key, candidate);
		}

		const representedEntityIds = new Set(
			Array.from(session.candidates.values()).flatMap((candidate) =>
				candidate.snapshot.kind === 'device' && candidate.snapshot.status === 'ready' && candidate.request
					? (candidate.request as AdoptDeviceRequestDto).channels.map((channel) => channel.entityId)
					: [],
			),
		);

		for (const result of helperPreviewResults) {
			if (representedEntityIds.has(result.source.entityId)) {
				continue;
			}

			const candidate = result.preview
				? this.createHelperCandidate(result.preview, adoptedBySourceId.get(result.source.entityId) ?? null)
				: this.createFailedCandidate(
						'helper',
						result.source.entityId,
						result.source.name,
						'Home Assistant',
						`Helper (${result.source.domain})`,
						result.error,
					);
			session.candidates.set(candidate.snapshot.key, candidate);
		}

		this.sessions.set(id, session);
		this.refreshIdleTimer(session);

		return this.toSnapshot(session);
	}

	get(id: string): HomeAssistantWizardSessionModel | null {
		const session = this.sessions.get(id);

		if (!session) {
			return null;
		}

		this.refreshIdleTimer(session);

		return this.toSnapshot(session);
	}

	end(id: string): void {
		const session = this.sessions.get(id);

		if (!session) {
			return;
		}

		if (session.idleTimer) {
			clearTimeout(session.idleTimer);
		}

		this.sessions.delete(id);
	}

	onModuleDestroy(): void {
		for (const session of this.sessions.values()) {
			if (session.idleTimer) {
				clearTimeout(session.idleTimer);
			}
		}

		this.sessions.clear();
	}

	async adopt(id: string, keys: string[]): Promise<HomeAssistantWizardAdoptionResultModel[] | null> {
		const session = this.sessions.get(id);

		if (!session) {
			return null;
		}

		this.refreshIdleTimer(session);
		const results: HomeAssistantWizardAdoptionResultModel[] = [];

		for (const key of [...new Set(keys)]) {
			const candidate = session.candidates.get(key);

			if (!candidate || candidate.snapshot.status !== 'ready' || !candidate.request) {
				results.push({
					key,
					name: candidate?.snapshot.name ?? key,
					status: 'failed',
					error: candidate ? 'Candidate requires manual mapping or is no longer adoptable' : 'Unknown candidate',
				});
				continue;
			}

			try {
				const request = await this.resolveCurrentRequest(candidate.snapshot);
				const device =
					candidate.snapshot.kind === 'device'
						? await this.deviceAdoptionService.adoptDevice(request as AdoptDeviceRequestDto)
						: await this.helperAdoptionService.adoptHelper(request as AdoptHelperRequestDto);

				candidate.snapshot.status = 'already_registered';
				candidate.snapshot.adoptedDeviceId = device.id;
				candidate.snapshot.name = request.name;
				candidate.request = null;
				results.push({ key, name: request.name, status: 'created', error: null });
			} catch (error) {
				results.push({ key, name: candidate.snapshot.name, status: 'failed', error: (error as Error).message });
			}
		}

		return results;
	}

	private async resolveCurrentRequest(
		candidate: HomeAssistantWizardCandidateModel,
	): Promise<AdoptDeviceRequestDto | AdoptHelperRequestDto> {
		if (candidate.kind === 'device') {
			const preview = await this.mappingPreviewService.generatePreview(candidate.sourceId);
			const request = this.buildDeviceRequest(preview);

			if (!preview.readyToAdopt || preview.warnings.length > 0 || request.channels.length === 0) {
				throw new Error('Automatic mapping changed and now requires manual review');
			}

			return request;
		}

		const preview = await this.helperMappingPreviewService.generatePreview(candidate.sourceId);
		const request = this.buildHelperRequest(preview);

		if (
			!preview.readyToAdopt ||
			preview.warnings.length > 0 ||
			request.channels.length === 0 ||
			!this.isHelperRequestValid(request)
		) {
			throw new Error('Automatic mapping changed and now requires manual review');
		}

		return request;
	}

	private createDeviceCandidate(
		preview: MappingPreviewModel,
		adoptedDeviceId: string | null,
	): HomeAssistantWizardCandidate {
		const key = `device:${preview.haDevice.id}`;
		const request = this.buildDeviceRequest(preview);
		const ready = preview.readyToAdopt && preview.warnings.length === 0 && request.channels.length > 0;
		const status = adoptedDeviceId ? 'already_registered' : ready ? 'ready' : 'needs_attention';

		return {
			snapshot: {
				key,
				kind: 'device',
				sourceId: preview.haDevice.id,
				name: preview.suggestedDevice.name,
				manufacturer: preview.haDevice.manufacturer,
				model: preview.haDevice.model,
				status,
				suggestedCategory: preview.suggestedDevice.category,
				previewChannelCount: request.channels.length,
				warningCount: preview.warnings.length,
				adoptedDeviceId,
				error: null,
			},
			request: status === 'ready' ? request : null,
		};
	}

	private createHelperCandidate(
		preview: HelperMappingPreviewModel,
		adoptedDeviceId: string | null,
	): HomeAssistantWizardCandidate {
		const key = `helper:${preview.helper.entityId}`;
		const request = this.buildHelperRequest(preview);
		const ready =
			preview.readyToAdopt &&
			preview.warnings.length === 0 &&
			request.channels.length > 0 &&
			this.isHelperRequestValid(request);
		const status = adoptedDeviceId ? 'already_registered' : ready ? 'ready' : 'needs_attention';

		return {
			snapshot: {
				key,
				kind: 'helper',
				sourceId: preview.helper.entityId,
				name: preview.suggestedDevice.name,
				manufacturer: 'Home Assistant',
				model: `Helper (${preview.helper.domain})`,
				status,
				suggestedCategory: preview.suggestedDevice.category,
				previewChannelCount: request.channels.length,
				warningCount: preview.warnings.length,
				adoptedDeviceId,
				error: null,
			},
			request: status === 'ready' ? request : null,
		};
	}

	private buildDeviceRequest(preview: MappingPreviewModel): AdoptDeviceRequestDto {
		return {
			haDeviceId: preview.haDevice.id,
			name: preview.suggestedDevice.name,
			category: preview.suggestedDevice.category,
			description: null,
			enabled: true,
			channels: preview.entities
				.filter(
					(entity) =>
						entity.status !== 'skipped' &&
						entity.status !== 'incompatible' &&
						entity.suggestedChannel &&
						entity.suggestedChannel.category !== ChannelCategory.GENERIC &&
						entity.suggestedProperties.length > 0,
				)
				.map((entity) => ({
					entityId: entity.entityId,
					category: entity.suggestedChannel.category,
					name: entity.suggestedChannel.name,
					properties: entity.suggestedProperties.map((property) => ({
						category: property.category,
						haAttribute: property.haAttribute,
						dataType: property.dataType,
						permissions: property.permissions,
						format: property.format,
						haEntityId: property.haEntityId ?? entity.entityId,
						haTransformer: property.haTransformer ?? null,
					})),
				})),
		};
	}

	private buildHelperRequest(preview: HelperMappingPreviewModel): AdoptHelperRequestDto {
		return {
			entityId: preview.helper.entityId,
			name: preview.suggestedDevice.name,
			category: preview.suggestedDevice.category,
			description: null,
			enabled: true,
			channels: preview.suggestedChannels
				.filter((channel) => channel.category !== ChannelCategory.GENERIC && channel.suggestedProperties.length > 0)
				.map((channel) => ({
					category: channel.category,
					name: channel.name,
					properties: channel.suggestedProperties.map((property) => ({
						category: property.category,
						haAttribute: property.haAttribute,
						dataType: property.dataType,
						permissions: property.permissions,
						format: property.format,
						haTransformer: property.haTransformer,
					})),
				})),
		};
	}

	private createFailedCandidate(
		kind: 'device' | 'helper',
		sourceId: string,
		name: string,
		manufacturer: string | null,
		model: string | null,
		error: string | null,
	): HomeAssistantWizardCandidate {
		return {
			snapshot: {
				key: `${kind}:${sourceId}`,
				kind,
				sourceId,
				name,
				manufacturer,
				model,
				status: 'failed',
				suggestedCategory: null,
				previewChannelCount: 0,
				warningCount: 1,
				adoptedDeviceId: null,
				error: error ?? 'Automatic mapping could not be generated',
			},
			request: null,
		};
	}

	private isHelperRequestValid(request: AdoptHelperRequestDto): boolean {
		return this.deviceValidationService.validateDeviceStructure(buildHelperDeviceStructure(request)).isValid;
	}

	private toSnapshot(session: HomeAssistantWizardSession): HomeAssistantWizardSessionModel {
		return {
			id: session.id,
			startedAt: session.startedAt.toISOString(),
			candidates: Array.from(session.candidates.values(), (candidate) => candidate.snapshot),
		};
	}

	private refreshIdleTimer(session: HomeAssistantWizardSession): void {
		if (session.idleTimer) {
			clearTimeout(session.idleTimer);
		}

		session.idleTimer = setTimeout(() => this.end(session.id), HomeAssistantWizardService.IDLE_TTL_MS);
	}
}

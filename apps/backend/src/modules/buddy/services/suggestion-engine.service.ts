import { LessThanOrEqual, MoreThan, Not, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger';
import { SpacesService } from '../../spaces/services/spaces.service';
import { SuggestionFeedback } from '../../spaces/spaces.constants';
import {
	BUDDY_MODULE_NAME,
	EventType,
	SUGGESTION_CLEANUP_INTERVAL_MS,
	SUGGESTION_COOLDOWN_MS,
	SUGGESTION_EXPIRY_MS,
	SuggestionType,
} from '../buddy.constants';
import { BuddySuggestionNotFoundException } from '../buddy.exceptions';
import { BuddySuggestionEntity, SuggestionStatus } from '../entities/buddy-suggestion.entity';

import { EvaluatorResult } from './heartbeat.types';
import { DetectedPattern, PatternDetectorService, patternToEvaluatorResult } from './pattern-detector.service';

export interface BuddySuggestion {
	id: string;
	type: SuggestionType;
	title: string;
	reason: string;
	spaceId: string;
	metadata: Record<string, unknown>;
	createdAt: Date;
	expiresAt: Date;
}

@Injectable()
export class SuggestionEngineService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = createExtensionLogger(BUDDY_MODULE_NAME, 'SuggestionEngineService');
	private cleanupTimer: ReturnType<typeof setInterval> | null = null;
	private generationPromise: Promise<BuddySuggestion[]> | null = null;

	constructor(
		@InjectRepository(BuddySuggestionEntity)
		private readonly suggestionRepo: Repository<BuddySuggestionEntity>,
		private readonly patternDetector: PatternDetectorService,
		private readonly spacesService: SpacesService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async onModuleInit(): Promise<void> {
		try {
			// Expire any suggestions that passed their expiresAt while the service was down
			await this.cleanupExpired();

			const active = await this.suggestionRepo.count({ where: { status: SuggestionStatus.ACTIVE } });

			this.logger.log(`Loaded ${active} active suggestion(s) from database`);
		} catch (error) {
			// Table may not exist yet during CLI commands (e.g. openapi:generate)
			this.logger.warn(`Failed to load suggestions on init: ${(error as Error).message}`);
		}

		this.cleanupTimer = setInterval(() => {
			this.cleanupExpired().catch((err: Error) => {
				this.logger.error(`Suggestion cleanup failed: ${err.message}`);
			});
		}, SUGGESTION_CLEANUP_INTERVAL_MS);
		this.cleanupTimer.unref();
	}

	onModuleDestroy(): void {
		if (this.cleanupTimer) {
			clearInterval(this.cleanupTimer);
			this.cleanupTimer = null;
		}
	}

	/**
	 * Check whether a suggestion type is on cooldown for a given space.
	 * Cooldown is derived from the most recent dismissed/accepted suggestion's feedbackAt.
	 */
	async isOnCooldown(spaceId: string, type: SuggestionType, now?: number): Promise<boolean> {
		const cutoff = new Date((now ?? Date.now()) - SUGGESTION_COOLDOWN_MS);

		const recent = await this.suggestionRepo.findOne({
			where: {
				spaceId,
				type,
				status: Not(SuggestionStatus.ACTIVE),
				feedbackAt: MoreThan(cutoff),
			},
			order: { feedbackAt: 'DESC' },
		});

		return recent !== null;
	}

	/**
	 * Generate suggestions from detected patterns.
	 * Uses a Promise-based lock to prevent concurrent generation.
	 */
	async generateSuggestions(): Promise<BuddySuggestion[]> {
		if (this.generationPromise !== null) {
			return this.generationPromise;
		}

		this.generationPromise = this.doGenerateSuggestions().finally(() => {
			this.generationPromise = null;
		});

		return this.generationPromise;
	}

	private async doGenerateSuggestions(): Promise<BuddySuggestion[]> {
		const patterns = this.patternDetector.detectPatterns();
		const newSuggestions: BuddySuggestion[] = [];

		for (const pattern of patterns) {
			if (await this.isOnCooldown(pattern.spaceId, SuggestionType.PATTERN_SCENE_CREATE)) {
				continue;
			}

			if (await this.hasSuggestionForPattern(pattern)) {
				continue;
			}

			const spaceName = await this.resolveSpaceName(pattern.spaceId);

			// Re-check after async gap to prevent duplicates
			if (await this.hasSuggestionForPattern(pattern)) {
				continue;
			}

			const result = patternToEvaluatorResult(pattern, spaceName);

			const entity = this.suggestionRepo.create({
				id: uuid(),
				type: result.type,
				title: result.title,
				reason: result.reason,
				spaceId: result.spaceId,
				metadata: result.metadata,
				status: SuggestionStatus.ACTIVE,
				expiresAt: new Date(Date.now() + SUGGESTION_EXPIRY_MS),
				feedbackAt: null,
			});

			await this.suggestionRepo.save(entity);

			const suggestion = this.entityToSuggestion(entity);

			newSuggestions.push(suggestion);

			this.eventEmitter.emit(EventType.SUGGESTION_CREATED, suggestion);

			this.logger.debug(
				`Created suggestion id=${suggestion.id}: "${suggestion.reason}" (confidence=${pattern.confidence})`,
			);
		}

		return newSuggestions;
	}

	/**
	 * Get all active (non-expired, non-cooldown) suggestions, optionally filtered by space.
	 */
	async getActiveSuggestions(spaceId?: string): Promise<BuddySuggestion[]> {
		const now = new Date();
		const where: Record<string, unknown> = {
			status: SuggestionStatus.ACTIVE,
			expiresAt: MoreThan(now),
		};

		if (spaceId) {
			where.spaceId = spaceId;
		}

		const entities = await this.suggestionRepo.find({
			where,
			order: { createdAt: 'DESC' },
		});

		// Filter out suggestions whose space+type combo is on cooldown
		const filtered: BuddySuggestionEntity[] = [];

		for (const entity of entities) {
			if (await this.isOnCooldown(entity.spaceId, entity.type)) {
				continue;
			}

			filtered.push(entity);
		}

		return filtered.map((e) => this.entityToSuggestion(e));
	}

	/**
	 * Get a suggestion by ID.
	 */
	async getSuggestionOrThrow(id: string): Promise<BuddySuggestion> {
		const entity = await this.suggestionRepo.findOne({ where: { id } });

		if (!entity) {
			throw new BuddySuggestionNotFoundException(id);
		}

		return this.entityToSuggestion(entity);
	}

	/**
	 * Record feedback for a suggestion.
	 * Both 'applied' and 'dismissed' update the status and set feedbackAt for cooldown.
	 */
	async recordFeedback(
		id: string,
		feedback: SuggestionFeedback,
	): Promise<{ success: boolean; suggestion: BuddySuggestion }> {
		const entity = await this.suggestionRepo.findOne({ where: { id } });

		if (!entity) {
			throw new BuddySuggestionNotFoundException(id);
		}

		// Reject feedback on already-processed suggestions to prevent duplicate side-effects
		if (entity.status !== SuggestionStatus.ACTIVE) {
			throw new BuddySuggestionNotFoundException(id);
		}

		entity.status = feedback === SuggestionFeedback.APPLIED ? SuggestionStatus.ACCEPTED : SuggestionStatus.DISMISSED;
		entity.feedbackAt = new Date();

		await this.suggestionRepo.save(entity);

		this.logger.debug(`Feedback "${feedback}" recorded for suggestion id=${id}`);

		return { success: true, suggestion: this.entityToSuggestion(entity) };
	}

	/**
	 * Create suggestions from heartbeat evaluator results.
	 */
	async createFromEvaluatorResults(results: EvaluatorResult[]): Promise<BuddySuggestion[]> {
		const created: BuddySuggestion[] = [];

		for (const result of results) {
			if (await this.isOnCooldown(result.spaceId, result.type)) {
				continue;
			}

			if (await this.hasDuplicateSuggestion(result.spaceId, result.type, result.metadata)) {
				continue;
			}

			const entity = this.suggestionRepo.create({
				id: uuid(),
				type: result.type,
				title: result.title,
				reason: result.reason,
				spaceId: result.spaceId,
				metadata: result.metadata,
				status: SuggestionStatus.ACTIVE,
				expiresAt: new Date(Date.now() + SUGGESTION_EXPIRY_MS),
				feedbackAt: null,
			});

			await this.suggestionRepo.save(entity);

			const suggestion = this.entityToSuggestion(entity);

			created.push(suggestion);

			this.eventEmitter.emit(EventType.SUGGESTION_CREATED, suggestion);

			this.logger.debug(`Created suggestion from evaluator id=${suggestion.id}: "${suggestion.reason}"`);
		}

		return created;
	}

	/**
	 * Check if a non-expired active duplicate suggestion exists.
	 */
	private async hasDuplicateSuggestion(
		spaceId: string,
		type: SuggestionType,
		metadata: Record<string, unknown>,
	): Promise<boolean> {
		const now = new Date();

		const candidates = await this.suggestionRepo.find({
			where: {
				spaceId,
				type,
				status: SuggestionStatus.ACTIVE,
				expiresAt: MoreThan(now),
			},
		});

		for (const suggestion of candidates) {
			if (type === SuggestionType.PATTERN_SCENE_CREATE) {
				const meta = suggestion.metadata ?? {};

				if (meta.intentType !== undefined && meta.intentType === metadata.intentType) {
					return true;
				}

				if (meta.sequenceHash !== undefined && meta.sequenceHash === metadata.sequenceHash) {
					return true;
				}

				continue;
			}

			return true;
		}

		return false;
	}

	/**
	 * Check if a non-expired active suggestion exists for a given pattern.
	 */
	private async hasSuggestionForPattern(pattern: DetectedPattern): Promise<boolean> {
		const now = new Date();

		const candidates = await this.suggestionRepo.find({
			where: {
				spaceId: pattern.spaceId,
				status: SuggestionStatus.ACTIVE,
				expiresAt: MoreThan(now),
			},
		});

		return candidates.some((s) => s.metadata && s.metadata.intentType === pattern.intentType);
	}

	/**
	 * Mark expired suggestions in the database.
	 */
	private async cleanupExpired(): Promise<void> {
		const now = new Date();

		const result = await this.suggestionRepo.update(
			{ status: SuggestionStatus.ACTIVE, expiresAt: LessThanOrEqual(now) },
			{ status: SuggestionStatus.EXPIRED },
		);

		if (result.affected && result.affected > 0) {
			this.logger.debug(`Expired ${result.affected} suggestion(s)`);
		}
	}

	private async resolveSpaceName(spaceId: string): Promise<string> {
		try {
			const space = await this.spacesService.findOne(spaceId);

			return space?.name ?? 'unknown space';
		} catch {
			return 'unknown space';
		}
	}

	private entityToSuggestion(entity: BuddySuggestionEntity): BuddySuggestion {
		return {
			id: entity.id,
			type: entity.type,
			title: entity.title,
			reason: entity.reason,
			spaceId: entity.spaceId,
			metadata: entity.metadata ?? {},
			createdAt: entity.createdAt,
			expiresAt: entity.expiresAt,
		};
	}
}

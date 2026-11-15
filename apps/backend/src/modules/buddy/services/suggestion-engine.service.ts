import { In, LessThanOrEqual, MoreThan, Repository } from 'typeorm';
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
	PATTERN_LOOKBACK_DAYS,
	SUGGESTION_CLEANUP_INTERVAL_MS,
	SUGGESTION_COOLDOWN_MS,
	SUGGESTION_EXPIRY_MS,
	SuggestionType,
} from '../buddy.constants';
import { BuddySuggestionNotFoundException } from '../buddy.exceptions';
import { BuddySuggestionEntity, SuggestionStatus } from '../entities/buddy-suggestion.entity';

import { EvaluatorResult } from './heartbeat.types';
import { DetectedPattern, PatternDetectorService, patternToEvaluatorResult } from './pattern-detector.service';

/**
 * Suggestions that can be applied in the admin only: the draft they carry opens in the automation editor. They are
 * not announced with `EventType.SUGGESTION_CREATED`, whose listeners (the panel, the messaging channels) offer
 * an "accept" that could not do anything with them; the admin reads them from the suggestion list.
 */
export const ADMIN_ONLY_SUGGESTION_TYPES: ReadonlySet<SuggestionType> = new Set([
	SuggestionType.PATTERN_AUTOMATION_CREATE,
]);

/** Suggestions about a routine: a new one is a duplicate only when it is about the same routine */
const ROUTINE_SUGGESTION_TYPES: ReadonlySet<SuggestionType> = new Set([
	SuggestionType.PATTERN_SCENE_CREATE,
	SuggestionType.PATTERN_AUTOMATION_CREATE,
]);

/** Whether two routine suggestions are about the same routine, by the key their metadata carries */
export const isSameRoutine = (a: Record<string, unknown>, b: Record<string, unknown>): boolean =>
	(a.intentType !== undefined && a.intentType === b.intentType) ||
	(a.sequenceHash !== undefined && a.sequenceHash === b.sequenceHash);

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

	/**
	 * Serialization queue for suggestion creation.
	 * Both generateSuggestions and createFromEvaluatorResults acquire this
	 * so their check-then-insert sequences cannot interleave.
	 */
	private mutexTail: Promise<void> = Promise.resolve();

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
	 * Cooldown is derived from the most recent accepted/dismissed suggestion's feedbackAt.
	 */
	async isOnCooldown(spaceId: string, type: SuggestionType, now?: number): Promise<boolean> {
		const cutoff = new Date((now ?? Date.now()) - SUGGESTION_COOLDOWN_MS);

		const recent = await this.suggestionRepo.findOne({
			where: {
				spaceId,
				type,
				status: In([SuggestionStatus.ACCEPTED, SuggestionStatus.DISMISSED]),
				feedbackAt: MoreThan(cutoff),
			},
			order: { feedbackAt: 'DESC' },
		});

		return recent !== null;
	}

	/**
	 * Serialize an async operation so check-then-insert sequences cannot interleave.
	 */
	private withMutex<T>(fn: () => Promise<T>): Promise<T> {
		const ticket = this.mutexTail.then(fn, fn);

		// Keep the queue moving regardless of success/failure
		this.mutexTail = ticket.then(
			() => {},
			() => {},
		);

		return ticket;
	}

	/**
	 * Generate suggestions from detected patterns.
	 * Uses a Promise-based lock to prevent concurrent generation,
	 * and a shared mutex to serialize against heartbeat evaluator results.
	 */
	async generateSuggestions(): Promise<BuddySuggestion[]> {
		if (this.generationPromise !== null) {
			return this.generationPromise;
		}

		this.generationPromise = this.withMutex(() => this.doGenerateSuggestions()).finally(() => {
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

		// Prefetch all recent feedback rows to check cooldowns in one query (avoids N+1)
		const cooldownKeys = await this.getCooldownKeys(now);

		const filtered = entities.filter((e) => !cooldownKeys.has(`${e.spaceId}:${e.type}`));

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
	 * Serialized via the shared mutex to prevent TOCTOU races on concurrent requests.
	 */
	async recordFeedback(
		id: string,
		feedback: SuggestionFeedback,
	): Promise<{ success: boolean; suggestion: BuddySuggestion }> {
		return this.withMutex(async () => {
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
		});
	}

	/**
	 * Create suggestions from heartbeat evaluator results.
	 * Serialized via the shared mutex to prevent duplicates when overlapping with generateSuggestions.
	 */
	async createFromEvaluatorResults(results: EvaluatorResult[]): Promise<BuddySuggestion[]> {
		return this.withMutex(() => this.doCreateFromEvaluatorResults(results));
	}

	private async doCreateFromEvaluatorResults(results: EvaluatorResult[]): Promise<BuddySuggestion[]> {
		const created: BuddySuggestion[] = [];

		for (const result of results) {
			if (await this.isOnCooldown(result.spaceId, result.type)) {
				continue;
			}

			if (await this.hasDuplicateSuggestion(result.spaceId, result.type, result.metadata)) {
				continue;
			}

			if (await this.hasAnsweredRoutine(result.spaceId, result.type, result.metadata)) {
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

			if (!ADMIN_ONLY_SUGGESTION_TYPES.has(suggestion.type)) {
				this.eventEmitter.emit(EventType.SUGGESTION_CREATED, suggestion);
			}

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
			if (ROUTINE_SUGGESTION_TYPES.has(type)) {
				if (isSameRoutine(suggestion.metadata ?? {}, metadata)) {
					return true;
				}

				continue;
			}

			return true;
		}

		return false;
	}

	/**
	 * Whether an automation was already offered for this routine and accepted or dismissed while the routine can
	 * still be seen in the action history. Accepted, the automation exists; dismissed, the administrator said no.
	 * Either way, offering it again once the cooldown is over would only repeat the question.
	 */
	private async hasAnsweredRoutine(
		spaceId: string,
		type: SuggestionType,
		metadata: Record<string, unknown>,
	): Promise<boolean> {
		if (type !== SuggestionType.PATTERN_AUTOMATION_CREATE) {
			return false;
		}

		const answered = await this.suggestionRepo.find({
			where: {
				spaceId,
				type,
				status: In([SuggestionStatus.ACCEPTED, SuggestionStatus.DISMISSED]),
				feedbackAt: MoreThan(new Date(Date.now() - PATTERN_LOOKBACK_DAYS * 24 * 60 * 60 * 1000)),
			},
		});

		return answered.some((suggestion) => isSameRoutine(suggestion.metadata ?? {}, metadata));
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

		// An automation offered for the same routine is a suggestion of another kind: the scene is still offered
		return candidates.some(
			(s) =>
				s.type !== SuggestionType.PATTERN_AUTOMATION_CREATE &&
				s.metadata &&
				s.metadata.intentType === pattern.intentType,
		);
	}

	/**
	 * Fetch all spaceId+type combos that are currently on cooldown in a single query.
	 */
	private async getCooldownKeys(now: Date): Promise<Set<string>> {
		const cutoff = new Date(now.getTime() - SUGGESTION_COOLDOWN_MS);

		const recentFeedback = await this.suggestionRepo.find({
			where: {
				status: In([SuggestionStatus.ACCEPTED, SuggestionStatus.DISMISSED]),
				feedbackAt: MoreThan(cutoff),
			},
			select: ['spaceId', 'type'],
		});

		return new Set(recentFeedback.map((r) => `${r.spaceId}:${r.type}`));
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

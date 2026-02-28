import { v4 as uuid } from 'uuid';

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { CooldownManager } from '../../../common/utils/cooldown-manager';
import { SpacesService } from '../../spaces/services/spaces.service';
import { SuggestionFeedback } from '../../spaces/spaces.constants';
import {
	EventType,
	SUGGESTION_CLEANUP_INTERVAL_MS,
	SUGGESTION_COOLDOWN_MS,
	SUGGESTION_EXPIRY_MS,
	SuggestionType,
} from '../buddy.constants';
import { BuddySuggestionNotFoundException } from '../buddy.exceptions';
import { formatIntentLabel, formatTimeLabel } from '../buddy.utils';

import { EvaluatorResult } from './heartbeat.types';
import { DetectedPattern, PatternDetectorService } from './pattern-detector.service';

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

export const buddyCooldowns = new CooldownManager<SuggestionType>();

@Injectable()
export class SuggestionEngineService implements OnModuleDestroy {
	private readonly logger = new Logger(SuggestionEngineService.name);
	private readonly suggestions = new Map<string, BuddySuggestion>();
	private cleanupTimer: ReturnType<typeof setInterval> | null = null;
	private generating = false;

	constructor(
		private readonly patternDetector: PatternDetectorService,
		private readonly spacesService: SpacesService,
		private readonly eventEmitter: EventEmitter2,
	) {
		this.cleanupTimer = setInterval(() => this.cleanupExpired(), SUGGESTION_CLEANUP_INTERVAL_MS);
	}

	onModuleDestroy(): void {
		if (this.cleanupTimer) {
			clearInterval(this.cleanupTimer);
			this.cleanupTimer = null;
		}
	}

	/**
	 * Generate suggestions from detected patterns.
	 * Creates new suggestions for patterns that are not on cooldown.
	 * Uses a lock to prevent concurrent calls from creating duplicate suggestions.
	 */
	async generateSuggestions(): Promise<BuddySuggestion[]> {
		if (this.generating) {
			return [];
		}

		this.generating = true;

		try {
			return await this.doGenerateSuggestions();
		} finally {
			this.generating = false;
		}
	}

	private async doGenerateSuggestions(): Promise<BuddySuggestion[]> {
		const patterns = this.patternDetector.detectPatterns();
		const newSuggestions: BuddySuggestion[] = [];

		for (const pattern of patterns) {
			if (buddyCooldowns.isOnCooldown(pattern.spaceId, SuggestionType.PATTERN_SCENE_CREATE)) {
				continue;
			}

			if (this.hasSuggestionForPattern(pattern)) {
				continue;
			}

			const spaceName = await this.resolveSpaceName(pattern.spaceId);
			const intentLabel = formatIntentLabel(pattern.intentType);
			const timeLabel = formatTimeLabel(pattern.timeOfDay.hour, pattern.timeOfDay.minute);

			// Re-check after async gap to prevent duplicates
			if (this.hasSuggestionForPattern(pattern)) {
				continue;
			}

			const suggestion: BuddySuggestion = {
				id: uuid(),
				type: SuggestionType.PATTERN_SCENE_CREATE,
				title: 'Create a scene for this?',
				reason: `You ${intentLabel} in ${spaceName} around ${timeLabel} regularly`,
				spaceId: pattern.spaceId,
				metadata: {
					intentType: pattern.intentType,
					timeOfDay: pattern.timeOfDay,
					occurrences: pattern.occurrences,
					confidence: pattern.confidence,
				},
				createdAt: new Date(),
				expiresAt: new Date(Date.now() + SUGGESTION_EXPIRY_MS),
			};

			this.suggestions.set(suggestion.id, suggestion);
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
	getActiveSuggestions(spaceId?: string): BuddySuggestion[] {
		const now = Date.now();
		const active: BuddySuggestion[] = [];

		for (const suggestion of this.suggestions.values()) {
			if (suggestion.expiresAt.getTime() <= now) {
				continue;
			}

			if (buddyCooldowns.isOnCooldown(suggestion.spaceId, suggestion.type, now)) {
				continue;
			}

			if (spaceId && suggestion.spaceId !== spaceId) {
				continue;
			}

			active.push(suggestion);
		}

		return active.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
	}

	/**
	 * Get a suggestion by ID.
	 */
	getSuggestionOrThrow(id: string): BuddySuggestion {
		const suggestion = this.suggestions.get(id);

		if (!suggestion) {
			throw new BuddySuggestionNotFoundException(id);
		}

		return suggestion;
	}

	/**
	 * Record feedback for a suggestion.
	 * Both 'applied' and 'dismissed' set a cooldown to prevent re-showing.
	 */
	recordFeedback(id: string, feedback: SuggestionFeedback): { success: boolean } {
		const suggestion = this.getSuggestionOrThrow(id);

		buddyCooldowns.setCooldown(suggestion.spaceId, suggestion.type, SUGGESTION_COOLDOWN_MS);
		this.suggestions.delete(id);

		this.logger.debug(`Feedback "${feedback}" recorded for suggestion id=${id}, cooldown set`);

		return { success: true };
	}

	/**
	 * Create suggestions from heartbeat evaluator results.
	 * Applies cooldown and duplicate checking before creating each suggestion.
	 */
	createFromEvaluatorResults(results: EvaluatorResult[]): BuddySuggestion[] {
		const created: BuddySuggestion[] = [];

		for (const result of results) {
			if (buddyCooldowns.isOnCooldown(result.spaceId, result.type)) {
				continue;
			}

			if (this.hasDuplicateSuggestion(result.spaceId, result.type, result.metadata)) {
				continue;
			}

			const suggestion: BuddySuggestion = {
				id: uuid(),
				type: result.type,
				title: result.title,
				reason: result.reason,
				spaceId: result.spaceId,
				metadata: result.metadata,
				createdAt: new Date(),
				expiresAt: new Date(Date.now() + SUGGESTION_EXPIRY_MS),
			};

			this.suggestions.set(suggestion.id, suggestion);
			created.push(suggestion);

			this.eventEmitter.emit(EventType.SUGGESTION_CREATED, suggestion);

			this.logger.debug(`Created suggestion from evaluator id=${suggestion.id}: "${suggestion.reason}"`);
		}

		return created;
	}

	/**
	 * Check if a non-expired duplicate suggestion already exists (same type + space + metadata match).
	 */
	private hasDuplicateSuggestion(spaceId: string, type: SuggestionType, metadata: Record<string, unknown>): boolean {
		const now = Date.now();

		for (const suggestion of this.suggestions.values()) {
			if (suggestion.expiresAt.getTime() <= now) {
				continue;
			}

			if (suggestion.spaceId === spaceId && suggestion.type === type) {
				if (type === SuggestionType.PATTERN_SCENE_CREATE && suggestion.metadata.intentType === metadata.intentType) {
					return true;
				}

				if (type !== SuggestionType.PATTERN_SCENE_CREATE) {
					return true;
				}
			}
		}

		return false;
	}

	/**
	 * Check if a non-expired suggestion already exists for a given pattern (same intent type + space).
	 */
	private hasSuggestionForPattern(pattern: DetectedPattern): boolean {
		const now = Date.now();

		for (const suggestion of this.suggestions.values()) {
			if (suggestion.expiresAt.getTime() <= now) {
				continue;
			}

			if (suggestion.spaceId === pattern.spaceId && suggestion.metadata.intentType === pattern.intentType) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Remove expired suggestions.
	 */
	private cleanupExpired(): void {
		const now = Date.now();
		let removed = 0;

		for (const [id, suggestion] of this.suggestions) {
			if (suggestion.expiresAt.getTime() <= now) {
				this.suggestions.delete(id);
				removed++;
			}
		}

		if (removed > 0) {
			this.logger.debug(`Cleaned up ${removed} expired suggestion(s)`);
		}
	}

	/**
	 * Resolve a space ID to a human-readable name.
	 */
	private async resolveSpaceName(spaceId: string): Promise<string> {
		try {
			const space = await this.spacesService.findOne(spaceId);

			return space?.name ?? 'unknown space';
		} catch {
			return 'unknown space';
		}
	}
}

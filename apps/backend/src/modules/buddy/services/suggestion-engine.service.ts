import { v4 as uuid } from 'uuid';

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { EventType } from '../buddy.constants';

import { DetectedPattern, PatternDetectorService } from './pattern-detector.service';

export enum BuddySuggestionType {
	PATTERN_SCENE_CREATE = 'pattern_scene_create',
	LIGHTING_OPTIMISE = 'lighting_optimise',
	GENERAL_TIP = 'general_tip',
}

export enum SuggestionFeedback {
	APPLIED = 'applied',
	DISMISSED = 'dismissed',
}

export interface BuddySuggestion {
	id: string;
	type: BuddySuggestionType;
	title: string;
	reason: string;
	spaceId: string | null;
	metadata: Record<string, unknown>;
	createdAt: Date;
	expiresAt: Date;
}

const DEFAULT_COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours
const SUGGESTION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const CLEANUP_INTERVAL_MS = 60 * 1000; // 60 seconds

@Injectable()
export class SuggestionEngineService implements OnModuleDestroy {
	private readonly logger = new Logger(SuggestionEngineService.name);
	private readonly suggestions = new Map<string, BuddySuggestion>();
	private readonly cooldowns = new Map<string, number>();
	private cleanupTimer: NodeJS.Timeout | null = null;

	constructor(
		private readonly patternDetector: PatternDetectorService,
		private readonly eventEmitter: EventEmitter2,
	) {
		this.cleanupTimer = setInterval(() => this.cleanupExpired(), CLEANUP_INTERVAL_MS);
	}

	onModuleDestroy(): void {
		if (this.cleanupTimer) {
			clearInterval(this.cleanupTimer);
			this.cleanupTimer = null;
		}
	}

	async generateSuggestions(): Promise<BuddySuggestion[]> {
		const patterns = await this.patternDetector.detectPatterns();
		const created: BuddySuggestion[] = [];

		for (const pattern of patterns) {
			if (pattern.confidence < 0.6) {
				continue;
			}

			const suggestion = this.createSuggestionFromPattern(pattern);

			if (!suggestion) {
				continue;
			}

			// Check cooldown
			if (this.isOnCooldown(suggestion.spaceId, suggestion.type)) {
				continue;
			}

			this.suggestions.set(suggestion.id, suggestion);
			created.push(suggestion);

			this.eventEmitter.emit(EventType.SUGGESTION_CREATED, {
				id: suggestion.id,
				type: suggestion.type,
				title: suggestion.title,
				reason: suggestion.reason,
				space_id: suggestion.spaceId,
				created_at: suggestion.createdAt.toISOString(),
				expires_at: suggestion.expiresAt.toISOString(),
			});
		}

		if (created.length > 0) {
			this.logger.debug(`Generated ${String(created.length)} suggestions from ${String(patterns.length)} patterns`);
		}

		return created;
	}

	getActiveSuggestions(spaceId?: string): BuddySuggestion[] {
		const now = Date.now();
		const active: BuddySuggestion[] = [];

		for (const suggestion of this.suggestions.values()) {
			if (suggestion.expiresAt.getTime() < now) {
				continue;
			}

			if (spaceId && suggestion.spaceId !== spaceId) {
				continue;
			}

			if (this.isOnCooldown(suggestion.spaceId, suggestion.type)) {
				continue;
			}

			active.push(suggestion);
		}

		return active;
	}

	findSuggestion(id: string): BuddySuggestion | undefined {
		return this.suggestions.get(id);
	}

	recordFeedback(id: string, feedback: SuggestionFeedback): boolean {
		const suggestion = this.suggestions.get(id);

		if (!suggestion) {
			return false;
		}

		this.setCooldown(suggestion.spaceId, suggestion.type);
		this.suggestions.delete(id);

		this.logger.debug(`Feedback recorded for suggestion id=${id}: ${feedback}`);

		return true;
	}

	private createSuggestionFromPattern(pattern: DetectedPattern): BuddySuggestion | null {
		const now = new Date();
		const expiresAt = new Date(now.getTime() + SUGGESTION_TTL_MS);
		const timeStr = `${String(pattern.timeOfDay.hour).padStart(2, '0')}:${String(pattern.timeOfDay.minute).padStart(2, '0')}`;

		return {
			id: uuid(),
			type: BuddySuggestionType.PATTERN_SCENE_CREATE,
			title: 'Create a scene for this?',
			reason: `You perform "${pattern.intentType}" in ${pattern.spaceName} around ${timeStr} regularly (${String(pattern.occurrences)} times).`,
			spaceId: pattern.spaceId,
			metadata: {
				intentType: pattern.intentType,
				occurrences: pattern.occurrences,
				confidence: pattern.confidence,
				timeOfDay: pattern.timeOfDay,
				firstSeen: pattern.firstSeen.toISOString(),
				lastSeen: pattern.lastSeen.toISOString(),
			},
			createdAt: now,
			expiresAt,
		};
	}

	private isOnCooldown(spaceId: string | null, suggestionType: BuddySuggestionType): boolean {
		const key = `${spaceId ?? 'global'}:${suggestionType}`;
		const cooldownUntil = this.cooldowns.get(key);

		if (!cooldownUntil) {
			return false;
		}

		return Date.now() < cooldownUntil;
	}

	private setCooldown(
		spaceId: string | null,
		suggestionType: BuddySuggestionType,
		durationMs: number = DEFAULT_COOLDOWN_MS,
	): void {
		const key = `${spaceId ?? 'global'}:${suggestionType}`;

		this.cooldowns.set(key, Date.now() + durationMs);
	}

	private cleanupExpired(): void {
		const now = Date.now();
		let removed = 0;

		for (const [id, suggestion] of this.suggestions) {
			if (suggestion.expiresAt.getTime() < now) {
				this.suggestions.delete(id);
				removed++;
			}
		}

		if (removed > 0) {
			this.logger.debug(`Cleaned up ${String(removed)} expired suggestions`);
		}
	}
}

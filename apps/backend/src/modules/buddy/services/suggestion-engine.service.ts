import { v4 as uuid } from 'uuid';

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

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

/**
 * In-memory cooldown storage (per space + suggestion type)
 */
const suggestionCooldowns = new Map<string, number>();

function getCooldownKey(spaceId: string, suggestionType: SuggestionType): string {
	return `${spaceId}:${suggestionType}`;
}

export function isOnCooldown(spaceId: string, suggestionType: SuggestionType, now: number = Date.now()): boolean {
	const key = getCooldownKey(spaceId, suggestionType);
	const cooldownUntil = suggestionCooldowns.get(key);

	if (!cooldownUntil) {
		return false;
	}

	return now < cooldownUntil;
}

export function setCooldown(
	spaceId: string,
	suggestionType: SuggestionType,
	durationMs: number = SUGGESTION_COOLDOWN_MS,
	now: number = Date.now(),
): void {
	const key = getCooldownKey(spaceId, suggestionType);
	suggestionCooldowns.set(key, now + durationMs);
}

export function clearCooldown(spaceId: string, suggestionType: SuggestionType): void {
	const key = getCooldownKey(spaceId, suggestionType);
	suggestionCooldowns.delete(key);
}

export function clearAllCooldowns(): void {
	suggestionCooldowns.clear();
}

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
			if (isOnCooldown(pattern.spaceId, SuggestionType.PATTERN_SCENE_CREATE)) {
				continue;
			}

			if (this.hasSuggestionForPattern(pattern)) {
				continue;
			}

			const spaceName = await this.resolveSpaceName(pattern.spaceId);
			const intentLabel = this.formatIntentType(pattern.intentType);
			const timeLabel = this.formatTime(pattern.timeOfDay.hour, pattern.timeOfDay.minute);

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

			if (isOnCooldown(suggestion.spaceId, suggestion.type, now)) {
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

		setCooldown(suggestion.spaceId, suggestion.type);
		this.suggestions.delete(id);

		this.logger.debug(`Feedback "${feedback}" recorded for suggestion id=${id}, cooldown set`);

		return { success: true };
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

	/**
	 * Convert an intent type enum value to a human-readable action label.
	 */
	private formatIntentType(intentType: string): string {
		const labels: Record<string, string> = {
			'light.toggle': 'toggle lights',
			'light.setBrightness': 'adjust brightness',
			'light.setColor': 'change light color',
			'light.setColorTemp': 'change color temperature',
			'light.setWhite': 'set white light',
			'device.setProperty': 'adjust a device',
			'scene.run': 'run a scene',
			'space.lighting.on': 'turn on lights',
			'space.lighting.off': 'turn off lights',
			'space.lighting.setMode': 'change lighting mode',
			'space.climate.setMode': 'change climate mode',
			'space.climate.setpointSet': 'adjust thermostat',
			'space.covers.open': 'open covers',
			'space.covers.close': 'close covers',
		};

		return labels[intentType] ?? intentType;
	}

	/**
	 * Format a time-of-day into a readable string like "11 PM" or "2:30 PM".
	 */
	private formatTime(hour: number, minute: number): string {
		const period = hour >= 12 ? 'PM' : 'AM';
		const displayHour = hour % 12 || 12;

		if (minute === 0) {
			return `${displayHour} ${period}`;
		}

		return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
	}
}

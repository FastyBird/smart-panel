import { v4 as uuid } from 'uuid';

import { Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SchedulerRegistry } from '@nestjs/schedule';

import { createExtensionLogger } from '../../../common/logger';
import { SpacesService } from '../../../modules/spaces/services/spaces.service';
import { SPACES_MODULE_NAME } from '../../../modules/spaces/spaces.constants';
import {
	EventType,
	SUGGESTION_COOLDOWN_MS,
	SUGGESTION_EXPIRY_MS,
	SUGGESTION_HEARTBEAT_INTERVAL_MS,
	SuggestionType,
} from '../spaces-home-control.constants';

import {
	type EmittedSuggestionEntry,
	SpaceSuggestionService,
	lastEmittedSuggestions,
	spaceCooldowns,
} from './space-suggestion.service';

const HEARTBEAT_INTERVAL_NAME = 'spaceSuggestionHeartbeat';

export interface SpaceSuggestionEvent {
	id: string;
	type: SuggestionType;
	title: string;
	reason: string | null;
	intent_type: string;
	intent_mode: string | null;
	space_id: string;
	created_at: string;
	expires_at: string;
}

@Injectable()
export class SpaceSuggestionHeartbeatService implements OnApplicationBootstrap, OnModuleDestroy {
	private readonly logger = createExtensionLogger(SPACES_MODULE_NAME, 'SpaceSuggestionHeartbeatService');
	private running = false;

	constructor(
		private readonly schedulerRegistry: SchedulerRegistry,
		private readonly spacesService: SpacesService,
		private readonly suggestionService: SpaceSuggestionService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	onApplicationBootstrap(): void {
		const intervalId = setInterval(() => void this.runCycle(), SUGGESTION_HEARTBEAT_INTERVAL_MS);

		// Allow the Node.js process to exit even if the interval is still active
		if (typeof intervalId === 'object' && 'unref' in intervalId) {
			intervalId.unref();
		}

		this.schedulerRegistry.addInterval(HEARTBEAT_INTERVAL_NAME, intervalId);

		this.logger.log(`Space suggestion heartbeat started with interval=${SUGGESTION_HEARTBEAT_INTERVAL_MS}ms`);
	}

	onModuleDestroy(): void {
		try {
			this.schedulerRegistry.deleteInterval(HEARTBEAT_INTERVAL_NAME);
		} catch {
			// Interval may not exist if bootstrap didn't complete
		}
	}

	/**
	 * Execute a single heartbeat cycle:
	 * 1. Find spaces with suggestionsEnabled
	 * 2. Evaluate suggestion rules per space
	 * 3. Emit WebSocket events for new suggestions
	 */
	async runCycle(): Promise<void> {
		if (this.running) {
			this.logger.debug('Suggestion heartbeat cycle already running, skipping');

			return;
		}

		this.running = true;

		try {
			const spaces = await this.spacesService.findAll();
			const enabledSpaces = spaces.filter((s) => s.suggestionsEnabled);

			if (enabledSpaces.length === 0) {
				return;
			}

			let totalSuggestions = 0;

			for (const space of enabledSpaces) {
				try {
					const suggestion = await this.suggestionService.getSuggestion(space.id);

					if (suggestion === null) {
						// Only clear the tracker if the null is because conditions
						// genuinely changed (no rule matches), not because the
						// suggestion is still on cooldown. Otherwise the tracker
						// gets wiped during the cooldown window and the same
						// suggestion re-fires once the cooldown expires.
						const entry = lastEmittedSuggestions.get(space.id);

						if (!entry || !spaceCooldowns.isOnCooldown(space.id, entry.type)) {
							lastEmittedSuggestions.delete(space.id);
						}

						continue;
					}

					// Check cooldown (getSuggestion already checks, but guard against race)
					if (spaceCooldowns.isOnCooldown(space.id, suggestion.type)) {
						continue;
					}

					const entry: EmittedSuggestionEntry | undefined = lastEmittedSuggestions.get(space.id);

					if (entry && entry.type === suggestion.type) {
						// User explicitly dismissed/applied — don't re-emit while
						// conditions remain the same.
						if (entry.dismissed) {
							continue;
						}

						// User missed it — only re-emit after the expiry window
						// so the suggestion can reappear if the user wasn't around.
						if (Date.now() - entry.emittedAt < SUGGESTION_EXPIRY_MS) {
							continue;
						}
					}

					// Set cooldown to prevent re-emitting on next cycle
					spaceCooldowns.setCooldown(space.id, suggestion.type, SUGGESTION_COOLDOWN_MS);

					// Record emission with timestamp
					lastEmittedSuggestions.set(space.id, {
						type: suggestion.type,
						emittedAt: Date.now(),
						dismissed: false,
					});

					const event: SpaceSuggestionEvent = {
						id: uuid(),
						type: suggestion.type,
						title: suggestion.title,
						reason: suggestion.reason,
						intent_type: suggestion.intentType,
						intent_mode: suggestion.intentMode,
						space_id: space.id,
						created_at: new Date().toISOString(),
						expires_at: new Date(Date.now() + SUGGESTION_EXPIRY_MS).toISOString(),
					};

					this.eventEmitter.emit(EventType.SUGGESTION_CREATED, event);

					totalSuggestions++;

					this.logger.debug(`Suggestion emitted for space id=${space.id} type=${suggestion.type}`);
				} catch (error) {
					const err = error as Error;

					this.logger.warn(`Failed to evaluate space id=${space.id}: ${err.message}`);
				}
			}

			if (totalSuggestions > 0) {
				this.logger.debug(`Suggestion heartbeat complete: ${totalSuggestions} suggestion(s) emitted`);
			}
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Suggestion heartbeat cycle failed: ${err.message}`, { stack: err.stack });
		} finally {
			this.running = false;
		}
	}
}

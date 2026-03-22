import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { IntentType } from '../../intents/intents.constants';
import {
	BUDDY_MODULE_NAME,
	PATTERN_LOOKBACK_DAYS,
	PATTERN_MIN_OCCURRENCES,
	PATTERN_TIME_WINDOW_MINUTES,
	SuggestionType,
} from '../buddy.constants';
import { clusterByTimeOfDay, formatIntentLabel, formatTimeLabel, interpolateTemplate } from '../buddy.utils';
import { EvaluatorRulesLoaderService } from '../spec/evaluator-rules-loader.service';

import { ActionObserverService, ActionRecord, ActionTarget } from './action-observer.service';
import { BuddyContext } from './buddy-context.service';
import { EvaluatorResult, HeartbeatEvaluator } from './heartbeat.types';

export interface DetectedPattern {
	intentType: IntentType;
	spaceId: string;
	timeOfDay: { hour: number; minute: number };
	occurrences: number;
	confidence: number;
	firstSeen: Date;
	lastSeen: Date;
	/** Targets from the most recent action — used to populate scene actions. */
	latestTargets?: ActionTarget[];
	/** Value from the most recent action. */
	latestValue?: unknown;
}

interface ActionGroup {
	intentType: IntentType;
	spaceId: string;
	actions: ActionRecord[];
}

interface TimeCluster {
	actions: ActionRecord[];
	avgHour: number;
	avgMinute: number;
}

/**
 * Convert a detected pattern + resolved space name into a heartbeat evaluator result.
 * Single source of truth for the pattern → suggestion mapping (type, title, reason, metadata).
 */
export function patternToEvaluatorResult(
	pattern: DetectedPattern,
	spaceName: string,
	rule?: { suggestionType: SuggestionType; messages: { title: string; reason: string } },
): EvaluatorResult {
	const intentLabel = formatIntentLabel(pattern.intentType);
	const timeLabel = formatTimeLabel(pattern.timeOfDay.hour, pattern.timeOfDay.minute);

	return {
		type: rule?.suggestionType ?? SuggestionType.PATTERN_SCENE_CREATE,
		title: rule?.messages.title ?? 'Create a scene for this?',
		reason: rule
			? interpolateTemplate(rule.messages.reason, { intentLabel, spaceName, timeLabel })
			: `You ${intentLabel} in ${spaceName} around ${timeLabel} regularly`,
		spaceId: pattern.spaceId,
		metadata: {
			intentType: pattern.intentType,
			timeOfDay: pattern.timeOfDay,
			occurrences: pattern.occurrences,
			confidence: pattern.confidence,
			actions: (pattern.latestTargets ?? [])
				.filter((t) => t.propertyId)
				.map((t) => ({
					deviceId: t.deviceId,
					channelId: t.channelId,
					propertyId: t.propertyId,
					value: pattern.latestValue,
				})),
		},
	};
}

@Injectable()
export class PatternDetectorService implements HeartbeatEvaluator {
	readonly name = 'PatternDetector';
	private readonly logger = createExtensionLogger(BUDDY_MODULE_NAME, 'PatternDetectorService');
	private static readonly CACHE_TTL_MS = 5000;
	private patternCache: DetectedPattern[] | null = null;
	private patternCacheTime = 0;

	constructor(
		private readonly actionObserver: ActionObserverService,
		private readonly rulesLoader: EvaluatorRulesLoaderService,
	) {}

	/**
	 * HeartbeatEvaluator implementation.
	 * Detects patterns filtered to the space in the provided context.
	 * Uses a short TTL cache so that a heartbeat cycle evaluating N spaces
	 * only runs the full pattern scan once.
	 */
	evaluate(context: BuddyContext): Promise<EvaluatorResult[]> {
		const rule = this.rulesLoader.getPatternRule('single_pattern');

		if (rule && !rule.enabled) {
			return Promise.resolve<EvaluatorResult[]>([]);
		}

		const patterns = this.getPatternsCached();
		const spaceIds = new Set(context.spaces.map((s) => s.id));

		const results = patterns
			.filter((p) => spaceIds.has(p.spaceId))
			.map((p) => {
				const spaceName = context.spaces.find((s) => s.id === p.spaceId)?.name ?? 'unknown space';

				return patternToEvaluatorResult(p, spaceName, rule);
			});

		return Promise.resolve(results);
	}

	/**
	 * Analyse the action history buffer and detect repeated patterns.
	 * Groups actions by (intentType, spaceId), then clusters by time-of-day
	 * within a configurable window. Returns patterns with confidence scores.
	 */
	detectPatterns(): DetectedPattern[] {
		const rule = this.rulesLoader.getPatternRule('single_pattern');

		const lookbackDays = rule?.thresholds.lookback_days ?? PATTERN_LOOKBACK_DAYS;
		const minOccurrences = rule?.thresholds.min_occurrences ?? PATTERN_MIN_OCCURRENCES;
		const timeWindowMinutes = rule?.thresholds.time_window_minutes ?? PATTERN_TIME_WINDOW_MINUTES;

		const actions = this.actionObserver.getRecentActions();
		const cutoff = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
		const recentActions = actions.filter((a) => a.timestamp >= cutoff && a.spaceId !== null);

		if (recentActions.length === 0) {
			return [];
		}

		const groups = this.groupActions(recentActions);
		const patterns: DetectedPattern[] = [];

		for (const group of groups) {
			const clusters = this.clusterActions(group.actions, timeWindowMinutes);

			for (const cluster of clusters) {
				if (cluster.actions.length >= minOccurrences) {
					const confidence = Math.min(1, cluster.actions.length / lookbackDays);
					const timestamps = cluster.actions.map((a) => a.timestamp.getTime());
					const latestAction = cluster.actions.reduce((a, b) => (a.timestamp > b.timestamp ? a : b));

					patterns.push({
						intentType: group.intentType,
						spaceId: group.spaceId,
						timeOfDay: { hour: cluster.avgHour, minute: cluster.avgMinute },
						occurrences: cluster.actions.length,
						confidence,
						firstSeen: new Date(Math.min(...timestamps)),
						lastSeen: new Date(Math.max(...timestamps)),
						latestTargets: latestAction.targets,
						latestValue: latestAction.value,
					});
				}
			}
		}

		this.logger.debug(`Detected ${patterns.length} pattern(s) from ${recentActions.length} recent actions`);

		return patterns;
	}

	/**
	 * Return cached detectPatterns() results within the TTL window.
	 * Avoids re-scanning the full action buffer when evaluate() is
	 * called multiple times in rapid succession (e.g. once per space
	 * during a heartbeat cycle).
	 */
	private getPatternsCached(): DetectedPattern[] {
		const now = Date.now();

		if (this.patternCache !== null && now - this.patternCacheTime < PatternDetectorService.CACHE_TTL_MS) {
			return this.patternCache;
		}

		this.patternCache = this.detectPatterns();
		this.patternCacheTime = now;

		return this.patternCache;
	}

	/**
	 * Group actions by (intentType, spaceId), deduplicating within a 5-minute
	 * window. Multiple actions of the same type in the same space within 5
	 * minutes count as a single occurrence — prevents e.g. setting up 3 lights
	 * at once from immediately triggering a "pattern detected" suggestion.
	 */
	private groupActions(actions: ActionRecord[]): ActionGroup[] {
		const DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
		const map = new Map<string, ActionGroup>();

		// Sort by timestamp so dedup window works correctly
		const sorted = [...actions].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

		for (const action of sorted) {
			const spaceId = action.spaceId;

			if (!spaceId) {
				continue;
			}

			const key = `${action.type}::${spaceId}`;
			let group = map.get(key);

			if (!group) {
				group = {
					intentType: action.type,
					spaceId,
					actions: [],
				};
				map.set(key, group);
			}

			// Deduplicate: skip if last action in this group was within 5 minutes
			const lastAction = group.actions[group.actions.length - 1];

			if (lastAction && action.timestamp.getTime() - lastAction.timestamp.getTime() < DEDUP_WINDOW_MS) {
				// Update the last action with the latest targets/value (keep most recent data)
				group.actions[group.actions.length - 1] = action;

				continue;
			}

			group.actions.push(action);
		}

		return Array.from(map.values());
	}

	/**
	 * Cluster actions within a group by time-of-day using a sliding window.
	 * Actions within ±windowMinutes of each other's time-of-day
	 * are grouped into the same cluster.
	 */
	private clusterActions(actions: ActionRecord[], windowMinutes: number): TimeCluster[] {
		const actionMinuteOfDay = (a: ActionRecord): number => a.timestamp.getHours() * 60 + a.timestamp.getMinutes();

		return clusterByTimeOfDay(actions, actionMinuteOfDay, windowMinutes).map((c) => ({
			actions: c.items,
			avgHour: c.avgHour,
			avgMinute: c.avgMinute,
		}));
	}
}

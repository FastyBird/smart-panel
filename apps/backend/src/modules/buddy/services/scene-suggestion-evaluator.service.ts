import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { ConfigService } from '../../config/services/config.service';
import { IntentType } from '../../intents/intents.constants';
import { ScenesService } from '../../scenes/services/scenes.service';
import { SYSTEM_MODULE_NAME } from '../../system/system.constants';
import { BUDDY_MODULE_NAME, PATTERN_LOOKBACK_DAYS, PATTERN_MIN_OCCURRENCES, SuggestionType } from '../buddy.constants';
import { clusterByTimeOfDay, formatTimeLabel, interpolateTemplate, toMinuteOfDay } from '../buddy.utils';
import { EvaluatorRulesLoaderService } from '../spec/evaluator-rules-loader.service';
import { ResolvedPatternRule } from '../spec/evaluator-rules.types';

import { ActionObserverService, ActionRecord } from './action-observer.service';
import { BuddyContext } from './buddy-context.service';
import { EvaluatorResult, HeartbeatEvaluator } from './heartbeat.types';

const SEQUENCE_WINDOW_MS = 60 * 1000; // 60 seconds
const SEQUENCE_TIME_CLUSTER_MINUTES = 60; // ±60 min time-of-day window

export interface ActionSequence {
	intentTypes: IntentType[];
	deviceIds: string[];
	hash: string;
}

export interface SceneActionDetail {
	deviceId: string;
	channelId?: string;
	propertyId?: string;
	value?: unknown;
}

export interface DetectedSequencePattern {
	sequence: ActionSequence;
	spaceId: string;
	timeOfDay: { hour: number; minute: number };
	occurrences: number;
	/** Action details from the most recent session — used to populate scene actions. */
	latestActions: SceneActionDetail[];
}

@Injectable()
export class SceneSuggestionEvaluator implements HeartbeatEvaluator {
	readonly name = 'SceneSuggestion';
	private readonly logger = createExtensionLogger(BUDDY_MODULE_NAME, 'SceneSuggestionEvaluator');
	private static readonly CACHE_TTL_MS = 5000;
	private patternCache: DetectedSequencePattern[] | null = null;
	private patternCacheTime = 0;

	constructor(
		private readonly actionObserver: ActionObserverService,
		private readonly scenesService: ScenesService,
		private readonly rulesLoader: EvaluatorRulesLoaderService,
		private readonly configService: ConfigService,
	) {}

	private getTimezone(): string {
		try {
			const config = this.configService.getModuleConfig<{ timezone?: string }>(SYSTEM_MODULE_NAME);

			return config.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
		} catch {
			return Intl.DateTimeFormat().resolvedOptions().timeZone;
		}
	}

	evaluate(context: BuddyContext): Promise<EvaluatorResult[]> {
		const rule = this.rulesLoader.getPatternRule('multi_action_sequence');

		if (rule && !rule.enabled) {
			return Promise.resolve<EvaluatorResult[]>([]);
		}

		const spaceIds = new Set(context.spaces.map((s) => s.id));
		const patterns = this.getPatternsCached();

		const results: EvaluatorResult[] = patterns
			.filter((p) => spaceIds.has(p.spaceId))
			.map((p) => {
				const spaceName = context.spaces.find((s) => s.id === p.spaceId)?.name ?? 'unknown space';

				return this.patternToResult(p, spaceName, rule);
			});

		return Promise.resolve(results);
	}

	/**
	 * Return cached detectSequencePatterns() results within the TTL window.
	 * Avoids re-scanning the full action buffer when evaluate() is
	 * called multiple times in rapid succession (e.g. once per space
	 * during a heartbeat cycle).
	 */
	private getPatternsCached(): DetectedSequencePattern[] {
		const now = Date.now();

		if (this.patternCache !== null && now - this.patternCacheTime < SceneSuggestionEvaluator.CACHE_TTL_MS) {
			return this.patternCache;
		}

		this.patternCache = this.detectSequencePatterns();
		this.patternCacheTime = now;

		return this.patternCache;
	}

	detectSequencePatterns(): DetectedSequencePattern[] {
		const rule = this.rulesLoader.getPatternRule('multi_action_sequence');

		const lookbackDays = rule?.thresholds.lookback_days ?? PATTERN_LOOKBACK_DAYS;
		const minOccurrences = rule?.thresholds.min_occurrences ?? PATTERN_MIN_OCCURRENCES;
		const sequenceWindowMs = rule?.thresholds.sequence_window_ms ?? SEQUENCE_WINDOW_MS;
		const minActionsPerSession = rule?.thresholds.min_actions_per_session ?? 2;
		const timeClusterMinutes = rule?.thresholds.time_cluster_minutes ?? SEQUENCE_TIME_CLUSTER_MINUTES;

		const actions = this.actionObserver.getRecentActions();
		const cutoff = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
		const recentActions = actions.filter((a) => a.timestamp >= cutoff && a.spaceId !== null);

		if (recentActions.length === 0) {
			return [];
		}

		const sessions = this.groupIntoSessions(recentActions, sequenceWindowMs);
		const multiActionSessions = sessions.filter((s) => s.actions.length >= minActionsPerSession);

		if (multiActionSessions.length === 0) {
			return [];
		}

		const bySpaceAndHash = this.groupSessionsBySignature(multiActionSessions);
		const patterns: DetectedSequencePattern[] = [];

		for (const group of bySpaceAndHash.values()) {
			if (group.sessions.length < minOccurrences) {
				continue;
			}

			const clusters = this.clusterSessions(group.sessions, timeClusterMinutes);

			for (const cluster of clusters) {
				if (cluster.sessions.length >= minOccurrences) {
					// Use the most recent session as template for scene actions
					const latestSession = cluster.sessions.reduce((a, b) =>
						a.actions[0].timestamp > b.actions[0].timestamp ? a : b,
					);

					const latestActions: SceneActionDetail[] = latestSession.actions.flatMap((action) =>
						(action.targets ?? [])
							.filter((t) => t.propertyId)
							.map((t) => ({
								deviceId: t.deviceId,
								channelId: t.channelId,
								propertyId: t.propertyId,
								value: action.value,
							})),
					);

					patterns.push({
						sequence: group.sequence,
						spaceId: group.spaceId,
						timeOfDay: cluster.timeOfDay,
						occurrences: cluster.sessions.length,
						latestActions,
					});
				}
			}
		}

		this.logger.debug(`Detected ${patterns.length} multi-action sequence pattern(s)`);

		return patterns;
	}

	async createSceneFromSuggestion(
		spaceId: string,
		metadata: Record<string, unknown>,
	): Promise<{ sceneId: string } | { error: string }> {
		try {
			const sceneName = (metadata.sceneName as string) ?? 'Automated Scene';

			// Build scene actions from the recorded action targets
			const rawActions = (metadata.actions as SceneActionDetail[] | undefined) ?? [];
			const sceneActions = rawActions
				.filter((a) => a.deviceId && a.propertyId)
				.map((a, i) => ({
					type: 'scenes-local' as const,
					device_id: a.deviceId,
					channel_id: a.channelId ?? undefined,
					property_id: a.propertyId,
					value: a.value ?? true,
					order: i,
					enabled: true,
				}));

			const scene = await this.scenesService.create({
				name: sceneName,
				primary_space_id: spaceId,
				enabled: true,
				triggerable: true,
				actions: sceneActions,
			});

			this.logger.log(
				`Created scene "${sceneName}" (id=${scene.id}) with ${sceneActions.length} action(s) from suggestion`,
			);

			return { sceneId: scene.id };
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';

			this.logger.warn(`Failed to create scene from suggestion: ${message}`);

			return { error: message };
		}
	}

	private groupIntoSessions(actions: ActionRecord[], sequenceWindowMs: number): ActionSession[] {
		const bySpace = new Map<string, ActionRecord[]>();

		for (const action of actions) {
			if (!action.spaceId) {
				continue;
			}

			const list = bySpace.get(action.spaceId) ?? [];
			list.push(action);
			bySpace.set(action.spaceId, list);
		}

		const sessions: ActionSession[] = [];

		for (const [spaceId, spaceActions] of bySpace) {
			const sorted = [...spaceActions].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

			let currentSession: ActionRecord[] = [sorted[0]];

			for (let i = 1; i < sorted.length; i++) {
				const gap = sorted[i].timestamp.getTime() - sorted[i - 1].timestamp.getTime();

				if (gap <= sequenceWindowMs) {
					currentSession.push(sorted[i]);
				} else {
					sessions.push({ spaceId, actions: currentSession });
					currentSession = [sorted[i]];
				}
			}

			sessions.push({ spaceId, actions: currentSession });
		}

		return sessions;
	}

	private groupSessionsBySignature(
		sessions: ActionSession[],
	): Map<string, { spaceId: string; sequence: ActionSequence; sessions: ActionSession[] }> {
		const groups = new Map<string, { spaceId: string; sequence: ActionSequence; sessions: ActionSession[] }>();

		for (const session of sessions) {
			const sequence = this.sessionToSequence(session);
			const key = `${session.spaceId}::${sequence.hash}`;
			let group = groups.get(key);

			if (!group) {
				group = { spaceId: session.spaceId, sequence, sessions: [] };
				groups.set(key, group);
			}

			group.sessions.push(session);
		}

		return groups;
	}

	private sessionToSequence(session: ActionSession): ActionSequence {
		const tuples = session.actions.map((a) => `${a.type}:${[...a.deviceIds].sort().join(',')}`);
		const sorted = [...tuples].sort();

		return {
			intentTypes: [...new Set(session.actions.map((a) => a.type))].sort(),
			deviceIds: [...new Set(session.actions.flatMap((a) => a.deviceIds))].sort(),
			hash: sorted.join('|'),
		};
	}

	private clusterSessions(
		sessions: ActionSession[],
		timeClusterMinutes: number,
	): { sessions: ActionSession[]; timeOfDay: { hour: number; minute: number } }[] {
		const timezone = this.getTimezone();
		const sessionMinuteOfDay = (s: ActionSession): number => {
			return toMinuteOfDay(s.actions[0].timestamp, timezone);
		};

		return clusterByTimeOfDay(sessions, sessionMinuteOfDay, timeClusterMinutes).map((c) => ({
			sessions: c.items,
			timeOfDay: { hour: c.avgHour, minute: c.avgMinute },
		}));
	}

	private patternToResult(
		pattern: DetectedSequencePattern,
		spaceName: string,
		rule: ResolvedPatternRule | undefined,
	): EvaluatorResult {
		const timeLabel = this.getTimePeriodLabel(pattern.timeOfDay.hour, rule);
		const sceneName = `${spaceName} ${timeLabel}`;
		const actionCount = pattern.sequence.intentTypes.length;

		return {
			type: rule?.suggestionType ?? SuggestionType.PATTERN_SCENE_CREATE,
			title: rule?.messages.title ?? 'Create a scene for this routine?',
			reason: rule
				? interpolateTemplate(rule.messages.reason, {
						actionCount,
						spaceName,
						timeLabel: formatTimeLabel(pattern.timeOfDay.hour, pattern.timeOfDay.minute),
						sceneName,
					})
				: `You perform ${actionCount} actions in ${spaceName} around ` +
					`${formatTimeLabel(pattern.timeOfDay.hour, pattern.timeOfDay.minute)} regularly. ` +
					`Create a "${sceneName}" scene?`,
			spaceId: pattern.spaceId,
			metadata: {
				sequence: 'multi-action',
				intentTypes: pattern.sequence.intentTypes,
				deviceIds: pattern.sequence.deviceIds,
				sequenceHash: pattern.sequence.hash,
				sceneName,
				timeOfDay: pattern.timeOfDay,
				occurrences: pattern.occurrences,
				actions: pattern.latestActions,
			},
		};
	}

	private getTimePeriodLabel(hour: number, rule: ResolvedPatternRule | undefined): string {
		const labels = rule?.timePeriodLabels;

		if (labels && labels.length > 0) {
			for (const entry of labels) {
				if (entry.range && hour >= entry.range[0] && hour < entry.range[1] && entry.label) {
					return entry.label;
				}

				if (entry.default && !entry.range) {
					// default entry is used as fallback — continue checking ranges first
				}
			}

			// Return default label if defined
			const defaultEntry = labels.find((l) => l.default && !l.range);

			if (defaultEntry?.default) {
				return defaultEntry.default;
			}
		}

		// Hardcoded fallback
		if (hour >= 5 && hour < 12) {
			return 'Morning';
		}

		if (hour >= 12 && hour < 17) {
			return 'Afternoon';
		}

		if (hour >= 17 && hour < 21) {
			return 'Evening';
		}

		return 'Night';
	}
}

interface ActionSession {
	spaceId: string;
	actions: ActionRecord[];
}

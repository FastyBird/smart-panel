import { Injectable, Logger } from '@nestjs/common';

import { IntentType } from '../../intents/intents.constants';
import { ScenesService } from '../../scenes/services/scenes.service';
import { PATTERN_LOOKBACK_DAYS, PATTERN_MIN_OCCURRENCES, SuggestionType } from '../buddy.constants';
import { clusterByTimeOfDay, formatTimeLabel } from '../buddy.utils';

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

export interface DetectedSequencePattern {
	sequence: ActionSequence;
	spaceId: string;
	timeOfDay: { hour: number; minute: number };
	occurrences: number;
}

@Injectable()
export class SceneSuggestionEvaluator implements HeartbeatEvaluator {
	readonly name = 'SceneSuggestion';
	private readonly logger = new Logger(SceneSuggestionEvaluator.name);

	constructor(
		private readonly actionObserver: ActionObserverService,
		private readonly scenesService: ScenesService,
	) {}

	evaluate(context: BuddyContext): Promise<EvaluatorResult[]> {
		const spaceIds = new Set(context.spaces.map((s) => s.id));
		const patterns = this.detectSequencePatterns();

		const results: EvaluatorResult[] = patterns
			.filter((p) => spaceIds.has(p.spaceId))
			.map((p) => {
				const spaceName = context.spaces.find((s) => s.id === p.spaceId)?.name ?? 'unknown space';

				return this.patternToResult(p, spaceName);
			});

		return Promise.resolve(results);
	}

	detectSequencePatterns(): DetectedSequencePattern[] {
		const actions = this.actionObserver.getRecentActions();
		const cutoff = new Date(Date.now() - PATTERN_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
		const recentActions = actions.filter((a) => a.timestamp >= cutoff && a.spaceId !== null);

		if (recentActions.length === 0) {
			return [];
		}

		const sessions = this.groupIntoSessions(recentActions);
		const multiActionSessions = sessions.filter((s) => s.actions.length >= 2);

		if (multiActionSessions.length === 0) {
			return [];
		}

		const bySpaceAndHash = this.groupSessionsBySignature(multiActionSessions);
		const patterns: DetectedSequencePattern[] = [];

		for (const group of bySpaceAndHash.values()) {
			if (group.sessions.length < PATTERN_MIN_OCCURRENCES) {
				continue;
			}

			const clusters = this.clusterSessions(group.sessions);

			for (const cluster of clusters) {
				if (cluster.sessions.length >= PATTERN_MIN_OCCURRENCES) {
					patterns.push({
						sequence: group.sequence,
						spaceId: group.spaceId,
						timeOfDay: cluster.timeOfDay,
						occurrences: cluster.sessions.length,
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

			const scene = await this.scenesService.create({
				name: sceneName,
				primary_space_id: spaceId,
				enabled: true,
				triggerable: true,
			});

			this.logger.log(`Created scene "${sceneName}" (id=${scene.id}) from suggestion`);

			return { sceneId: scene.id };
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';

			this.logger.warn(`Failed to create scene from suggestion: ${message}`);

			return { error: message };
		}
	}

	private groupIntoSessions(actions: ActionRecord[]): ActionSession[] {
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

				if (gap <= SEQUENCE_WINDOW_MS) {
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
	): { sessions: ActionSession[]; timeOfDay: { hour: number; minute: number } }[] {
		const sessionMinuteOfDay = (s: ActionSession): number => {
			const ts = s.actions[0].timestamp;

			return ts.getHours() * 60 + ts.getMinutes();
		};

		return clusterByTimeOfDay(sessions, sessionMinuteOfDay, SEQUENCE_TIME_CLUSTER_MINUTES).map((c) => ({
			sessions: c.items,
			timeOfDay: { hour: c.avgHour, minute: c.avgMinute },
		}));
	}

	private patternToResult(pattern: DetectedSequencePattern, spaceName: string): EvaluatorResult {
		const timeLabel = this.getTimePeriodLabel(pattern.timeOfDay.hour);
		const sceneName = `${spaceName} ${timeLabel}`;
		const actionCount = pattern.sequence.intentTypes.length;

		return {
			type: SuggestionType.PATTERN_SCENE_CREATE,
			title: 'Create a scene for this routine?',
			reason:
				`You perform ${actionCount} actions in ${spaceName} around ` +
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
			},
		};
	}

	private getTimePeriodLabel(hour: number): string {
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

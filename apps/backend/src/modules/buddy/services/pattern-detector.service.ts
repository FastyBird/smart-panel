import { Injectable, Logger } from '@nestjs/common';

import { IntentType } from '../../intents/intents.constants';
import {
	PATTERN_LOOKBACK_DAYS,
	PATTERN_MIN_OCCURRENCES,
	PATTERN_TIME_WINDOW_MINUTES,
	SuggestionType,
} from '../buddy.constants';
import { formatIntentLabel, formatTimeLabel } from '../buddy.utils';

import { ActionObserverService, ActionRecord } from './action-observer.service';
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

@Injectable()
export class PatternDetectorService implements HeartbeatEvaluator {
	readonly name = 'PatternDetector';
	private readonly logger = new Logger(PatternDetectorService.name);

	constructor(private readonly actionObserver: ActionObserverService) {}

	/**
	 * HeartbeatEvaluator implementation.
	 * Detects patterns filtered to the space in the provided context.
	 */
	evaluate(context: BuddyContext): Promise<EvaluatorResult[]> {
		const patterns = this.detectPatterns();
		const spaceIds = new Set(context.spaces.map((s) => s.id));

		const results = patterns
			.filter((p) => spaceIds.has(p.spaceId))
			.map((p) => {
				const spaceName = context.spaces.find((s) => s.id === p.spaceId)?.name ?? 'unknown space';
				const intentLabel = formatIntentLabel(p.intentType);
				const timeLabel = formatTimeLabel(p.timeOfDay.hour, p.timeOfDay.minute);

				return {
					type: SuggestionType.PATTERN_SCENE_CREATE,
					title: 'Create a scene for this?',
					reason: `You ${intentLabel} in ${spaceName} around ${timeLabel} regularly`,
					spaceId: p.spaceId,
					metadata: {
						intentType: p.intentType,
						timeOfDay: p.timeOfDay,
						occurrences: p.occurrences,
						confidence: p.confidence,
					},
				};
			});

		return Promise.resolve(results);
	}

	/**
	 * Analyse the action history buffer and detect repeated patterns.
	 * Groups actions by (intentType, spaceId), then clusters by time-of-day
	 * within a configurable window. Returns patterns with confidence scores.
	 */
	detectPatterns(): DetectedPattern[] {
		const actions = this.actionObserver.getRecentActions();
		const cutoff = new Date(Date.now() - PATTERN_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
		const recentActions = actions.filter((a) => a.timestamp >= cutoff && a.spaceId !== null);

		if (recentActions.length === 0) {
			return [];
		}

		const groups = this.groupActions(recentActions);
		const patterns: DetectedPattern[] = [];

		for (const group of groups) {
			const clusters = this.clusterByTimeOfDay(group.actions);

			for (const cluster of clusters) {
				if (cluster.actions.length >= PATTERN_MIN_OCCURRENCES) {
					const confidence = Math.min(1, cluster.actions.length / PATTERN_LOOKBACK_DAYS);
					const timestamps = cluster.actions.map((a) => a.timestamp.getTime());

					patterns.push({
						intentType: group.intentType,
						spaceId: group.spaceId,
						timeOfDay: { hour: cluster.avgHour, minute: cluster.avgMinute },
						occurrences: cluster.actions.length,
						confidence,
						firstSeen: new Date(Math.min(...timestamps)),
						lastSeen: new Date(Math.max(...timestamps)),
					});
				}
			}
		}

		this.logger.debug(`Detected ${patterns.length} pattern(s) from ${recentActions.length} recent actions`);

		return patterns;
	}

	/**
	 * Group actions by (intentType, spaceId).
	 */
	private groupActions(actions: ActionRecord[]): ActionGroup[] {
		const map = new Map<string, ActionGroup>();

		for (const action of actions) {
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

			group.actions.push(action);
		}

		return Array.from(map.values());
	}

	/**
	 * Cluster actions within a group by time-of-day using a sliding window.
	 * Actions within ±PATTERN_TIME_WINDOW_MINUTES of each other's time-of-day
	 * are grouped into the same cluster.
	 */
	private clusterByTimeOfDay(actions: ActionRecord[]): TimeCluster[] {
		if (actions.length === 0) {
			return [];
		}

		const minuteOfDay = (d: Date): number => d.getHours() * 60 + d.getMinutes();
		const sorted = [...actions].sort((a, b) => minuteOfDay(a.timestamp) - minuteOfDay(b.timestamp));

		const clusters: TimeCluster[] = [];
		const used = new Set<number>();

		for (let i = 0; i < sorted.length; i++) {
			if (used.has(i)) {
				continue;
			}

			const cluster: ActionRecord[] = [sorted[i]];
			used.add(i);

			const seedMinute = minuteOfDay(sorted[i].timestamp);

			for (let j = i + 1; j < sorted.length; j++) {
				if (used.has(j)) {
					continue;
				}

				const targetMinute = minuteOfDay(sorted[j].timestamp);
				const diff = Math.abs(targetMinute - seedMinute);
				const wrappedDiff = Math.min(diff, 1440 - diff);

				if (wrappedDiff <= PATTERN_TIME_WINDOW_MINUTES) {
					cluster.push(sorted[j]);
					used.add(j);
				}
			}

			const { hour, minute } = this.circularMeanTime(cluster);

			clusters.push({
				actions: cluster,
				avgHour: hour,
				avgMinute: minute,
			});
		}

		return clusters;
	}

	/**
	 * Compute the circular mean of time-of-day values.
	 * Uses circular statistics (atan2 of mean sin/cos) to correctly average
	 * times that span midnight (e.g. 23:50 and 00:10 → ~00:00, not 12:00).
	 */
	private circularMeanTime(cluster: ActionRecord[]): { hour: number; minute: number } {
		const TWO_PI = 2 * Math.PI;
		const MINUTES_IN_DAY = 1440;

		let sinSum = 0;
		let cosSum = 0;

		for (const action of cluster) {
			const minutes = action.timestamp.getHours() * 60 + action.timestamp.getMinutes();
			const angle = (minutes / MINUTES_IN_DAY) * TWO_PI;
			sinSum += Math.sin(angle);
			cosSum += Math.cos(angle);
		}

		const meanAngle = Math.atan2(sinSum / cluster.length, cosSum / cluster.length);
		let meanMinutes = Math.round(((meanAngle < 0 ? meanAngle + TWO_PI : meanAngle) / TWO_PI) * MINUTES_IN_DAY);

		if (meanMinutes >= MINUTES_IN_DAY) {
			meanMinutes = 0;
		}

		return {
			hour: Math.floor(meanMinutes / 60),
			minute: meanMinutes % 60,
		};
	}
}

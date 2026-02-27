import { Injectable, Logger } from '@nestjs/common';

import { SpacesService } from '../../spaces/services/spaces.service';

import { ActionObserverService, ActionRecord } from './action-observer.service';

export interface DetectedPattern {
	intentType: string;
	spaceId: string;
	spaceName: string;
	timeOfDay: { hour: number; minute: number };
	occurrences: number;
	confidence: number;
	firstSeen: Date;
	lastSeen: Date;
}

const MIN_OCCURRENCES = 3;
const TIME_WINDOW_MINUTES = 60;
const LOOKBACK_DAYS = 7;

@Injectable()
export class PatternDetectorService {
	private readonly logger = new Logger(PatternDetectorService.name);

	constructor(
		private readonly actionObserver: ActionObserverService,
		private readonly spacesService: SpacesService,
	) {}

	async detectPatterns(): Promise<DetectedPattern[]> {
		const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
		const actions = this.actionObserver.getRecentActions().filter((a) => a.timestamp >= cutoff && a.spaceId != null);

		if (actions.length === 0) {
			return [];
		}

		// Group actions by (intentType, spaceId)
		const groups = new Map<string, ActionRecord[]>();

		for (const action of actions) {
			const key = `${action.type}:${action.spaceId}`;
			const group = groups.get(key);

			if (group) {
				group.push(action);
			} else {
				groups.set(key, [action]);
			}
		}

		const patterns: DetectedPattern[] = [];

		for (const [, groupActions] of groups) {
			const clusters = this.clusterByTimeOfDay(groupActions);

			for (const cluster of clusters) {
				if (cluster.length < MIN_OCCURRENCES) {
					continue;
				}

				const pattern = await this.buildPattern(cluster);

				if (pattern) {
					patterns.push(pattern);
				}
			}
		}

		this.logger.debug(`Detected ${String(patterns.length)} patterns from ${String(actions.length)} actions`);

		return patterns;
	}

	private clusterByTimeOfDay(actions: ActionRecord[]): ActionRecord[][] {
		if (actions.length === 0) {
			return [];
		}

		// Extract time-of-day in minutes
		const withMinutes = actions.map((a) => ({
			action: a,
			minutes: a.timestamp.getHours() * 60 + a.timestamp.getMinutes(),
		}));

		// Sort by time-of-day
		withMinutes.sort((a, b) => a.minutes - b.minutes);

		// Cluster actions within TIME_WINDOW_MINUTES of each other
		const clusters: ActionRecord[][] = [];
		let currentCluster: ActionRecord[] = [withMinutes[0].action];
		let clusterCenter = withMinutes[0].minutes;

		for (let i = 1; i < withMinutes.length; i++) {
			const diff = Math.abs(withMinutes[i].minutes - clusterCenter);

			if (diff <= TIME_WINDOW_MINUTES || 1440 - diff <= TIME_WINDOW_MINUTES) {
				currentCluster.push(withMinutes[i].action);
			} else {
				clusters.push(currentCluster);
				currentCluster = [withMinutes[i].action];
				clusterCenter = withMinutes[i].minutes;
			}
		}

		clusters.push(currentCluster);

		return clusters;
	}

	private async buildPattern(actions: ActionRecord[]): Promise<DetectedPattern | null> {
		const first = actions[0];

		if (!first.spaceId) {
			return null;
		}

		let spaceName = first.spaceId;

		try {
			const space = await this.spacesService.findOne(first.spaceId);

			if (space) {
				spaceName = space.name;
			}
		} catch {
			// Use spaceId as fallback name
		}

		// Average time-of-day
		const totalMinutes = actions.reduce((sum, a) => sum + a.timestamp.getHours() * 60 + a.timestamp.getMinutes(), 0);
		const avgMinutes = Math.round(totalMinutes / actions.length);

		const timestamps = actions.map((a) => a.timestamp.getTime());

		return {
			intentType: first.type,
			spaceId: first.spaceId,
			spaceName,
			timeOfDay: {
				hour: Math.floor(avgMinutes / 60),
				minute: avgMinutes % 60,
			},
			occurrences: actions.length,
			confidence: Math.min(1, actions.length / 7),
			firstSeen: new Date(Math.min(...timestamps)),
			lastSeen: new Date(Math.max(...timestamps)),
		};
	}
}

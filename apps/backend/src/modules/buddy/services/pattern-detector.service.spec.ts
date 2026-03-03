import { IntentType } from '../../intents/intents.constants';
import { SuggestionType } from '../buddy.constants';
import { EvaluatorRulesLoaderService } from '../spec/evaluator-rules-loader.service';
import { ResolvedPatternRule } from '../spec/evaluator-rules.types';

import { ActionObserverService, ActionRecord } from './action-observer.service';
import { PatternDetectorService } from './pattern-detector.service';

function makeAction(overrides: Partial<ActionRecord> = {}): ActionRecord {
	return {
		intentId: overrides.intentId ?? `intent-${Math.random().toString(36).slice(2)}`,
		type: overrides.type ?? IntentType.LIGHT_TOGGLE,
		spaceId: 'spaceId' in overrides ? overrides.spaceId : 'space-1',
		deviceIds: overrides.deviceIds ?? ['dev-1'],
		timestamp: overrides.timestamp ?? new Date(),
	};
}

/**
 * Create a date at a specific local time-of-day, N days ago.
 *
 * Subtracts days using exact millisecond arithmetic (`N * 86_400_000`)
 * to stay consistent with the lookback cutoff in `detectPatterns`
 * (`Date.now() - 7 * 24 * 60 * 60 * 1000`), then sets the local
 * hour/minute so that `getHours()`/`getMinutes()` return the expected
 * values for time-of-day clustering.
 */
function daysAgoAt(daysAgo: number, hour: number, minute: number = 0): Date {
	const d = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

	d.setHours(hour, minute, 0, 0);

	return d;
}

const defaultPatternRules: Record<string, ResolvedPatternRule> = {
	single_pattern: {
		enabled: true,
		suggestionType: SuggestionType.PATTERN_SCENE_CREATE,
		thresholds: { min_occurrences: 3, time_window_minutes: 60, lookback_days: 7 },
		messages: {
			title: 'Create a scene for this?',
			reason: 'You ${intentLabel} in ${spaceName} around ${timeLabel} regularly',
		},
		timePeriodLabels: [],
	},
	multi_action_sequence: {
		enabled: true,
		suggestionType: SuggestionType.PATTERN_SCENE_CREATE,
		thresholds: { min_occurrences: 3, sequence_window_ms: 60000, time_cluster_minutes: 60, lookback_days: 7, min_actions_per_session: 2 },
		messages: {
			title: 'Create a scene for this routine?',
			reason: 'You perform ${actionCount} actions in ${spaceName} around ${timeLabel} regularly. Create a "${sceneName}" scene?',
		},
		timePeriodLabels: [
			{ range: [5, 12], label: 'Morning' },
			{ range: [12, 17], label: 'Afternoon' },
			{ range: [17, 21], label: 'Evening' },
			{ default: 'Night' },
		],
	},
};

function makeRulesLoader(
	overrides: Partial<Record<string, ResolvedPatternRule>> = {},
): EvaluatorRulesLoaderService {
	const rules = { ...defaultPatternRules, ...overrides };

	return {
		getAnomalyRule: jest.fn(),
		getEnergyRule: jest.fn(),
		getConflictRule: jest.fn(),
		getPatternRule: jest.fn((key: string) => rules[key]),
		onModuleInit: jest.fn(),
		loadAllRules: jest.fn(),
	} as unknown as EvaluatorRulesLoaderService;
}

describe('PatternDetectorService', () => {
	let service: PatternDetectorService;
	let observer: ActionObserverService;

	beforeEach(() => {
		observer = new ActionObserverService();
		service = new PatternDetectorService(observer, makeRulesLoader());
	});

	it('should return no patterns when there are no actions', () => {
		const patterns = service.detectPatterns();

		expect(patterns).toHaveLength(0);
	});

	it('should return no patterns for a single action', () => {
		observer.recordAction(makeAction({ timestamp: daysAgoAt(1, 23, 0) }));

		const patterns = service.detectPatterns();

		expect(patterns).toHaveLength(0);
	});

	it('should return no patterns for only 2 matching actions (below min threshold of 3)', () => {
		observer.recordAction(makeAction({ spaceId: 'living-room', timestamp: daysAgoAt(1, 23, 0) }));
		observer.recordAction(makeAction({ spaceId: 'living-room', timestamp: daysAgoAt(2, 23, 0) }));

		const patterns = service.detectPatterns();

		expect(patterns).toHaveLength(0);
	});

	it('should detect a pattern from 3+ same actions in the same space at similar times', () => {
		observer.recordAction(
			makeAction({ type: IntentType.LIGHT_TOGGLE, spaceId: 'living-room', timestamp: daysAgoAt(1, 23, 0) }),
		);
		observer.recordAction(
			makeAction({ type: IntentType.LIGHT_TOGGLE, spaceId: 'living-room', timestamp: daysAgoAt(2, 22, 55) }),
		);
		observer.recordAction(
			makeAction({ type: IntentType.LIGHT_TOGGLE, spaceId: 'living-room', timestamp: daysAgoAt(3, 23, 10) }),
		);

		const patterns = service.detectPatterns();

		expect(patterns).toHaveLength(1);
		expect(patterns[0].intentType).toBe(IntentType.LIGHT_TOGGLE);
		expect(patterns[0].spaceId).toBe('living-room');
		expect(patterns[0].occurrences).toBe(3);
	});

	it('should group actions in different spaces into separate patterns', () => {
		// 3 actions in living-room
		observer.recordAction(
			makeAction({ type: IntentType.LIGHT_TOGGLE, spaceId: 'living-room', timestamp: daysAgoAt(1, 23, 0) }),
		);
		observer.recordAction(
			makeAction({ type: IntentType.LIGHT_TOGGLE, spaceId: 'living-room', timestamp: daysAgoAt(2, 23, 0) }),
		);
		observer.recordAction(
			makeAction({ type: IntentType.LIGHT_TOGGLE, spaceId: 'living-room', timestamp: daysAgoAt(3, 23, 0) }),
		);

		// 3 actions in bedroom
		observer.recordAction(
			makeAction({ type: IntentType.LIGHT_TOGGLE, spaceId: 'bedroom', timestamp: daysAgoAt(1, 22, 0) }),
		);
		observer.recordAction(
			makeAction({ type: IntentType.LIGHT_TOGGLE, spaceId: 'bedroom', timestamp: daysAgoAt(2, 22, 0) }),
		);
		observer.recordAction(
			makeAction({ type: IntentType.LIGHT_TOGGLE, spaceId: 'bedroom', timestamp: daysAgoAt(3, 22, 0) }),
		);

		const patterns = service.detectPatterns();

		expect(patterns).toHaveLength(2);

		const spaceIds = patterns.map((p) => p.spaceId).sort();

		expect(spaceIds).toEqual(['bedroom', 'living-room']);
	});

	it('should only count actions from the same space for a pattern (mixed example)', () => {
		// 4 actions in living-room
		observer.recordAction(
			makeAction({ type: IntentType.LIGHT_TOGGLE, spaceId: 'living-room', timestamp: daysAgoAt(1, 23, 0) }),
		);
		observer.recordAction(
			makeAction({ type: IntentType.LIGHT_TOGGLE, spaceId: 'living-room', timestamp: daysAgoAt(2, 22, 55) }),
		);
		observer.recordAction(
			makeAction({ type: IntentType.LIGHT_TOGGLE, spaceId: 'living-room', timestamp: daysAgoAt(3, 23, 10) }),
		);
		observer.recordAction(
			makeAction({ type: IntentType.LIGHT_TOGGLE, spaceId: 'living-room', timestamp: daysAgoAt(5, 22, 50) }),
		);

		// 1 action in bedroom (not enough for pattern)
		observer.recordAction(
			makeAction({ type: IntentType.LIGHT_TOGGLE, spaceId: 'bedroom', timestamp: daysAgoAt(4, 23, 0) }),
		);

		const patterns = service.detectPatterns();

		expect(patterns).toHaveLength(1);
		expect(patterns[0].spaceId).toBe('living-room');
		expect(patterns[0].occurrences).toBe(4);
	});

	it('should not cluster actions spread too far apart in time-of-day (> ±60 min)', () => {
		// Actions at 8 AM and 10 PM — far apart, should not cluster
		observer.recordAction(
			makeAction({ type: IntentType.LIGHT_TOGGLE, spaceId: 'living-room', timestamp: daysAgoAt(1, 8, 0) }),
		);
		observer.recordAction(
			makeAction({ type: IntentType.LIGHT_TOGGLE, spaceId: 'living-room', timestamp: daysAgoAt(2, 22, 0) }),
		);
		observer.recordAction(
			makeAction({ type: IntentType.LIGHT_TOGGLE, spaceId: 'living-room', timestamp: daysAgoAt(3, 8, 0) }),
		);

		const patterns = service.detectPatterns();

		// Each cluster has only 2 or 1 actions — below threshold
		expect(patterns).toHaveLength(0);
	});

	it('should exclude actions older than 7 days', () => {
		// All actions are > 7 days ago
		observer.recordAction(
			makeAction({ type: IntentType.LIGHT_TOGGLE, spaceId: 'living-room', timestamp: daysAgoAt(8, 23, 0) }),
		);
		observer.recordAction(
			makeAction({ type: IntentType.LIGHT_TOGGLE, spaceId: 'living-room', timestamp: daysAgoAt(9, 23, 0) }),
		);
		observer.recordAction(
			makeAction({ type: IntentType.LIGHT_TOGGLE, spaceId: 'living-room', timestamp: daysAgoAt(10, 23, 0) }),
		);

		const patterns = service.detectPatterns();

		expect(patterns).toHaveLength(0);
	});

	it('should exclude actions with null spaceId', () => {
		observer.recordAction(makeAction({ type: IntentType.LIGHT_TOGGLE, spaceId: null, timestamp: daysAgoAt(1, 23, 0) }));
		observer.recordAction(makeAction({ type: IntentType.LIGHT_TOGGLE, spaceId: null, timestamp: daysAgoAt(2, 23, 0) }));
		observer.recordAction(makeAction({ type: IntentType.LIGHT_TOGGLE, spaceId: null, timestamp: daysAgoAt(3, 23, 0) }));

		const patterns = service.detectPatterns();

		expect(patterns).toHaveLength(0);
	});

	it('should calculate confidence as occurrences / lookbackDays (capped at 1)', () => {
		// 3 occurrences over 7-day lookback → 3/7 ≈ 0.43
		observer.recordAction(
			makeAction({ type: IntentType.LIGHT_TOGGLE, spaceId: 'living-room', timestamp: daysAgoAt(1, 23, 0) }),
		);
		observer.recordAction(
			makeAction({ type: IntentType.LIGHT_TOGGLE, spaceId: 'living-room', timestamp: daysAgoAt(2, 23, 0) }),
		);
		observer.recordAction(
			makeAction({ type: IntentType.LIGHT_TOGGLE, spaceId: 'living-room', timestamp: daysAgoAt(3, 23, 0) }),
		);

		const patterns = service.detectPatterns();

		expect(patterns).toHaveLength(1);
		expect(patterns[0].confidence).toBeCloseTo(3 / 7, 2);
	});

	it('should cap confidence at 1.0 when occurrences exceed lookback days', () => {
		// 7 occurrences in 7 days → min(1, 7/7) = 1
		for (let i = 1; i <= 7; i++) {
			observer.recordAction(
				makeAction({ type: IntentType.LIGHT_TOGGLE, spaceId: 'room', timestamp: daysAgoAt(i, 23, 0) }),
			);
		}

		const patterns = service.detectPatterns();

		expect(patterns).toHaveLength(1);
		expect(patterns[0].confidence).toBe(1);
	});

	it('should calculate correct timeOfDay from circular mean', () => {
		observer.recordAction(
			makeAction({ type: IntentType.LIGHT_TOGGLE, spaceId: 'room', timestamp: daysAgoAt(1, 23, 0) }),
		);
		observer.recordAction(
			makeAction({ type: IntentType.LIGHT_TOGGLE, spaceId: 'room', timestamp: daysAgoAt(2, 23, 0) }),
		);
		observer.recordAction(
			makeAction({ type: IntentType.LIGHT_TOGGLE, spaceId: 'room', timestamp: daysAgoAt(3, 23, 0) }),
		);

		const patterns = service.detectPatterns();

		expect(patterns).toHaveLength(1);
		expect(patterns[0].timeOfDay.hour).toBe(23);
		expect(patterns[0].timeOfDay.minute).toBe(0);
	});

	it('should record firstSeen and lastSeen dates correctly', () => {
		const ts1 = daysAgoAt(3, 23, 0);
		const ts2 = daysAgoAt(2, 23, 0);
		const ts3 = daysAgoAt(1, 23, 0);

		observer.recordAction(makeAction({ type: IntentType.LIGHT_TOGGLE, spaceId: 'room', timestamp: ts1 }));
		observer.recordAction(makeAction({ type: IntentType.LIGHT_TOGGLE, spaceId: 'room', timestamp: ts2 }));
		observer.recordAction(makeAction({ type: IntentType.LIGHT_TOGGLE, spaceId: 'room', timestamp: ts3 }));

		const patterns = service.detectPatterns();

		expect(patterns).toHaveLength(1);
		expect(patterns[0].firstSeen.getTime()).toBe(ts1.getTime());
		expect(patterns[0].lastSeen.getTime()).toBe(ts3.getTime());
	});

	it('should separate different intent types in the same space', () => {
		// 3 light.toggle
		for (let i = 1; i <= 3; i++) {
			observer.recordAction(
				makeAction({ type: IntentType.LIGHT_TOGGLE, spaceId: 'room', timestamp: daysAgoAt(i, 23, 0) }),
			);
		}

		// 3 scene.run
		for (let i = 1; i <= 3; i++) {
			observer.recordAction(makeAction({ type: IntentType.SCENE_RUN, spaceId: 'room', timestamp: daysAgoAt(i, 8, 0) }));
		}

		const patterns = service.detectPatterns();

		expect(patterns).toHaveLength(2);

		const types = patterns.map((p) => p.intentType).sort();

		expect(types).toEqual([IntentType.LIGHT_TOGGLE, IntentType.SCENE_RUN]);
	});
});

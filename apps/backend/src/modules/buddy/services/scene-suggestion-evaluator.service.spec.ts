import { IntentType } from '../../intents/intents.constants';
import { ScenesService } from '../../scenes/services/scenes.service';
import { PATTERN_MIN_OCCURRENCES, SuggestionType } from '../buddy.constants';
import { EvaluatorRulesLoaderService } from '../spec/evaluator-rules-loader.service';
import { ResolvedPatternRule } from '../spec/evaluator-rules.types';

import { ActionObserverService, ActionRecord } from './action-observer.service';
import { BuddyContext } from './buddy-context.service';
import { SceneSuggestionEvaluator } from './scene-suggestion-evaluator.service';

function makeContext(overrides: Partial<BuddyContext> = {}): BuddyContext {
	return {
		timestamp: new Date().toISOString(),
		spaces: overrides.spaces ?? [{ id: 'space-1', name: 'Living Room', category: 'living_room', deviceCount: 3 }],
		devices: overrides.devices ?? [],
		scenes: overrides.scenes ?? [],
		weather: overrides.weather ?? null,
		energy: overrides.energy ?? null,
		recentIntents: overrides.recentIntents ?? [],
	};
}

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
 * Record a multi-action session: multiple intents within 60 seconds, targeting the same space.
 */
function recordSession(
	observer: ActionObserverService,
	spaceId: string,
	actions: { type: IntentType; deviceIds: string[] }[],
	baseTime: Date,
): void {
	actions.forEach((action, i) => {
		observer.recordAction(
			makeAction({
				type: action.type,
				spaceId,
				deviceIds: action.deviceIds,
				timestamp: new Date(baseTime.getTime() + i * 5000), // 5s apart within session
			}),
		);
	});
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

describe('SceneSuggestionEvaluator', () => {
	let service: SceneSuggestionEvaluator;
	let actionObserver: ActionObserverService;
	let scenesService: { create: jest.Mock };

	beforeEach(() => {
		actionObserver = new ActionObserverService();
		scenesService = {
			create: jest.fn().mockResolvedValue({ id: 'scene-123', name: 'Test Scene' }),
		};

		service = new SceneSuggestionEvaluator(
			actionObserver,
			scenesService as unknown as ScenesService,
			makeRulesLoader(),
		);
	});

	it('should have the name "SceneSuggestion"', () => {
		expect(service.name).toBe('SceneSuggestion');
	});

	it('should return empty results when no actions exist', async () => {
		const context = makeContext();
		const results = await service.evaluate(context);

		expect(results).toHaveLength(0);
	});

	// ──────────────────────────────────────────
	// Multi-action sequence detection
	// ──────────────────────────────────────────

	describe('multi-action sequence detection', () => {
		it('should detect repeated multi-action sequences', async () => {
			const sessionActions = [
				{ type: IntentType.SPACE_LIGHTING_OFF, deviceIds: ['light-1'] },
				{ type: IntentType.SPACE_CLIMATE_SETPOINT_SET, deviceIds: ['thermo-1'] },
			];

			// Record 3+ sessions at similar times on different days
			for (let day = 0; day < PATTERN_MIN_OCCURRENCES; day++) {
				const baseTime = new Date();
				baseTime.setDate(baseTime.getDate() - day);
				baseTime.setHours(23, 0, 0, 0);
				recordSession(actionObserver, 'space-1', sessionActions, baseTime);
			}

			const context = makeContext();
			const results = await service.evaluate(context);

			expect(results.length).toBeGreaterThanOrEqual(1);

			const sceneResult = results.find((r) => r.type === SuggestionType.PATTERN_SCENE_CREATE);

			expect(sceneResult).toBeDefined();
			expect(sceneResult?.metadata.sequence).toBe('multi-action');
			expect(sceneResult?.metadata.sceneName).toContain('Living Room');
			expect(sceneResult?.metadata.sceneName).toContain('Night');
			expect(sceneResult?.spaceId).toBe('space-1');
		});

		it('should not detect single-action sessions', () => {
			// Only one intent per session — should not be detected by multi-action detector
			for (let day = 0; day < PATTERN_MIN_OCCURRENCES + 1; day++) {
				const baseTime = new Date();
				baseTime.setDate(baseTime.getDate() - day);
				baseTime.setHours(23, 0, 0, 0);

				actionObserver.recordAction(
					makeAction({
						type: IntentType.SPACE_LIGHTING_OFF,
						spaceId: 'space-1',
						deviceIds: ['light-1'],
						timestamp: baseTime,
					}),
				);
			}

			const patterns = service.detectSequencePatterns();

			expect(patterns).toHaveLength(0);
		});

		it('should require minimum occurrences to trigger', () => {
			const sessionActions = [
				{ type: IntentType.SPACE_LIGHTING_OFF, deviceIds: ['light-1'] },
				{ type: IntentType.SPACE_CLIMATE_SETPOINT_SET, deviceIds: ['thermo-1'] },
			];

			// Record only 2 sessions (below threshold of 3)
			for (let day = 0; day < PATTERN_MIN_OCCURRENCES - 1; day++) {
				const baseTime = new Date();
				baseTime.setDate(baseTime.getDate() - day);
				baseTime.setHours(23, 0, 0, 0);
				recordSession(actionObserver, 'space-1', sessionActions, baseTime);
			}

			const patterns = service.detectSequencePatterns();

			expect(patterns).toHaveLength(0);
		});

		it('should group actions within 60-second window into sessions', () => {
			const sessionActions = [
				{ type: IntentType.SPACE_LIGHTING_OFF, deviceIds: ['light-1'] },
				{ type: IntentType.SPACE_CLIMATE_SETPOINT_SET, deviceIds: ['thermo-1'] },
			];

			for (let day = 0; day < PATTERN_MIN_OCCURRENCES; day++) {
				const baseTime = new Date();
				baseTime.setDate(baseTime.getDate() - day);
				baseTime.setHours(22, 0, 0, 0);
				recordSession(actionObserver, 'space-1', sessionActions, baseTime);
			}

			const patterns = service.detectSequencePatterns();

			expect(patterns.length).toBeGreaterThanOrEqual(1);
			expect(patterns[0].sequence.intentTypes).toHaveLength(2);
		});

		it('should not group actions more than 60 seconds apart', () => {
			// Record actions 90 seconds apart — should create separate sessions
			for (let day = 0; day < PATTERN_MIN_OCCURRENCES; day++) {
				const baseTime = new Date();
				baseTime.setDate(baseTime.getDate() - day);
				baseTime.setHours(22, 0, 0, 0);

				actionObserver.recordAction(
					makeAction({
						type: IntentType.SPACE_LIGHTING_OFF,
						spaceId: 'space-1',
						deviceIds: ['light-1'],
						timestamp: new Date(baseTime.getTime()),
					}),
				);

				actionObserver.recordAction(
					makeAction({
						type: IntentType.SPACE_CLIMATE_SETPOINT_SET,
						spaceId: 'space-1',
						deviceIds: ['thermo-1'],
						timestamp: new Date(baseTime.getTime() + 90_000), // 90s apart
					}),
				);
			}

			// Should not find multi-action sequences since actions are 90s apart
			const patterns = service.detectSequencePatterns();
			const multiActionPatterns = patterns.filter((p) => p.sequence.intentTypes.length >= 2);

			expect(multiActionPatterns).toHaveLength(0);
		});

		it('should use order-independent comparison for sessions', () => {
			// Day 1: lights off, then climate
			// Day 2: climate, then lights off (same actions, different order)
			for (let day = 0; day < PATTERN_MIN_OCCURRENCES; day++) {
				const baseTime = new Date();
				baseTime.setDate(baseTime.getDate() - day);
				baseTime.setHours(22, 0, 0, 0);

				const actions =
					day % 2 === 0
						? [
								{ type: IntentType.SPACE_LIGHTING_OFF, deviceIds: ['light-1'] },
								{ type: IntentType.SPACE_CLIMATE_SETPOINT_SET, deviceIds: ['thermo-1'] },
							]
						: [
								{ type: IntentType.SPACE_CLIMATE_SETPOINT_SET, deviceIds: ['thermo-1'] },
								{ type: IntentType.SPACE_LIGHTING_OFF, deviceIds: ['light-1'] },
							];

				recordSession(actionObserver, 'space-1', actions, baseTime);
			}

			const patterns = service.detectSequencePatterns();

			// Should detect as same pattern regardless of order
			expect(patterns.length).toBeGreaterThanOrEqual(1);
		});

		it('should filter results by context spaces', async () => {
			const sessionActions = [
				{ type: IntentType.SPACE_LIGHTING_OFF, deviceIds: ['light-1'] },
				{ type: IntentType.SPACE_CLIMATE_SETPOINT_SET, deviceIds: ['thermo-1'] },
			];

			for (let day = 0; day < PATTERN_MIN_OCCURRENCES; day++) {
				const baseTime = new Date();
				baseTime.setDate(baseTime.getDate() - day);
				baseTime.setHours(22, 0, 0, 0);
				recordSession(actionObserver, 'space-2', sessionActions, baseTime);
			}

			// Context only has space-1, patterns are in space-2
			const context = makeContext({
				spaces: [{ id: 'space-1', name: 'Living Room', category: 'living_room', deviceCount: 1 }],
			});

			const results = await service.evaluate(context);

			expect(results).toHaveLength(0);
		});
	});

	// ──────────────────────────────────────────
	// Scene name generation
	// ──────────────────────────────────────────

	describe('scene name generation', () => {
		it('should generate "Morning" label for morning patterns', async () => {
			const sessionActions = [
				{ type: IntentType.SPACE_LIGHTING_ON, deviceIds: ['light-1'] },
				{ type: IntentType.SPACE_COVERS_OPEN, deviceIds: ['cover-1'] },
			];

			for (let day = 0; day < PATTERN_MIN_OCCURRENCES; day++) {
				const baseTime = new Date();
				baseTime.setDate(baseTime.getDate() - day);
				baseTime.setHours(7, 0, 0, 0);
				recordSession(actionObserver, 'space-1', sessionActions, baseTime);
			}

			const context = makeContext();
			const results = await service.evaluate(context);

			expect(results.length).toBeGreaterThanOrEqual(1);
			expect(results[0].metadata.sceneName).toContain('Morning');
		});

		it('should generate "Evening" label for evening patterns', async () => {
			const sessionActions = [
				{ type: IntentType.SPACE_LIGHTING_OFF, deviceIds: ['light-1'] },
				{ type: IntentType.SPACE_COVERS_CLOSE, deviceIds: ['cover-1'] },
			];

			for (let day = 0; day < PATTERN_MIN_OCCURRENCES; day++) {
				const baseTime = new Date();
				baseTime.setDate(baseTime.getDate() - day);
				baseTime.setHours(19, 0, 0, 0);
				recordSession(actionObserver, 'space-1', sessionActions, baseTime);
			}

			const context = makeContext();
			const results = await service.evaluate(context);

			expect(results.length).toBeGreaterThanOrEqual(1);
			expect(results[0].metadata.sceneName).toContain('Evening');
		});

		it('should include space name in scene name', async () => {
			const sessionActions = [
				{ type: IntentType.SPACE_LIGHTING_OFF, deviceIds: ['light-1'] },
				{ type: IntentType.SPACE_CLIMATE_SETPOINT_SET, deviceIds: ['thermo-1'] },
			];

			for (let day = 0; day < PATTERN_MIN_OCCURRENCES; day++) {
				const baseTime = new Date();
				baseTime.setDate(baseTime.getDate() - day);
				baseTime.setHours(14, 0, 0, 0);
				recordSession(actionObserver, 'space-1', sessionActions, baseTime);
			}

			const context = makeContext({
				spaces: [{ id: 'space-1', name: 'Bedroom', category: 'bedroom', deviceCount: 2 }],
			});

			const results = await service.evaluate(context);

			expect(results.length).toBeGreaterThanOrEqual(1);
			expect(results[0].metadata.sceneName).toBe('Bedroom Afternoon');
		});
	});

	// ──────────────────────────────────────────
	// Suggestion metadata
	// ──────────────────────────────────────────

	describe('suggestion metadata', () => {
		it('should include intent types and device IDs in metadata', async () => {
			const sessionActions = [
				{ type: IntentType.SPACE_LIGHTING_OFF, deviceIds: ['light-1'] },
				{ type: IntentType.SPACE_CLIMATE_SETPOINT_SET, deviceIds: ['thermo-1'] },
			];

			for (let day = 0; day < PATTERN_MIN_OCCURRENCES; day++) {
				const baseTime = new Date();
				baseTime.setDate(baseTime.getDate() - day);
				baseTime.setHours(22, 0, 0, 0);
				recordSession(actionObserver, 'space-1', sessionActions, baseTime);
			}

			const context = makeContext();
			const results = await service.evaluate(context);

			expect(results.length).toBeGreaterThanOrEqual(1);

			const metadata = results[0].metadata;

			expect(metadata.sequence).toBe('multi-action');
			expect(metadata.intentTypes).toEqual(
				expect.arrayContaining([IntentType.SPACE_LIGHTING_OFF, IntentType.SPACE_CLIMATE_SETPOINT_SET]),
			);
			expect(metadata.deviceIds).toEqual(expect.arrayContaining(['light-1', 'thermo-1']));
			expect(metadata.sequenceHash).toBeDefined();
			expect(metadata.occurrences).toBeGreaterThanOrEqual(PATTERN_MIN_OCCURRENCES);
		});
	});

	// ──────────────────────────────────────────
	// Caching
	// ──────────────────────────────────────────

	describe('pattern caching', () => {
		it('should cache patterns across rapid evaluate() calls', async () => {
			const sessionActions = [
				{ type: IntentType.SPACE_LIGHTING_OFF, deviceIds: ['light-1'] },
				{ type: IntentType.SPACE_CLIMATE_SETPOINT_SET, deviceIds: ['thermo-1'] },
			];

			for (let day = 0; day < PATTERN_MIN_OCCURRENCES; day++) {
				const baseTime = new Date();
				baseTime.setDate(baseTime.getDate() - day);
				baseTime.setHours(22, 0, 0, 0);
				recordSession(actionObserver, 'space-1', sessionActions, baseTime);
			}

			const spy = jest.spyOn(service, 'detectSequencePatterns');
			const context = makeContext();

			// Call evaluate multiple times in rapid succession (simulates heartbeat per space)
			await service.evaluate(context);
			await service.evaluate(context);
			await service.evaluate(context);

			// detectSequencePatterns should only be called once (cached for subsequent calls)
			expect(spy).toHaveBeenCalledTimes(1);

			spy.mockRestore();
		});
	});

	// ──────────────────────────────────────────
	// Scene creation from suggestion
	// ──────────────────────────────────────────

	describe('scene creation from suggestion', () => {
		it('should create a scene when suggestion is applied', async () => {
			const result = await service.createSceneFromSuggestion('space-1', {
				sceneName: 'Living Room Night',
				intentTypes: [IntentType.SPACE_LIGHTING_OFF, IntentType.SPACE_CLIMATE_SETPOINT_SET],
				deviceIds: ['light-1', 'thermo-1'],
			});

			expect('sceneId' in result).toBe(true);
			expect((result as { sceneId: string }).sceneId).toBe('scene-123');
			expect(scenesService.create).toHaveBeenCalledWith({
				name: 'Living Room Night',
				primary_space_id: 'space-1',
				enabled: true,
				triggerable: true,
			});
		});

		it('should use fallback name when sceneName not in metadata', async () => {
			await service.createSceneFromSuggestion('space-1', {});

			expect(scenesService.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Automated Scene' }));
		});

		it('should handle scene creation errors gracefully', async () => {
			scenesService.create.mockRejectedValue(new Error('Space not found'));

			const result = await service.createSceneFromSuggestion('space-1', {
				sceneName: 'Test Scene',
			});

			expect('error' in result).toBe(true);
			expect((result as { error: string }).error).toBe('Space not found');
		});
	});
});

import { AUTOMATIONS_MODULE_NAME } from '../../automations/automations.constants';
import { AutomationGraphIssueCode } from '../../automations/graph/graph-validator';
import { DEVICE_PROPERTY_SET_NODE_TYPE } from '../../automations/nodes/device-property-set.node-type';
import { TIME_OF_DAY_NODE_TYPE } from '../../automations/nodes/time-of-day.node-type';
import { AutomationsService } from '../../automations/services/automations.service';
import { ConfigService } from '../../config/services/config.service';
import { IntentType } from '../../intents/intents.constants';
import { ScenesService } from '../../scenes/services/scenes.service';
import { BUDDY_MODULE_NAME, SuggestionType } from '../buddy.constants';
import { EvaluatorRulesLoaderService } from '../spec/evaluator-rules-loader.service';
import { ResolvedPatternRule } from '../spec/evaluator-rules.types';

import { ActionObserverService, ActionRecord } from './action-observer.service';
import { AutomationSuggestionDraft } from './automation-suggestion-draft';
import { AUTOMATION_ROUTINE_RULE_KEY, AutomationSuggestionEvaluator } from './automation-suggestion-evaluator.service';
import { BuddyContext } from './buddy-context.service';
import { PatternDetectorService } from './pattern-detector.service';
import { SceneSuggestionEvaluator } from './scene-suggestion-evaluator.service';

const DEVICE_LIGHT = 'device-light';
const DEVICE_BLINDS = 'device-blinds';

const LIGHT = { deviceId: DEVICE_LIGHT, channelId: 'channel-light', propertyId: 'property-light-on' };
const BLINDS = { deviceId: DEVICE_BLINDS, channelId: 'channel-blinds', propertyId: 'property-blinds-position' };

const context = (spaces = [{ id: 'space-1', name: 'Living Room', category: 'living_room', deviceCount: 2 }]) =>
	({
		timestamp: new Date().toISOString(),
		timezone: 'UTC',
		spaces,
		devices: [],
		scenes: [],
		weather: null,
		energy: null,
		recentIntents: [],
	}) as BuddyContext;

let counter = 0;

const action = (
	type: IntentType,
	target: { deviceId: string; channelId?: string; propertyId?: string },
	value: unknown,
	timestamp: Date,
	spaceId = 'space-1',
): ActionRecord => ({
	intentId: `intent-${++counter}`,
	type,
	spaceId,
	deviceIds: [target.deviceId],
	targets: [target],
	value,
	timestamp,
});

/** The same time on each of the last `days` days */
const onDays = (days: number, hour: number, minute = 0): Date[] =>
	Array.from({ length: days }, (_, day) => {
		const at = new Date();

		at.setUTCDate(at.getUTCDate() - day);
		at.setUTCHours(hour, minute, 0, 0);

		return at;
	});

const rules: Record<string, ResolvedPatternRule> = {
	single_pattern: {
		enabled: true,
		suggestionType: SuggestionType.PATTERN_SCENE_CREATE,
		thresholds: { min_occurrences: 3, time_window_minutes: 60, lookback_days: 7 },
		messages: { title: '', reason: '' },
		timePeriodLabels: [],
	},
	multi_action_sequence: {
		enabled: true,
		suggestionType: SuggestionType.PATTERN_SCENE_CREATE,
		thresholds: {
			min_occurrences: 3,
			sequence_window_ms: 60000,
			time_cluster_minutes: 60,
			lookback_days: 7,
			min_actions_per_session: 2,
		},
		messages: { title: '', reason: '' },
		timePeriodLabels: [
			{ range: [5, 12], label: 'Morning' },
			{ range: [12, 17], label: 'Afternoon' },
			{ range: [17, 21], label: 'Evening' },
			{ default: 'Night' },
		],
	},
	[AUTOMATION_ROUTINE_RULE_KEY]: {
		enabled: true,
		suggestionType: SuggestionType.PATTERN_AUTOMATION_CREATE,
		thresholds: {},
		messages: {
			title: 'Automate this routine?',
			reason: 'You ${routineLabel} in ${spaceName} around ${timeLabel} regularly. Create "${automationName}"?',
		},
		timePeriodLabels: [],
	},
};

describe('AutomationSuggestionEvaluator', () => {
	let observer: ActionObserverService;
	let activeRules: Record<string, ResolvedPatternRule | undefined>;
	let checkGraph: jest.Mock;
	let moduleConfigs: Record<string, { enabled?: boolean } | undefined>;
	let evaluator: AutomationSuggestionEvaluator;

	const record = (records: ActionRecord[]): void => records.forEach((item) => observer.recordAction(item));

	/** Light on and blinds to 30 % together, at 19:00 on three days */
	const recordEveningRoutine = (): void => {
		for (const at of onDays(3, 19)) {
			record([
				action(IntentType.LIGHT_TOGGLE, LIGHT, true, at),
				action(IntentType.DEVICE_SET_PROPERTY, BLINDS, 30, new Date(at.getTime() + 5000)),
			]);
		}
	};

	beforeEach(() => {
		observer = new ActionObserverService();
		activeRules = { ...rules };
		moduleConfigs = { [AUTOMATIONS_MODULE_NAME]: { enabled: true }, [BUDDY_MODULE_NAME]: { timezone: 'UTC' } as never };
		checkGraph = jest.fn().mockResolvedValue({ valid: true, issues: [] });

		const rulesLoader = {
			getPatternRule: jest.fn((key: string) => activeRules[key]),
		} as unknown as EvaluatorRulesLoaderService;

		const configService = {
			getModuleConfig: jest.fn((name: string) => {
				const config = moduleConfigs[name];

				if (config === undefined) throw new Error('not registered');

				return config;
			}),
		} as unknown as ConfigService;

		evaluator = new AutomationSuggestionEvaluator(
			new PatternDetectorService(observer, rulesLoader, configService),
			new SceneSuggestionEvaluator(observer, {} as ScenesService, rulesLoader, configService),
			rulesLoader,
			{ checkGraph } as unknown as AutomationsService,
			configService,
		);
	});

	it('suggests nothing without a routine', async () => {
		expect(await evaluator.evaluate(context())).toEqual([]);
		expect(checkGraph).not.toHaveBeenCalled();
	});

	it('suggests an automation with the draft of a routine of several actions', async () => {
		recordEveningRoutine();

		const results = await evaluator.evaluate(context());

		expect(results).toHaveLength(1);

		const [result] = results;
		const draft = result.metadata.draft as AutomationSuggestionDraft;

		expect(result.type).toBe(SuggestionType.PATTERN_AUTOMATION_CREATE);
		expect(result.spaceId).toBe('space-1');
		expect(result.title).toBe('Automate this routine?');
		expect(result.reason).toBe(
			'You perform 2 actions in Living Room around 7 PM regularly. Create "Living Room Evening"?',
		);
		expect(result.metadata).toMatchObject({
			sequence: 'multi-action',
			sequenceHash: expect.any(String) as string,
			intentTypes: [IntentType.DEVICE_SET_PROPERTY, IntentType.LIGHT_TOGGLE],
			automationName: 'Living Room Evening',
			timeOfDay: { hour: 19, minute: 0 },
			occurrences: 3,
		});

		expect(draft.name).toBe('Living Room Evening');
		expect(draft.graph.nodes.map((node) => [node.type, node.config])).toEqual([
			[TIME_OF_DAY_NODE_TYPE, { time: '19:00' }],
			[
				DEVICE_PROPERTY_SET_NODE_TYPE,
				{
					writes: [
						{ device_id: DEVICE_LIGHT, channel_id: LIGHT.channelId, property_id: LIGHT.propertyId, value: true },
						{ device_id: DEVICE_BLINDS, channel_id: BLINDS.channelId, property_id: BLINDS.propertyId, value: 30 },
					],
				},
			],
		]);

		// Checked as a save of an enabled automation would be, safety policy included
		expect(checkGraph).toHaveBeenCalledWith(draft.graph, true);
	});

	it('suggests an automation for one action repeated at the same time', async () => {
		record(onDays(3, 7, 30).map((at) => action(IntentType.LIGHT_TOGGLE, LIGHT, false, at)));

		const results = await evaluator.evaluate(context());

		expect(results).toHaveLength(1);
		expect(results[0].metadata).toMatchObject({ sequence: 'single', intentType: IntentType.LIGHT_TOGGLE });
		expect(results[0].reason).toContain('You toggle lights in Living Room around 7:30 AM regularly');
		expect((results[0].metadata.draft as AutomationSuggestionDraft).graph.nodes[0].config).toEqual({ time: '07:30' });
		expect((results[0].metadata.draft as AutomationSuggestionDraft).name).toBe('Living Room Morning');
	});

	it('does not suggest the actions of a routine once more on their own', async () => {
		recordEveningRoutine();
		// The light alone, much later the same days: a routine of its own
		record(onDays(3, 23).map((at) => action(IntentType.LIGHT_TOGGLE, LIGHT, false, at)));

		const results = await evaluator.evaluate(context());

		expect(results.map((result) => [result.metadata.sequence, result.metadata.timeOfDay])).toEqual([
			['multi-action', { hour: 19, minute: 0 }],
			['single', { hour: 23, minute: 0 }],
		]);
	});

	it('does not suggest a routine whose draft the automations module would not save', async () => {
		recordEveningRoutine();

		checkGraph.mockResolvedValue({
			valid: false,
			issues: [
				{
					severity: 'error',
					code: AutomationGraphIssueCode.SAFETY_REDUCING_ACTION,
					message: 'An automation can not open a door.',
					blocking: true,
				},
			],
		});

		expect(await evaluator.evaluate(context())).toEqual([]);
	});

	it('does not suggest a routine whose draft could not be checked', async () => {
		recordEveningRoutine();

		checkGraph.mockRejectedValue(new Error('database gone'));

		expect(await evaluator.evaluate(context())).toEqual([]);
	});

	it('does not suggest a routine an automation can not repeat', async () => {
		// A space-wide intent names no property and no value
		for (const at of onDays(3, 19)) {
			record([
				action(IntentType.SPACE_LIGHTING_ON, { deviceId: DEVICE_LIGHT }, undefined, at),
				action(IntentType.SPACE_LIGHTING_SET_MODE, { deviceId: DEVICE_LIGHT }, { mode: 'relax' }, at),
			]);
		}

		expect(await evaluator.evaluate(context())).toEqual([]);
		expect(checkGraph).not.toHaveBeenCalled();
	});

	it('suggests only for the spaces it is asked about', async () => {
		recordEveningRoutine();

		expect(
			await evaluator.evaluate(context([{ id: 'space-2', name: 'Kitchen', category: 'kitchen', deviceCount: 1 }])),
		).toEqual([]);
	});

	it('suggests nothing when its rule is disabled', async () => {
		recordEveningRoutine();
		activeRules[AUTOMATION_ROUTINE_RULE_KEY] = { ...rules[AUTOMATION_ROUTINE_RULE_KEY], enabled: false };

		expect(await evaluator.evaluate(context())).toEqual([]);
	});

	it('follows the rules routines are found by', async () => {
		recordEveningRoutine();
		activeRules.multi_action_sequence = { ...rules.multi_action_sequence, enabled: false };
		activeRules.single_pattern = { ...rules.single_pattern, enabled: false };

		expect(await evaluator.evaluate(context())).toEqual([]);
	});

	it('suggests nothing while the automations module is disabled', async () => {
		recordEveningRoutine();
		moduleConfigs[AUTOMATIONS_MODULE_NAME] = { enabled: false };

		expect(await evaluator.evaluate(context())).toEqual([]);
	});

	it('falls back to its own wording without a rule file', async () => {
		recordEveningRoutine();
		activeRules = {};

		const [result] = await evaluator.evaluate(context());

		expect(result.type).toBe(SuggestionType.PATTERN_AUTOMATION_CREATE);
		expect(result.title).toBe('Automate this routine?');
		expect(result.reason).toContain('Create an automation "Living Room Evening" that does it for you?');
	});
});

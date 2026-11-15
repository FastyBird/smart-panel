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
const OTHER_LIGHT = {
	deviceId: 'device-other-light',
	channelId: 'channel-other-light',
	propertyId: 'property-other-light-on',
};
const LOCK = { deviceId: 'device-lock', channelId: 'channel-lock', propertyId: 'property-lock-locked' };
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

	it('suggests a single action near a routine when it sets something the routine does not', async () => {
		recordEveningRoutine();
		// Another light, half an hour after the routine
		record(onDays(3, 19, 30).map((at) => action(IntentType.LIGHT_TOGGLE, OTHER_LIGHT, false, at)));

		const results = await evaluator.evaluate(context());

		expect(results.map((result) => result.metadata.sequence)).toEqual(['multi-action', 'single']);
		expect((results[1].metadata.draft as AutomationSuggestionDraft).graph.nodes[1].config).toEqual({
			writes: [
				{
					device_id: OTHER_LIGHT.deviceId,
					channel_id: OTHER_LIGHT.channelId,
					property_id: OTHER_LIGHT.propertyId,
					value: false,
				},
			],
		});
	});

	it('suggests an action of a routine on its own when the routine itself can not be offered', async () => {
		recordEveningRoutine();

		// Writing the blinds is refused, so the whole routine is; the light alone is not
		checkGraph.mockImplementation((graph: AutomationSuggestionDraft['graph']) =>
			Promise.resolve({ valid: !JSON.stringify(graph).includes(BLINDS.propertyId), issues: [] }),
		);

		const results = await evaluator.evaluate(context());

		expect(results).toHaveLength(1);
		expect(results[0].metadata).toMatchObject({ sequence: 'single', intentType: IntentType.LIGHT_TOGGLE });
	});

	it('does not offer a routine of which only some actions can be repeated', async () => {
		// A space-wide intent sets no property; only the blinds are written as a property
		for (const at of onDays(3, 19)) {
			record([
				action(IntentType.SPACE_LIGHTING_ON, { deviceId: DEVICE_LIGHT }, undefined, at),
				action(IntentType.DEVICE_SET_PROPERTY, BLINDS, 30, new Date(at.getTime() + 5000)),
			]);
		}

		const results = await evaluator.evaluate(context());

		// The blinds alone are a routine of their own, offered as what they are; the two together are not
		expect(results.map((result) => [result.metadata.sequence, result.metadata.intentType])).toEqual([
			['single', IntentType.DEVICE_SET_PROPERTY],
		]);
	});

	it('does not offer a single action of which only some targets can be repeated', async () => {
		record(
			onDays(3, 7, 30).map((at) => ({
				...action(IntentType.LIGHT_TOGGLE, LIGHT, true, at),
				deviceIds: [DEVICE_LIGHT, 'device-lamp'],
				targets: [LIGHT, { deviceId: 'device-lamp' }],
			})),
		);

		expect(await evaluator.evaluate(context())).toEqual([]);
		expect(checkGraph).not.toHaveBeenCalled();
	});

	it('does not offer a routine that unlocks on the way, although its draft only keeps the lock', async () => {
		// Unlocked and locked again within the routine: the draft keeps the value the lock was left with
		for (const at of onDays(3, 19)) {
			record([
				action(IntentType.DEVICE_SET_PROPERTY, LOCK, false, at),
				action(IntentType.DEVICE_SET_PROPERTY, LOCK, true, new Date(at.getTime() + 5000)),
			]);
		}

		// The safety policy refuses unlocking
		const unlocks = (graph: AutomationSuggestionDraft['graph']): boolean =>
			graph.nodes.some((node) =>
				((node.config.writes ?? []) as { property_id: string; value: unknown }[]).some(
					(write) => write.property_id === LOCK.propertyId && write.value === false,
				),
			);

		checkGraph.mockImplementation((graph: AutomationSuggestionDraft['graph']) =>
			Promise.resolve({ valid: !unlocks(graph), issues: [] }),
		);

		const results = await evaluator.evaluate(context());

		expect(results.filter((result) => result.metadata.sequence === 'multi-action')).toEqual([]);
		// Asked about every observed write, as a graph only checked for safety
		expect(checkGraph).toHaveBeenCalledWith(
			expect.objectContaining({
				nodes: expect.arrayContaining([
					expect.objectContaining({
						config: {
							writes: [
								{ device_id: LOCK.deviceId, channel_id: LOCK.channelId, property_id: LOCK.propertyId, value: false },
								{ device_id: LOCK.deviceId, channel_id: LOCK.channelId, property_id: LOCK.propertyId, value: true },
							],
						},
					}),
				]) as unknown,
			}),
			false,
		);
	});

	it('compares a single action with what an offered routine leaves a property at, not with what it wrote on the way', async () => {
		// On and off again within the routine, so the routine leaves the light off ...
		for (const at of onDays(3, 19)) {
			record([
				action(IntentType.LIGHT_TOGGLE, LIGHT, true, at),
				action(IntentType.LIGHT_TOGGLE, LIGHT, false, new Date(at.getTime() + 5000)),
			]);
		}

		// ... and the light is switched on again half an hour later
		record(onDays(3, 19, 30).map((at) => action(IntentType.LIGHT_TOGGLE, LIGHT, true, at)));

		const results = await evaluator.evaluate(context());

		const writes = (index: number) =>
			(
				(results[index].metadata.draft as AutomationSuggestionDraft).graph.nodes[1].config.writes as {
					value: unknown;
				}[]
			).map((write) => write.value);

		expect(results.map((result) => result.metadata.sequence)).toEqual(['multi-action', 'single']);
		expect(writes(0)).toEqual([false]);
		expect(writes(1)).toEqual([true]);
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

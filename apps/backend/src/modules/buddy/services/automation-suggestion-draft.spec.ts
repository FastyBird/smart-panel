import { AutomationMode } from '../../automations/automations.constants';
import { AutomationGraphIssueCode } from '../../automations/graph/graph-validator';
import { AutomationNodeTypeLookup, normalizeAutomationNodeType } from '../../automations/graph/node-type';
import { checkGraphForSave } from '../../automations/graph/save-policy';
import {
	DEVICE_PROPERTY_SET_MAX_WRITES,
	DEVICE_PROPERTY_SET_NODE_TYPE,
	createDevicePropertySetNodeType,
} from '../../automations/nodes/device-property-set.node-type';
import { DevicePropertyInfo } from '../../automations/nodes/device-property.utils';
import { TIME_OF_DAY_NODE_TYPE, createTimeOfDayNodeType } from '../../automations/nodes/time-of-day.node-type';
import { ActionSafetyPolicy } from '../../automations/safety/action-safety-policy';
import { SafetyWriteTarget } from '../../automations/safety/safety-rules';
import {
	CHANNEL_A,
	DEVICE_A,
	FIXTURE_PROPERTIES,
	PROPERTY_BOOL,
	PROPERTY_NUMBER,
	PROPERTY_READ_ONLY,
} from '../../automations/testing/node-fixtures';
import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../devices/devices.constants';

import {
	AUTOMATION_SUGGESTION_ACTION_NODE_ID,
	AUTOMATION_SUGGESTION_TRIGGER_NODE_ID,
	AutomationSuggestionRoutine,
	buildAutomationSuggestionDraft,
	formatDraftTime,
	toDraftWrites,
	toObservedWrites,
	withObservedWrites,
} from './automation-suggestion-draft';

const PROPERTY_LOCK = '0d9f0a3e-6f5c-4d7e-9a43-1f1f0c00a001';

const write = (propertyId: string, value: unknown) => ({
	deviceId: DEVICE_A,
	channelId: CHANNEL_A,
	propertyId,
	value,
});

const routine = (overrides: Partial<AutomationSuggestionRoutine> = {}): AutomationSuggestionRoutine => ({
	name: 'Living Room Evening',
	timeOfDay: { hour: 19, minute: 5 },
	actions: [write(PROPERTY_BOOL, true), write(PROPERTY_NUMBER, 21.5)],
	...overrides,
});

describe('formatDraftTime', () => {
	it.each([
		[0, 0, '00:00'],
		[7, 5, '07:05'],
		[23, 59, '23:59'],
	])('writes %i:%i as %s', (hour, minute, expected) => {
		expect(formatDraftTime(hour, minute)).toBe(expected);
	});

	it.each([
		[24, 0],
		[-1, 0],
		[10, 60],
		[10.5, 0],
	])('refuses %d:%d', (hour, minute) => {
		expect(formatDraftTime(hour, minute)).toBeNull();
	});
});

describe('toDraftWrites', () => {
	it('maps the observed writes to the writes of the action', () => {
		expect(toDraftWrites([write(PROPERTY_BOOL, true)])).toEqual([
			{ device_id: DEVICE_A, channel_id: CHANNEL_A, property_id: PROPERTY_BOOL, value: true },
		]);
	});

	it('leaves out writes an automation can not repeat', () => {
		expect(
			toDraftWrites([
				write(PROPERTY_BOOL, undefined),
				write(PROPERTY_BOOL, { mode: 'relax' }),
				write(PROPERTY_BOOL, Number.NaN),
				{ deviceId: DEVICE_A, propertyId: PROPERTY_NUMBER, value: 3 },
				{ deviceId: DEVICE_A, channelId: CHANNEL_A, value: true },
			]),
		).toEqual([]);
	});

	it('keeps the value a property was left with, in the order the values were left', () => {
		expect(
			toDraftWrites([write(PROPERTY_BOOL, true), write(PROPERTY_NUMBER, 10), write(PROPERTY_BOOL, false)]).map(
				(item) => [item.property_id, item.value],
			),
		).toEqual([
			[PROPERTY_NUMBER, 10],
			[PROPERTY_BOOL, false],
		]);
	});
});

describe('toObservedWrites', () => {
	it('keeps every observed write, in the order it was done', () => {
		expect(
			toObservedWrites([write(PROPERTY_BOOL, false), write(PROPERTY_NUMBER, 10), write(PROPERTY_BOOL, true)]).map(
				(item) => [item.property_id, item.value],
			),
		).toEqual([
			[PROPERTY_BOOL, false],
			[PROPERTY_NUMBER, 10],
			[PROPERTY_BOOL, true],
		]);
	});

	it('puts every observed write into the action of the draft', () => {
		const actions = [write(PROPERTY_BOOL, false), write(PROPERTY_BOOL, true)];
		const draft = buildAutomationSuggestionDraft(routine({ actions }));

		expect(draft?.graph.nodes[1].config).toEqual({ writes: [expect.objectContaining({ value: true })] });
		expect(withObservedWrites(draft, actions).nodes[1].config).toEqual({
			writes: [expect.objectContaining({ value: false }), expect.objectContaining({ value: true })],
		});
		// The trigger is the one of the draft
		expect(withObservedWrites(draft, actions).nodes[0]).toEqual(draft?.graph.nodes[0]);
	});
});

describe('buildAutomationSuggestionDraft', () => {
	it('builds a time trigger wired to one action with the observed writes', () => {
		const draft = buildAutomationSuggestionDraft(routine());

		expect(draft).toEqual({
			name: 'Living Room Evening',
			mode: AutomationMode.SINGLE,
			graph: {
				version: 1,
				nodes: [
					{
						id: AUTOMATION_SUGGESTION_TRIGGER_NODE_ID,
						type: TIME_OF_DAY_NODE_TYPE,
						position: { x: 0, y: 0 },
						config: { time: '19:05' },
					},
					{
						id: AUTOMATION_SUGGESTION_ACTION_NODE_ID,
						type: DEVICE_PROPERTY_SET_NODE_TYPE,
						position: { x: 360, y: 0 },
						config: {
							writes: [
								{ device_id: DEVICE_A, channel_id: CHANNEL_A, property_id: PROPERTY_BOOL, value: true },
								{ device_id: DEVICE_A, channel_id: CHANNEL_A, property_id: PROPERTY_NUMBER, value: 21.5 },
							],
						},
					},
				],
				edges: [
					{
						id: 'e1',
						source: AUTOMATION_SUGGESTION_TRIGGER_NODE_ID,
						source_port: 'out',
						target: AUTOMATION_SUGGESTION_ACTION_NODE_ID,
						target_port: 'in',
					},
				],
			},
		});
	});

	it('starts on the weekdays of the routine when it has them', () => {
		const draft = buildAutomationSuggestionDraft(routine({ weekdays: [5, 1, 3, 1] }));

		expect(draft?.graph.nodes[0].config).toEqual({ time: '19:05', weekdays: [1, 3, 5] });
	});

	it('starts every day when the routine happens on every weekday', () => {
		const draft = buildAutomationSuggestionDraft(routine({ weekdays: [0, 1, 2, 3, 4, 5, 6] }));

		expect(draft?.graph.nodes[0].config).toEqual({ time: '19:05' });
	});

	it('is not built when no write can be repeated', () => {
		expect(buildAutomationSuggestionDraft(routine({ actions: [write(PROPERTY_BOOL, undefined)] }))).toBeNull();
		expect(buildAutomationSuggestionDraft(routine({ actions: [] }))).toBeNull();
	});

	it('is not built when one of the observed writes can not be repeated', () => {
		// The draft would do only part of what was observed
		expect(
			buildAutomationSuggestionDraft(
				routine({ actions: [write(PROPERTY_BOOL, true), write(PROPERTY_NUMBER, undefined)] }),
			),
		).toBeNull();
		expect(
			buildAutomationSuggestionDraft(
				routine({ actions: [write(PROPERTY_BOOL, true), { deviceId: DEVICE_A, channelId: CHANNEL_A, value: 3 }] }),
			),
		).toBeNull();
	});

	it('is not built when the routine writes more than one action takes', () => {
		const actions = Array.from({ length: DEVICE_PROPERTY_SET_MAX_WRITES + 1 }, (_, index) =>
			write(`0d9f0a3e-6f5c-4d7e-9a43-${index.toString().padStart(12, '0')}`, true),
		);

		expect(buildAutomationSuggestionDraft(routine({ actions }))).toBeNull();
	});

	it('is not built for a time that is not one', () => {
		expect(buildAutomationSuggestionDraft(routine({ timeOfDay: { hour: 24, minute: 0 } }))).toBeNull();
	});

	it('keeps the name within what an automation name may be', () => {
		expect(buildAutomationSuggestionDraft(routine({ name: 'x'.repeat(150) }))?.name).toHaveLength(100);
		expect(buildAutomationSuggestionDraft(routine({ name: '  ' }))?.name).toBe('Routine');
	});

	describe('against the automations save policy', () => {
		const lockInfo: DevicePropertyInfo = {
			id: PROPERTY_LOCK,
			channelId: CHANNEL_A,
			deviceId: DEVICE_A,
			dataType: DataTypeType.BOOL,
			format: null,
			invalid: null,
			step: null,
			permissions: [PermissionType.READ_WRITE],
		};

		const properties = [...FIXTURE_PROPERTIES, lockInfo];

		const registered = new Map([
			[
				TIME_OF_DAY_NODE_TYPE,
				normalizeAutomationNodeType(createTimeOfDayNodeType({ onTimeOfDay: () => () => undefined })),
			],
			[
				DEVICE_PROPERTY_SET_NODE_TYPE,
				normalizeAutomationNodeType(
					createDevicePropertySetNodeType({
						commands: { executePropertyCommands: jest.fn() },
						findProperty: (id) => Promise.resolve(properties.find((item) => item.id === id) ?? null),
					}),
				),
			],
		]);

		const lookup: AutomationNodeTypeLookup = (type) => registered.get(type);

		const targets: Record<string, SafetyWriteTarget> = {
			[PROPERTY_LOCK]: {
				deviceCategory: DeviceCategory.LOCK,
				channelCategory: ChannelCategory.LOCK,
				propertyCategory: PropertyCategory.ON,
			},
		};

		const policy = new ActionSafetyPolicy({
			findTarget: (id) =>
				Promise.resolve(
					targets[id] ?? {
						deviceCategory: DeviceCategory.LIGHTING,
						channelCategory: ChannelCategory.LIGHT,
						propertyCategory: null,
					},
				),
			listSceneActions: () => Promise.resolve([]),
		});

		// What `AutomationSafetyService.checkGraph` does with the findings of the policy
		const safety = async (nodeType: { commands: (config: unknown) => never[] }, config: unknown) =>
			(await policy.inspect(nodeType.commands(config))).map((finding) => ({
				severity: 'error' as const,
				message: finding.reason,
				...(finding.field !== undefined ? { field: finding.field } : {}),
			}));

		const check = (draft: ReturnType<typeof buildAutomationSuggestionDraft>) =>
			checkGraphForSave(draft?.graph, lookup, { enabled: true, safety: safety as never });

		it('passes as an enabled automation', async () => {
			const result = await check(buildAutomationSuggestionDraft(routine({ weekdays: [1, 2, 3, 4, 5] })));

			expect(result.issues).toEqual([]);
			expect(result.valid).toBe(true);
		});

		it('is refused when a write reduces safety', async () => {
			const result = await check(
				buildAutomationSuggestionDraft(routine({ actions: [write(PROPERTY_BOOL, true), write(PROPERTY_LOCK, false)] })),
			);

			expect(result.valid).toBe(false);
			expect(result.issues.map((issue) => issue.code)).toContain(AutomationGraphIssueCode.SAFETY_REDUCING_ACTION);
		});

		it('is refused for every observed write, also one the draft folds away', async () => {
			const actions = [write(PROPERTY_LOCK, false), write(PROPERTY_LOCK, true)];
			const draft = buildAutomationSuggestionDraft(routine({ actions }));

			// The draft keeps the lock only and would pass by itself ...
			expect((await check(draft)).valid).toBe(true);

			// ... but the routine unlocked on the way, which the observed writes show
			const observed = await checkGraphForSave(withObservedWrites(draft, actions), lookup, {
				enabled: false,
				safety: safety as never,
			});

			expect(observed.valid).toBe(false);
			expect(observed.issues.map((issue) => issue.code)).toContain(AutomationGraphIssueCode.SAFETY_REDUCING_ACTION);
		});

		it('is refused when a write names a property that can not be set', async () => {
			const result = await check(
				buildAutomationSuggestionDraft(routine({ actions: [write(PROPERTY_READ_ONLY, true)] })),
			);

			expect(result.valid).toBe(false);
			expect(result.issues.map((issue) => issue.code)).toContain(AutomationGraphIssueCode.INVALID_CONFIG);
		});
	});
});

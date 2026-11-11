import { AutomationTriggerData, normalizeAutomationNodeType } from '../graph/node-type';
import { FakeTrackerClock } from '../testing/fake-tracker-clock';
import {
	CHANNEL_A,
	CHANNEL_B,
	DEVICE_A,
	DEVICE_B,
	PROPERTY_BOOL,
	PROPERTY_ENUM,
	PROPERTY_MISSING,
	PROPERTY_NUMBER,
	fixtureFindProperty,
	target,
} from '../testing/node-fixtures';
import { StateTracker } from '../tracker/state-tracker';

import {
	DEVICE_PROPERTY_CHANGED_NODE_TYPE,
	DevicePropertyChangedConfigDto,
	createDevicePropertyChangedNodeType,
	toStateWatchSpec,
} from './device-property-changed.node-type';

describe('device.property.changed', () => {
	let clock: FakeTrackerClock;
	let tracker: StateTracker;
	let fired: AutomationTriggerData[];

	const card = () => createDevicePropertyChangedNodeType({ tracker, findProperty: fixtureFindProperty });

	const subscribe = (config: Record<string, unknown>): (() => void) =>
		card().subscribe(config as unknown as DevicePropertyChangedConfigDto, (data) => fired.push(data));

	const problems = (config: Record<string, unknown>) => card().validateConfig(config);

	beforeEach(() => {
		clock = new FakeTrackerClock();
		tracker = new StateTracker(clock);
		fired = [];
	});

	it('is a trigger with one output that lists its device, channel and property', () => {
		const registered = normalizeAutomationNodeType(card());

		expect(registered).toMatchObject({
			type: DEVICE_PROPERTY_CHANGED_NODE_TYPE,
			kind: 'trigger',
			ports: { inputs: [], outputs: ['out'] },
		});
		expect(registered.references(target(PROPERTY_BOOL))).toEqual([
			{ kind: 'device', id: DEVICE_A },
			{ kind: 'channel', id: CHANNEL_A },
			{ kind: 'property', id: PROPERTY_BOOL },
		]);
		expect(registered.references({})).toEqual([]);
	});

	describe('configuration', () => {
		it.each([
			['any change', {}],
			['to a value', { to: true }],
			['from a value', { from: false }],
			['from one value to another', { from: false, to: true }],
			['to a value for a time', { to: false, for_seconds: 120 }],
		])('accepts %s', async (_name, extra) => {
			expect(await problems({ ...target(PROPERTY_BOOL), ...extra })).toEqual([]);
		});

		it.each([
			['above a threshold', { above: 25 }],
			['below a threshold with a hysteresis', { below: 50, hysteresis: 5 }],
			['above a threshold for a time', { above: 25, for_seconds: 600 }],
			['to a number', { to: 21.5 }],
		])('accepts %s on a numeric property', async (_name, extra) => {
			expect(await problems({ ...target(PROPERTY_NUMBER), ...extra })).toEqual([]);
		});

		it('needs a device, a channel and a property', async () => {
			expect((await problems({})).map((problem) => problem.field).sort()).toEqual([
				'channel_id',
				'device_id',
				'property_id',
			]);
			expect(await problems({ ...target(PROPERTY_BOOL), property_id: 'p-1' })).toEqual([
				{ field: 'property_id', reason: 'A property must be chosen.' },
			]);
		});

		it('refuses a duration with "from" or with any change: there is no state that could hold', async () => {
			const reason = 'A duration needs a target state ("to", "above" or "below") and can not be used with "from".';

			expect(await problems({ ...target(PROPERTY_BOOL), for_seconds: 60 })).toEqual([{ field: 'for_seconds', reason }]);
			expect(await problems({ ...target(PROPERTY_BOOL), from: true, for_seconds: 60 })).toEqual([
				{ field: 'for_seconds', reason },
			]);
			expect(await problems({ ...target(PROPERTY_BOOL), from: true, to: false, for_seconds: 60 })).toEqual([
				{ field: 'for_seconds', reason },
			]);
		});

		it.each([
			['a duration of zero', { to: true, for_seconds: 0 }, 'for_seconds'],
			['a duration that is not whole', { to: true, for_seconds: 1.5 }, 'for_seconds'],
			['a duration longer than seven days', { to: true, for_seconds: 7 * 24 * 3600 + 1 }, 'for_seconds'],
			['a negative hysteresis', { above: 20, hysteresis: -1 }, 'hysteresis'],
			['a hysteresis without a threshold', { to: 1, hysteresis: 1 }, 'hysteresis'],
			['above and below together', { above: 20, below: 10 }, 'below'],
			['a threshold with "to"', { above: 20, to: 25 }, 'to'],
			['a threshold that is not a number', { above: '20' }, 'above'],
			['a value that is a list', { to: [true] }, 'to'],
			['an unknown property', { level: 3 }, 'level'],
		])('refuses %s', async (_name, extra, field) => {
			const found = await problems({ ...target(PROPERTY_NUMBER), ...extra });

			expect(found.map((problem) => problem.field)).toContain(field);
		});

		it('never repeats the submitted value in a reason', async () => {
			const found = await problems({ ...target(PROPERTY_BOOL), to: { secret: 'hunter2' }, extra: 'hunter2' });

			expect(found.length).toBeGreaterThan(0);
			expect(JSON.stringify(found)).not.toContain('hunter2');
		});

		it('refuses a threshold on a property that does not hold a number', async () => {
			expect(await problems({ ...target(PROPERTY_BOOL), above: 1 })).toEqual([
				{ field: 'above', reason: '"above" can be used only with a property that holds a number.' },
			]);
		});

		it('refuses a value the property can not hold', async () => {
			expect(await problems({ ...target(PROPERTY_BOOL), to: 'on' })).toEqual([
				{ field: 'to', reason: 'This property holds a yes/no value.' },
			]);
			expect(await problems({ ...target(PROPERTY_NUMBER), from: true })).toEqual([
				{ field: 'from', reason: 'This property holds a number.' },
			]);
			expect(await problems({ ...target(PROPERTY_ENUM), to: 'dry' })).toEqual([
				{ field: 'to', reason: 'This value is not one the property can hold.' },
			]);
			expect(await problems({ ...target(PROPERTY_ENUM), to: 'heat' })).toEqual([]);
		});

		it('refuses a property that is not the one of the named channel and device', async () => {
			expect(await problems({ ...target(PROPERTY_BOOL, DEVICE_B, CHANNEL_B), to: true })).toEqual([
				{ field: 'channel_id', reason: 'The property does not belong to this channel.' },
				{ field: 'device_id', reason: 'The property does not belong to this device.' },
			]);
		});

		it('leaves a property that does not exist, or can not be looked up, to the engine', async () => {
			expect(await problems({ ...target(PROPERTY_MISSING), to: 'anything' })).toEqual([]);

			const failing = createDevicePropertyChangedNodeType({
				tracker,
				findProperty: () => Promise.reject(new Error('database is locked')),
			});

			expect(await failing.validateConfig({ ...target(PROPERTY_BOOL), to: true })).toEqual([]);
		});

		it('describes its configuration for a form', () => {
			expect(card().configSchema).toMatchObject({
				type: 'object',
				required: ['device_id', 'channel_id', 'property_id'],
				additionalProperties: false,
				properties: {
					property_id: { type: 'string', format: 'uuid' },
					to: { type: ['string', 'number', 'boolean'] },
					above: { type: 'number' },
					hysteresis: { type: 'number', minimum: 0 },
					for_seconds: { type: 'integer', minimum: 1, maximum: 604800 },
				},
			});
		});

		it('declares in its schema exactly the properties its configuration accepts', async () => {
			const schema = card().configSchema as { properties: Record<string, unknown> };
			const accepted = {
				...target(PROPERTY_NUMBER),
				to: 1,
				from: 2,
				above: 1,
				below: 1,
				hysteresis: 1,
				for_seconds: 1,
			};

			const refused = (await problems({ ...accepted, other: 1 })).filter(
				(problem) => problem.reason === 'This property is not allowed.',
			);

			expect(Object.keys(schema.properties).sort()).toEqual(Object.keys(accepted).sort());
			expect(refused).toEqual([{ field: 'other', reason: 'This property is not allowed.' }]);
		});
	});

	describe('the watch it asks for', () => {
		it('leaves out what is not set, and treats null as not set', () => {
			expect(toStateWatchSpec({ ...target(PROPERTY_BOOL) })).toEqual({ propertyId: PROPERTY_BOOL });
			expect(
				toStateWatchSpec({
					...target(PROPERTY_BOOL),
					to: null,
					for_seconds: null,
				} as unknown as DevicePropertyChangedConfigDto),
			).toEqual({ propertyId: PROPERTY_BOOL });
			expect(toStateWatchSpec({ ...target(PROPERTY_NUMBER), below: 50, hysteresis: 5, for_seconds: 30 })).toEqual({
				propertyId: PROPERTY_NUMBER,
				below: 50,
				hysteresis: 5,
				forSeconds: 30,
			});
		});
	});

	describe('firing', () => {
		it('fires on a change to the value, not on a repeated report and not for the first value', () => {
			subscribe({ ...target(PROPERTY_BOOL), to: true });

			tracker.report(PROPERTY_BOOL, { value: false });
			expect(fired).toEqual([]);

			tracker.report(PROPERTY_BOOL, { value: true });
			tracker.report(PROPERTY_BOOL, { value: true });

			expect(fired).toEqual([{ property_id: PROPERTY_BOOL, from: false, to: true }]);
		});

		it('fires on any change when nothing is asked for', () => {
			subscribe(target(PROPERTY_NUMBER));

			tracker.seed(PROPERTY_NUMBER, { value: 20 });
			tracker.report(PROPERTY_NUMBER, { value: 21 });
			tracker.report(PROPERTY_NUMBER, { value: 21 });
			tracker.report(PROPERTY_NUMBER, { value: 19 });

			expect(fired).toEqual([
				{ property_id: PROPERTY_NUMBER, from: 20, to: 21 },
				{ property_id: PROPERTY_NUMBER, from: 21, to: 19 },
			]);
		});

		it('fires only from the named value', () => {
			subscribe({ ...target(PROPERTY_ENUM), from: 'off' });

			tracker.seed(PROPERTY_ENUM, { value: 'heat' });
			tracker.report(PROPERTY_ENUM, { value: 'cool' });
			tracker.report(PROPERTY_ENUM, { value: 'off' });
			tracker.report(PROPERTY_ENUM, { value: 'heat' });

			expect(fired).toEqual([{ property_id: PROPERTY_ENUM, from: 'off', to: 'heat' }]);
		});

		it('fires on crossing a threshold, not while the value stays beyond it', () => {
			subscribe({ ...target(PROPERTY_NUMBER), below: 50 });

			tracker.seed(PROPERTY_NUMBER, { value: 80 });
			tracker.report(PROPERTY_NUMBER, { value: 40 });
			tracker.report(PROPERTY_NUMBER, { value: 30 });
			tracker.report(PROPERTY_NUMBER, { value: 60 });
			tracker.report(PROPERTY_NUMBER, { value: 45 });

			expect(fired.map((data) => data.to)).toEqual([40, 45]);
		});

		it('fires after the state has held for the duration, and not when it was left in between', () => {
			subscribe({ ...target(PROPERTY_BOOL), to: false, for_seconds: 120 });

			tracker.seed(PROPERTY_BOOL, { value: true });
			tracker.report(PROPERTY_BOOL, { value: false });
			clock.advanceSeconds(60);

			// Somebody came back
			tracker.report(PROPERTY_BOOL, { value: true });
			clock.advanceSeconds(300);
			expect(fired).toEqual([]);

			tracker.report(PROPERTY_BOOL, { value: false });
			clock.advanceSeconds(119);
			expect(fired).toEqual([]);

			clock.advanceSeconds(1);
			expect(fired).toEqual([{ property_id: PROPERTY_BOOL, to: false, held_for_seconds: 120 }]);
		});

		it('does not fire for a duration when the device went offline in between', () => {
			subscribe({ ...target(PROPERTY_BOOL), to: false, for_seconds: 120 });

			tracker.seed(PROPERTY_BOOL, { value: true });
			tracker.report(PROPERTY_BOOL, { value: false });
			clock.advanceSeconds(30);
			tracker.setAvailability(PROPERTY_BOOL, { online: false });
			clock.advanceSeconds(600);

			expect(fired).toEqual([]);
		});

		it('marks a duration that started from a state that already held', () => {
			tracker.reference(PROPERTY_BOOL);
			tracker.seed(PROPERTY_BOOL, { value: false });

			subscribe({ ...target(PROPERTY_BOOL), to: false, for_seconds: 10 });
			clock.advanceSeconds(10);

			expect(fired).toEqual([{ property_id: PROPERTY_BOOL, to: false, held_for_seconds: 10, rearmed: true }]);
		});

		it('stops firing, and drops a running duration, once released', () => {
			const release = subscribe({ ...target(PROPERTY_BOOL), to: false, for_seconds: 10 });

			tracker.seed(PROPERTY_BOOL, { value: true });
			tracker.report(PROPERTY_BOOL, { value: false });

			expect(tracker.pendingTimers()).toBe(1);

			release();
			clock.advanceSeconds(60);

			expect(fired).toEqual([]);
			expect(tracker.pendingTimers()).toBe(0);
			expect(tracker.trackedCount()).toBe(0);
		});

		it('does not fire from inside subscribe', () => {
			tracker.reference(PROPERTY_BOOL);
			tracker.seed(PROPERTY_BOOL, { value: true });

			subscribe({ ...target(PROPERTY_BOOL), to: true });

			expect(fired).toEqual([]);
		});
	});
});

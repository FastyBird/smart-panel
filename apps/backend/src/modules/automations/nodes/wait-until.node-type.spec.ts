import { AutomationWaitEvent, AutomationWaitStart, normalizeAutomationNodeType } from '../graph/node-type';
import { FakeTrackerClock } from '../testing/fake-tracker-clock';
import {
	CHANNEL_A,
	CHANNEL_B,
	DEVICE_A,
	PROPERTY_BOOL,
	PROPERTY_ENUM,
	PROPERTY_NUMBER,
	fixtureFindProperty,
	runContext,
	target,
} from '../testing/node-fixtures';
import { StateTracker } from '../tracker/state-tracker';

import { WAIT_UNTIL_NODE_TYPE, WaitUntilConfigDto, createWaitUntilNodeType } from './wait-until.node-type';

describe('flow.wait-until', () => {
	let clock: FakeTrackerClock;
	let tracker: StateTracker;
	let settled: jest.Mock;
	let events: AutomationWaitEvent[];
	let held: (() => void)[];

	const card = () =>
		createWaitUntilNodeType({
			tracker: {
				watch: (spec, fire) => tracker.watch(spec, fire),
				read: (propertyId) => tracker.read(propertyId),
				settled,
			},
			findProperty: fixtureFindProperty,
		});

	const problems = (config: Record<string, unknown>) => card().validateConfig(config);

	const wait = (config: Record<string, unknown>): Promise<AutomationWaitStart> =>
		card().wait(
			{ timeout_seconds: 30, ...config } as unknown as WaitUntilConfigDto,
			(event) => events.push(event),
			runContext(),
		);

	/** Keeps a value for the property, the way the engine does for every property an automation refers to */
	const known = (propertyId: string, value: boolean | number | string | null, online = true): void => {
		held.push(tracker.reference(propertyId));
		tracker.seed(propertyId, { value, online });
	};

	beforeEach(() => {
		clock = new FakeTrackerClock();
		tracker = new StateTracker(clock);
		settled = jest.fn(() => Promise.resolve());
		events = [];
		held = [];
	});

	afterEach(() => {
		for (const release of held) release();
	});

	it('is a flow block with an out and a timeout output that lists its device, channel and property', () => {
		const registered = normalizeAutomationNodeType(card());

		expect(registered).toMatchObject({
			type: WAIT_UNTIL_NODE_TYPE,
			kind: 'flow',
			ports: { inputs: ['in'], outputs: ['out', 'timeout'] },
		});
		expect(card().flow).toBe('wait_until');
		expect(card().timeoutSeconds({ timeout_seconds: 90 } as WaitUntilConfigDto)).toBe(90);
		expect(registered.references(target(PROPERTY_BOOL))).toEqual([
			{ kind: 'device', id: DEVICE_A },
			{ kind: 'channel', id: CHANNEL_A },
			{ kind: 'property', id: PROPERTY_BOOL },
		]);
	});

	describe('configuration', () => {
		it.each([
			['a value', PROPERTY_BOOL, { to: true }],
			['a value of a list', PROPERTY_ENUM, { to: 'heat' }],
			['above a threshold', PROPERTY_NUMBER, { above: 25 }],
			['below a threshold', PROPERTY_NUMBER, { below: 10 }],
		])('accepts waiting for %s', async (_name, propertyId, extra) => {
			expect(await problems({ ...target(propertyId), ...extra, timeout_seconds: 60 })).toEqual([]);
		});

		it('needs a timeout, at most one hour', async () => {
			expect(await problems({ ...target(PROPERTY_BOOL), to: true, timeout_seconds: 3600 })).toEqual([]);
			expect((await problems({ ...target(PROPERTY_BOOL), to: true })).map((problem) => problem.field)).toContain(
				'timeout_seconds',
			);
			expect(await problems({ ...target(PROPERTY_BOOL), to: true, timeout_seconds: 3601 })).toEqual([
				{ field: 'timeout_seconds', reason: 'The timeout must be at most 3600 seconds (1 hour).' },
			]);
			expect(await problems({ ...target(PROPERTY_BOOL), to: true, timeout_seconds: 0 })).toEqual([
				{ field: 'timeout_seconds', reason: 'The timeout must be at least 1 second.' },
			]);
			expect(await problems({ ...target(PROPERTY_BOOL), to: true, timeout_seconds: 1.5 })).toEqual([
				{ field: 'timeout_seconds', reason: 'The timeout must be a whole number of seconds.' },
			]);
		});

		it('needs a state to wait for', async () => {
			expect(await problems({ ...target(PROPERTY_BOOL), timeout_seconds: 30 })).toEqual([
				{ field: 'to', reason: 'A state to wait for is needed: "to", "above" or "below".' },
			]);
		});

		it('refuses states that can not be combined', async () => {
			expect(await problems({ ...target(PROPERTY_NUMBER), above: 5, below: 1, timeout_seconds: 30 })).toEqual([
				{ field: 'below', reason: '"above" and "below" can not be used together.' },
			]);
			expect(await problems({ ...target(PROPERTY_NUMBER), above: 5, to: 7, timeout_seconds: 30 })).toEqual([
				{ field: 'to', reason: '"above" and "below" can not be combined with "to" or "from".' },
			]);
		});

		it('refuses what names no state, such as "from"', async () => {
			expect(await problems({ ...target(PROPERTY_BOOL), from: false, to: true, timeout_seconds: 30 })).toEqual([
				{ field: 'from', reason: 'This property is not allowed.' },
			]);
		});

		it('checks the state against the property', async () => {
			expect(await problems({ ...target(PROPERTY_BOOL), above: 5, timeout_seconds: 30 })).toEqual([
				{ field: 'above', reason: '"above" can be used only with a property that holds a number.' },
			]);
			expect(await problems({ ...target(PROPERTY_BOOL), to: 'on', timeout_seconds: 30 })).toEqual([
				{ field: 'to', reason: 'This property holds a yes/no value.' },
			]);
			expect(await problems({ ...target(PROPERTY_BOOL, DEVICE_A, CHANNEL_B), to: true, timeout_seconds: 30 })).toEqual([
				{ field: 'channel_id', reason: 'The property does not belong to this channel.' },
			]);
		});
	});

	describe('waiting', () => {
		it('passes at once when the state already holds, and watches nothing', async () => {
			known(PROPERTY_BOOL, true);

			expect(await wait({ ...target(PROPERTY_BOOL), to: true })).toEqual({ holds: true, observed: true });
			expect(tracker.trackedCount()).toBe(1);

			tracker.report(PROPERTY_BOOL, { value: false });
			tracker.report(PROPERTY_BOOL, { value: true });

			expect(events).toEqual([]);
		});

		it('waits while the state does not hold and resumes when a report puts the value there', async () => {
			known(PROPERTY_BOOL, false);

			const start = await wait({ ...target(PROPERTY_BOOL), to: true });

			expect(start).toMatchObject({
				holds: false,
				observed: false,
				reason: 'The value is not in the awaited state yet.',
			});

			tracker.report(PROPERTY_BOOL, { value: false });

			expect(events).toEqual([]);

			tracker.report(PROPERTY_BOOL, { value: true });

			expect(events).toEqual([{ observed: true }]);

			(start as Extract<AutomationWaitStart, { holds: false }>).release();
			tracker.report(PROPERTY_BOOL, { value: false });
			tracker.report(PROPERTY_BOOL, { value: true });

			expect(events).toHaveLength(1);
		});

		it('resumes when a numeric value crosses the threshold', async () => {
			known(PROPERTY_NUMBER, 20);

			expect(await wait({ ...target(PROPERTY_NUMBER), above: 25 })).toMatchObject({ holds: false, observed: 20 });

			tracker.report(PROPERTY_NUMBER, { value: 24 });
			tracker.report(PROPERTY_NUMBER, { value: 26.5 });

			expect(events).toEqual([{ observed: 26.5 }]);
		});

		it('does not take an offline device for the state: it waits for a fresh report', async () => {
			known(PROPERTY_BOOL, true, false);

			expect(await wait({ ...target(PROPERTY_BOOL), to: true })).toMatchObject({
				holds: false,
				observed: true,
				reason: 'The device is offline.',
			});

			tracker.report(PROPERTY_BOOL, { value: true, online: true });

			expect(events).toEqual([{ observed: true }]);
		});

		it('looks again once the baseline of a property referenced a moment ago has been read', async () => {
			held.push(tracker.reference(PROPERTY_BOOL));
			settled.mockImplementation(() => {
				tracker.seed(PROPERTY_BOOL, { value: true });

				return Promise.resolve();
			});

			expect(await wait({ ...target(PROPERTY_BOOL), to: true })).toEqual({ holds: true, observed: true });
			expect(settled).toHaveBeenCalledTimes(1);
		});

		it('waits for a property with no value at all, and resumes on its first report in the state', async () => {
			held.push(tracker.reference(PROPERTY_BOOL));

			expect(await wait({ ...target(PROPERTY_BOOL), to: true })).toMatchObject({
				holds: false,
				reason: 'The property has no known value yet.',
			});

			tracker.report(PROPERTY_BOOL, { value: true });

			expect(events).toEqual([{ observed: true }]);
		});

		it('lets go of its watch at once when the run is aborted while the baseline is still being read', () => {
			settled.mockReturnValue(new Promise<void>(() => undefined));

			const controller = new AbortController();
			const start = card().wait(
				{ ...target(PROPERTY_BOOL), to: true, timeout_seconds: 30 } as unknown as WaitUntilConfigDto,
				(event) => events.push(event),
				runContext({ signal: controller.signal }),
			);

			expect(tracker.trackedCount()).toBe(1);

			controller.abort();

			expect(tracker.trackedCount()).toBe(0);

			held.push(tracker.reference(PROPERTY_BOOL));
			tracker.seed(PROPERTY_BOOL, { value: false });
			tracker.report(PROPERTY_BOOL, { value: true });

			expect(events).toEqual([]);

			void start;
		});

		it('watches nothing for a run that was aborted before it arrived', async () => {
			const controller = new AbortController();

			controller.abort();

			const start = await card().wait(
				{ ...target(PROPERTY_BOOL), to: true, timeout_seconds: 30 } as unknown as WaitUntilConfigDto,
				(event) => events.push(event),
				runContext({ signal: controller.signal }),
			);

			expect(settled).not.toHaveBeenCalled();
			expect(tracker.trackedCount()).toBe(0);

			// Releasing what was already let go does no harm
			(start as Extract<AutomationWaitStart, { holds: false }>).release();

			expect(tracker.trackedCount()).toBe(0);
		});

		it('lets go of its watch when it fails', async () => {
			settled.mockRejectedValue(new Error('the database is gone'));

			await expect(wait({ ...target(PROPERTY_BOOL), to: true })).rejects.toThrow('the database is gone');
			expect(tracker.trackedCount()).toBe(0);
		});
	});
});

import { FakeTrackerClock } from '../testing/fake-tracker-clock';

import {
	STATE_WATCH_MAX_FOR_SECONDS,
	StateFireData,
	StateTracker,
	StateWatchSpec,
	StateWatchSpecError,
	TrackedValue,
	holdsTargetState,
	transitionFires,
	validateStateWatchSpec,
} from './state-tracker';

describe('StateTracker', () => {
	let clock: FakeTrackerClock;
	let tracker: StateTracker;
	let fired: StateFireData[];
	let tracked: string[];
	let untracked: string[];
	let errors: unknown[];

	const fire = (data: StateFireData): void => {
		fired.push(data);
	};
	const report = (propertyId: string, value: TrackedValue | null, valid = true): void =>
		tracker.report(propertyId, { value, valid });

	beforeEach(() => {
		clock = new FakeTrackerClock();
		fired = [];
		tracked = [];
		untracked = [];
		errors = [];
		tracker = new StateTracker(clock, {
			onTrack: (propertyId) => tracked.push(propertyId),
			onUntrack: (propertyId) => untracked.push(propertyId),
			onError: (error) => errors.push(error),
		});
	});

	describe('references', () => {
		it('keeps last-seen values only for referenced properties and drops them on release', () => {
			const release = tracker.reference('lux');

			report('lux', 10);
			report('other', 99);

			expect(tracker.trackedCount()).toBe(1);
			expect(tracker.read('lux')).toEqual({ status: 'ok', value: 10 });
			expect(tracker.read('other')).toEqual({ status: 'unknown' });

			release();
			release(); // releasing twice is harmless

			expect(tracker.trackedCount()).toBe(0);
			expect(tracker.read('lux')).toEqual({ status: 'unknown' });
		});

		it('keeps the value while any reference or watch remains', () => {
			const release = tracker.reference('lux');
			const unwatch = tracker.watch({ propertyId: 'lux', above: 5 }, fire);

			report('lux', 1);
			release();

			expect(tracker.read('lux')).toEqual({ status: 'ok', value: 1 });

			unwatch();

			expect(tracker.isTracked('lux')).toBe(false);
		});

		it('announces the first reference and the last release of a property, once each', () => {
			const a = tracker.reference('lux');
			const b = tracker.watch({ propertyId: 'lux', above: 5 }, fire);

			expect(tracked).toEqual(['lux']);

			a();
			expect(untracked).toEqual([]);

			b();
			expect(untracked).toEqual(['lux']);

			tracker.reference('lux');
			expect(tracked).toEqual(['lux', 'lux']);
		});

		it('reads unknown before anything was seen, and tells invalid from offline', () => {
			tracker.reference('occ');
			expect(tracker.read('occ')).toEqual({ status: 'unknown' });

			report('occ', true);
			tracker.setAvailability('occ', { valid: false });
			expect(tracker.read('occ')).toEqual({ status: 'invalid', value: true });

			report('occ', true);
			tracker.setAvailability('occ', { online: false });
			expect(tracker.read('occ')).toEqual({ status: 'offline', value: true });

			report('occ', null);
			tracker.setAvailability('occ', { online: true });
			expect(tracker.read('occ')).toEqual({ status: 'invalid', value: null });
		});
	});

	describe('transitions', () => {
		it('fires once per transition: repeated reports of the same value do not fire', () => {
			tracker.watch({ propertyId: 'occ', to: true }, fire);

			report('occ', false);
			report('occ', true);
			report('occ', true);
			report('occ', true);

			expect(fired).toEqual([{ propertyId: 'occ', from: false, to: true }]);

			report('occ', false);
			report('occ', true);

			expect(fired).toHaveLength(2);
		});

		it('does not treat the first report of a never-seen property as a transition', () => {
			tracker.watch({ propertyId: 'occ', to: true }, fire);
			tracker.watch({ propertyId: 'occ' }, fire);
			tracker.watch({ propertyId: 'temp', above: 25 }, fire);

			report('occ', true);
			report('temp', 30);

			expect(fired).toEqual([]);
		});

		it('supports from, to and any-change filters', () => {
			const any: StateFireData[] = [];
			const fromOff: StateFireData[] = [];

			tracker.watch({ propertyId: 'mode' }, (data) => any.push(data));
			tracker.watch({ propertyId: 'mode', from: 'off' }, (data) => fromOff.push(data));
			tracker.watch({ propertyId: 'mode', from: 'off', to: 'heat' }, fire);

			report('mode', 'off');
			report('mode', 'cool');
			report('mode', 'off');
			report('mode', 'heat');

			expect(any).toHaveLength(3);
			expect(fromOff).toHaveLength(2);
			expect(fired).toEqual([{ propertyId: 'mode', from: 'off', to: 'heat' }]);
		});

		it('compares strictly: a text never equals a number or a yes/no value', () => {
			tracker.watch({ propertyId: 'p', to: 1 }, fire);

			report('p', 0);
			report('p', '1');
			report('p', true);

			expect(fired).toEqual([]);

			report('p', 1);

			expect(fired).toHaveLength(1);
		});

		it('compares edges against the last valid value: true → offline → true does not fire', () => {
			tracker.watch({ propertyId: 'occ', to: true }, fire);
			tracker.watch({ propertyId: 'occ' }, fire);

			report('occ', true);
			tracker.setAvailability('occ', { online: false });
			tracker.setAvailability('occ', { online: true });
			report('occ', true);

			expect(fired).toEqual([]);
		});

		it('neither fires on an invalid report nor forgets the last valid value because of it', () => {
			tracker.watch({ propertyId: 'occ', to: false }, fire);

			report('occ', true);
			report('occ', false, false); // invalid

			expect(fired).toEqual([]);
			expect(tracker.read('occ').status).toBe('invalid');

			report('occ', null); // no value at all

			expect(fired).toEqual([]);

			report('occ', true); // back, same as the last valid value

			expect(fired).toEqual([]);

			tracker.setAvailability('occ', { online: false });
			expect(tracker.read('occ').status).toBe('offline');

			tracker.report('occ', { value: false, online: true }); // differs from the last valid value (true)

			expect(fired).toEqual([{ propertyId: 'occ', from: true, to: false }]);
		});

		it('does not fire for a report made while the device is offline', () => {
			tracker.watch({ propertyId: 'occ', to: true }, fire);

			report('occ', false);
			tracker.setAvailability('occ', { online: false });
			report('occ', true);

			expect(fired).toEqual([]);
			expect(tracker.read('occ')).toEqual({ status: 'offline', value: true });
		});

		it('ignores reports and availability changes of properties nobody references', () => {
			report('ghost', 1);
			tracker.setAvailability('ghost', { online: false });

			expect(tracker.seed('ghost', { value: 1 })).toBe(false);
			expect(tracker.trackedCount()).toBe(0);
		});

		it('never fires from inside watch(), whatever is already known', () => {
			tracker.reference('occ');
			report('occ', false);
			report('occ', true);

			tracker.watch({ propertyId: 'occ', to: true }, fire);
			tracker.watch({ propertyId: 'occ', to: true, mode: 'level' }, fire);

			expect(fired).toEqual([]);
		});

		it('lets a fire callback add and remove watches', () => {
			const late: StateFireData[] = [];
			let unwatchSecond: () => void = () => undefined;

			tracker.watch({ propertyId: 'occ' }, () => {
				unwatchSecond();
				tracker.watch({ propertyId: 'occ' }, (data) => late.push(data));
			});
			unwatchSecond = tracker.watch({ propertyId: 'occ' }, fire);

			report('occ', false);
			report('occ', true);

			expect(fired).toEqual([]); // removed by the first callback before its turn
			expect(late).toEqual([]); // added during the dispatch: sees only later changes

			report('occ', false);

			expect(late).toHaveLength(1);
		});

		it('carries on with the other watches when a fire callback throws', () => {
			tracker.watch({ propertyId: 'occ' }, () => {
				throw new Error('boom');
			});
			tracker.watch({ propertyId: 'occ' }, fire);

			report('occ', false);
			report('occ', true);

			expect(fired).toHaveLength(1);
			expect(errors).toHaveLength(1);
		});
	});

	describe('numeric thresholds', () => {
		it('fires on crossing only, not while the value stays beyond the threshold', () => {
			tracker.watch({ propertyId: 'temp', above: 25 }, fire);

			report('temp', 24);
			report('temp', 25); // not above

			expect(fired).toEqual([]);

			report('temp', 26);
			report('temp', 27);
			report('temp', 26);

			expect(fired).toEqual([{ propertyId: 'temp', from: 25, to: 26 }]);

			report('temp', 24.9);
			report('temp', 25.1);

			expect(fired).toHaveLength(2);
		});

		it('fires when the value falls below a threshold', () => {
			tracker.watch({ propertyId: 'lux', below: 10 }, fire);

			report('lux', 50);
			report('lux', 10); // not below
			report('lux', 9);
			report('lux', 3);

			expect(fired).toEqual([{ propertyId: 'lux', from: 10, to: 9 }]);
		});

		it('does not fire when the value comes back beyond the threshold after an outage', () => {
			tracker.watch({ propertyId: 'temp', above: 25 }, fire);

			report('temp', 24);
			report('temp', 26);
			tracker.setAvailability('temp', { online: false });
			tracker.setAvailability('temp', { online: true });
			report('temp', 27);

			expect(fired).toHaveLength(1);
		});

		it('fires when the value crossed the threshold during an outage', () => {
			tracker.watch({ propertyId: 'temp', above: 25 }, fire);

			report('temp', 24);
			tracker.setAvailability('temp', { online: false });
			tracker.report('temp', { value: 26, online: true });

			expect(fired).toEqual([{ propertyId: 'temp', from: 24, to: 26 }]);
		});

		it('never holds for a value that is not a number', () => {
			tracker.watch({ propertyId: 'temp', above: 25 }, fire);

			report('temp', 24);
			report('temp', '30');
			report('temp', true);

			expect(fired).toEqual([]);
		});

		it('without hysteresis fires on every crossing of a value jittering around the threshold', () => {
			tracker.watch({ propertyId: 'temp', above: 25 }, fire);

			report('temp', 24.9);

			for (let i = 0; i < 10; i++) {
				report('temp', 25.1);
				report('temp', 24.9);
			}

			expect(fired).toHaveLength(10);
		});

		it('with hysteresis fires again only after the value came back past the threshold by the hysteresis', () => {
			tracker.watch({ propertyId: 'temp', above: 25, hysteresis: 1 }, fire);

			report('temp', 24.9);

			for (let i = 0; i < 10; i++) {
				report('temp', 25.1);
				report('temp', 24.9);
			}

			expect(fired).toHaveLength(1);

			report('temp', 24.1); // still inside the band
			report('temp', 25.5);

			expect(fired).toHaveLength(1);

			report('temp', 24); // band left: 25 - 1
			report('temp', 25.5);

			expect(fired).toHaveLength(2);
		});

		it('applies the hysteresis upwards for a below threshold', () => {
			tracker.watch({ propertyId: 'lux', below: 10, hysteresis: 2 }, fire);

			report('lux', 20);
			report('lux', 9);
			report('lux', 11); // inside the band
			report('lux', 9);

			expect(fired).toHaveLength(1);

			report('lux', 12); // band left: 10 + 2
			report('lux', 9);

			expect(fired).toHaveLength(2);
		});

		it('does not take a first value inside the hysteresis band as being beyond the threshold', () => {
			tracker.watch({ propertyId: 'temp', above: 25, hysteresis: 1 }, fire);

			report('temp', 24.5);
			report('temp', 25.5);

			expect(fired).toHaveLength(1);
		});

		it('takes the state of a watch added during an outage from the last valid value', () => {
			tracker.reference('temp');
			report('temp', 30);
			tracker.setAvailability('temp', { online: false });

			tracker.watch({ propertyId: 'temp', above: 25 }, fire);
			tracker.report('temp', { value: 31, online: true });

			expect(fired).toEqual([]);
		});
	});

	describe('baseline', () => {
		it('does not fire when seeded, and uses the seeded value as the baseline of the next transition', () => {
			tracker.watch({ propertyId: 'occ', to: true }, fire);
			tracker.watch({ propertyId: 'temp', above: 25 }, fire);

			expect(tracker.seed('occ', { value: true })).toBe(true);
			expect(tracker.seed('temp', { value: 30 })).toBe(true);
			expect(tracker.seed('unreferenced', { value: 1 })).toBe(false);

			expect(fired).toEqual([]);
			expect(tracker.trackedCount()).toBe(2);

			report('occ', true);
			report('temp', 31);

			expect(fired).toEqual([]);

			report('occ', false);
			report('occ', true);

			expect(fired).toEqual([{ propertyId: 'occ', from: false, to: true }]);
		});

		it('fires on the first report after a baseline that differs from it', () => {
			tracker.watch({ propertyId: 'occ', to: true }, fire);
			tracker.seed('occ', { value: false });

			report('occ', true);

			expect(fired).toEqual([{ propertyId: 'occ', from: false, to: true }]);
		});

		it('does not let a late baseline replace a value that was already reported', () => {
			tracker.watch({ propertyId: 'occ', to: true }, fire);

			report('occ', true); // arrived while the baseline was being read

			expect(tracker.seed('occ', { value: false })).toBe(false);
			expect(tracker.read('occ')).toEqual({ status: 'ok', value: true });

			report('occ', true);

			expect(fired).toEqual([]);
		});

		it('takes the reachability from a late baseline unless a connection change was seen', () => {
			tracker.watch({ propertyId: 'a', to: false, forSeconds: 60 }, fire);
			tracker.watch({ propertyId: 'b', to: false, forSeconds: 60 }, fire);

			report('a', false);
			report('b', false);
			tracker.setAvailability('b', { online: true });

			tracker.seed('a', { value: false, online: false });
			tracker.seed('b', { value: false, online: false });

			expect(tracker.read('a').status).toBe('offline');
			expect(tracker.read('b').status).toBe('ok');
			expect(tracker.pendingTimers()).toBe(1);
		});

		it('keeps an invalid or offline baseline from becoming the last valid value', () => {
			tracker.watch({ propertyId: 'a', to: true }, fire);
			tracker.watch({ propertyId: 'b', to: true }, fire);
			tracker.seed('a', { value: false, valid: false });
			tracker.seed('b', { value: false, online: false });

			expect(tracker.read('a')).toEqual({ status: 'invalid', value: false });
			expect(tracker.read('b')).toEqual({ status: 'offline', value: false });

			report('a', true);
			tracker.report('b', { value: true, online: true });

			expect(fired).toEqual([]); // first valid value of each: a baseline, not a transition
		});

		it('seeds a baseline once: a second seed is ignored', () => {
			tracker.reference('lux');

			expect(tracker.seed('lux', { value: 1 })).toBe(true);
			expect(tracker.seed('lux', { value: 2 })).toBe(false);
			expect(tracker.read('lux')).toEqual({ status: 'ok', value: 1 });
		});
	});

	describe('"for" durations', () => {
		beforeEach(() => {
			tracker.watch({ propertyId: 'occ', to: false, forSeconds: 120 }, fire);
			report('occ', true);
		});

		it('fires once after the value held for the duration; repeats neither restart nor fire again', () => {
			report('occ', false);
			clock.advanceSeconds(60);
			report('occ', false); // a repeat must not restart the duration
			clock.advanceSeconds(59);

			expect(fired).toEqual([]);

			clock.advanceSeconds(1);

			expect(fired).toEqual([{ propertyId: 'occ', to: false, heldForMs: 120_000 }]);

			report('occ', false);
			clock.advanceSeconds(600);

			expect(fired).toHaveLength(1);
		});

		it('is cancelled when the value leaves the target state, and starts afresh on the next transition', () => {
			report('occ', false);
			clock.advanceSeconds(60);
			report('occ', true);
			clock.advanceSeconds(600);

			expect(fired).toEqual([]);
			expect(tracker.pendingTimers()).toBe(0);

			report('occ', false);
			clock.advanceSeconds(119);

			expect(fired).toEqual([]);

			clock.advanceSeconds(1);

			expect(fired).toHaveLength(1);
		});

		it('fires again for a new stay in the target state after it fired', () => {
			report('occ', false);
			clock.advanceSeconds(120);
			report('occ', true);
			report('occ', false);
			clock.advanceSeconds(120);

			expect(fired).toHaveLength(2);
		});

		it('is cancelled when the value becomes invalid', () => {
			report('occ', false);
			clock.advanceSeconds(60);
			tracker.setAvailability('occ', { valid: false });
			clock.advanceSeconds(600);

			expect(fired).toEqual([]);
			expect(tracker.pendingTimers()).toBe(0);
			expect(clock.pending()).toBe(0);
		});

		it('is cancelled by an invalid report, and restarts in full on the next valid one', () => {
			report('occ', false);
			clock.advanceSeconds(60);
			report('occ', false, false);

			expect(tracker.pendingTimers()).toBe(0);

			report('occ', false);
			clock.advanceSeconds(119);

			expect(fired).toEqual([]);

			clock.advanceSeconds(1);

			expect(fired).toHaveLength(1);
		});

		it('is cancelled when the device goes offline; coming back online alone does not restart it', () => {
			report('occ', false);
			clock.advanceSeconds(60);
			tracker.setAvailability('occ', { online: false });
			clock.advanceSeconds(600);

			expect(fired).toEqual([]);

			tracker.setAvailability('occ', { online: true });
			clock.advanceSeconds(600);

			expect(fired).toEqual([]); // no fresh report yet

			report('occ', false); // fresh valid report in the target state: the full duration from now
			clock.advanceSeconds(119);

			expect(fired).toEqual([]);

			clock.advanceSeconds(1);

			expect(fired).toEqual([{ propertyId: 'occ', to: false, heldForMs: 120_000 }]);
		});

		it('does not fire again after it fired when an offline blip is followed by the same value', () => {
			report('occ', false);
			clock.advanceSeconds(120);

			expect(fired).toHaveLength(1);

			tracker.setAvailability('occ', { online: false });
			tracker.report('occ', { value: false, online: true });
			clock.advanceSeconds(600);

			tracker.setAvailability('occ', { valid: false });
			report('occ', false);
			clock.advanceSeconds(600);

			expect(fired).toHaveLength(1);
			expect(tracker.pendingTimers()).toBe(0);
		});

		it('is cancelled by unsubscribing', () => {
			const other: StateFireData[] = [];
			const unwatch = tracker.watch({ propertyId: 'door', to: 'open', forSeconds: 30 }, (data) => other.push(data));

			report('door', 'closed');
			report('door', 'open');

			expect(tracker.pendingTimers()).toBe(1);

			unwatch();

			expect(tracker.pendingTimers()).toBe(0);

			clock.advanceSeconds(60);

			expect(other).toEqual([]);
		});

		it('belongs to the watch: each watch of a property runs its own duration', () => {
			const short: StateFireData[] = [];

			tracker.watch({ propertyId: 'occ', to: false, forSeconds: 30 }, (data) => short.push(data));

			report('occ', false);
			clock.advanceSeconds(30);

			expect(short).toHaveLength(1);
			expect(fired).toEqual([]);

			clock.advanceSeconds(90);

			expect(fired).toHaveLength(1);
		});

		it('measures the duration on the injected clock', () => {
			report('occ', false);
			clock.advance(119_999);

			expect(fired).toEqual([]);

			clock.advance(1);

			expect(fired[0].heldForMs).toBe(120_000);
		});
	});

	describe('"for" durations on thresholds', () => {
		it('fires after the value stayed beyond the threshold, and is cancelled when it comes back', () => {
			tracker.watch({ propertyId: 'temp', above: 25, forSeconds: 60 }, fire);

			report('temp', 20);
			report('temp', 26);
			clock.advanceSeconds(30);
			report('temp', 24);
			clock.advanceSeconds(60);

			expect(fired).toEqual([]);

			report('temp', 27);
			clock.advanceSeconds(30);
			report('temp', 28); // still beyond: the duration keeps running
			clock.advanceSeconds(30);

			expect(fired).toEqual([{ propertyId: 'temp', to: 28, heldForMs: 60_000 }]);
		});

		it('keeps running while the value stays inside the hysteresis band', () => {
			tracker.watch({ propertyId: 'temp', above: 25, hysteresis: 1, forSeconds: 60 }, fire);

			report('temp', 20);
			report('temp', 26);
			clock.advanceSeconds(30);
			report('temp', 24.5); // inside the band: still counts as above
			clock.advanceSeconds(30);

			expect(fired).toHaveLength(1);
		});
	});

	describe('"for" durations when the state already holds', () => {
		it('starts from the moment of seeding and marks the fire as re-armed', () => {
			tracker.watch({ propertyId: 'occ', to: false, forSeconds: 120 }, fire);
			tracker.watch({ propertyId: 'occ2', to: false, forSeconds: 120 }, fire);

			clock.advanceSeconds(10);
			tracker.seed('occ', { value: false });
			tracker.seed('occ2', { value: false, online: false });

			expect(fired).toEqual([]);
			expect(tracker.pendingTimers()).toBe(1); // occ2 is offline: no duration on a stale value

			clock.advanceSeconds(119);

			expect(fired).toEqual([]);

			clock.advanceSeconds(1);

			expect(fired).toEqual([{ propertyId: 'occ', to: false, heldForMs: 120_000, rearmed: true }]);
		});

		it('starts from the moment of subscribing when the value is already known', () => {
			tracker.reference('occ');
			report('occ', false);
			clock.advanceSeconds(500);

			tracker.watch({ propertyId: 'occ', to: false, forSeconds: 120 }, fire);

			expect(tracker.pendingTimers()).toBe(1);

			clock.advanceSeconds(120);

			expect(fired).toEqual([{ propertyId: 'occ', to: false, heldForMs: 120_000, rearmed: true }]);
		});

		it('starts on the first report of a never-seen property that is in the target state', () => {
			tracker.watch({ propertyId: 'occ', to: false, forSeconds: 120 }, fire);

			report('occ', false);
			clock.advanceSeconds(120);

			expect(fired).toEqual([{ propertyId: 'occ', to: false, heldForMs: 120_000, rearmed: true }]);
		});

		it('does not mark a fire that follows an observed transition', () => {
			tracker.watch({ propertyId: 'occ', to: false, forSeconds: 120 }, fire);
			tracker.seed('occ', { value: true });

			report('occ', false);
			clock.advanceSeconds(120);

			expect(fired).toEqual([{ propertyId: 'occ', to: false, heldForMs: 120_000 }]);
		});

		it('does not start on a baseline outside the target state', () => {
			tracker.watch({ propertyId: 'occ', to: false, forSeconds: 120 }, fire);
			tracker.seed('occ', { value: true });

			expect(tracker.pendingTimers()).toBe(0);
		});
	});

	describe('level mode', () => {
		it('fires on unknown → target with a fresh report, and not on repeats', () => {
			tracker.watch({ propertyId: 'door', to: 'closed', mode: 'level' }, fire);

			report('door', 'closed');

			expect(fired).toEqual([{ propertyId: 'door', to: 'closed' }]);

			report('door', 'closed');

			expect(fired).toHaveLength(1);

			report('door', 'open');
			report('door', 'closed');

			expect(fired[1]).toEqual({ propertyId: 'door', from: 'open', to: 'closed' });
		});

		it('fires again when the target state is confirmed by a fresh report after an outage', () => {
			tracker.watch({ propertyId: 'door', to: 'closed', mode: 'level' }, fire);

			report('door', 'closed');
			tracker.setAvailability('door', { online: false });
			tracker.report('door', { value: 'closed', online: true });

			expect(fired).toHaveLength(2);
		});
	});

	describe('dispose', () => {
		it('cancels every running duration and drops every value', () => {
			tracker.watch({ propertyId: 'occ', to: false, forSeconds: 120 }, fire);
			tracker.seed('occ', { value: false });

			tracker.dispose();

			expect(clock.pending()).toBe(0);
			expect(tracker.trackedCount()).toBe(0);

			clock.advanceSeconds(600);

			expect(fired).toEqual([]);
		});
	});

	describe('spec validation', () => {
		const reasonsFor = (spec: Partial<StateWatchSpec>): string[] =>
			validateStateWatchSpec({ propertyId: 'p', ...spec }).map((problem) => problem.field);

		it('accepts every supported shape', () => {
			expect(reasonsFor({})).toEqual([]);
			expect(reasonsFor({ to: true })).toEqual([]);
			expect(reasonsFor({ from: 'a' })).toEqual([]);
			expect(reasonsFor({ from: 'a', to: 'b' })).toEqual([]);
			expect(reasonsFor({ above: 1, hysteresis: 0.5 })).toEqual([]);
			expect(reasonsFor({ below: 1 })).toEqual([]);
			expect(reasonsFor({ to: false, forSeconds: 120 })).toEqual([]);
			expect(reasonsFor({ above: 1, forSeconds: STATE_WATCH_MAX_FOR_SECONDS })).toEqual([]);
			expect(reasonsFor({ below: 1, mode: 'level' })).toEqual([]);
		});

		it('requires a target state for a duration: "from" and any-change are refused', () => {
			expect(reasonsFor({ forSeconds: 60 })).toEqual(['forSeconds']);
			expect(reasonsFor({ from: 'a', forSeconds: 60 })).toEqual(['forSeconds']);
			expect(reasonsFor({ from: 'a', to: 'b', forSeconds: 60 })).toEqual(['forSeconds']);
		});

		it('refuses a duration that is not positive, not finite or too long', () => {
			expect(reasonsFor({ to: true, forSeconds: 0 })).toEqual(['forSeconds']);
			expect(reasonsFor({ to: true, forSeconds: -1 })).toEqual(['forSeconds']);
			expect(reasonsFor({ to: true, forSeconds: Number.NaN })).toEqual(['forSeconds']);
			expect(reasonsFor({ to: true, forSeconds: STATE_WATCH_MAX_FOR_SECONDS + 1 })).toEqual(['forSeconds']);
		});

		it('refuses a hysteresis without a threshold, and a negative one', () => {
			expect(reasonsFor({ to: true, hysteresis: 1 })).toEqual(['hysteresis']);
			expect(reasonsFor({ above: 1, hysteresis: -1 })).toEqual(['hysteresis']);
		});

		it('refuses mixed or malformed targets', () => {
			expect(reasonsFor({ above: 1, below: 2 })).toEqual(['below']);
			expect(reasonsFor({ above: 1, to: 2 })).toEqual(['to']);
			expect(reasonsFor({ below: 1, from: 2 })).toEqual(['from']);
			expect(reasonsFor({ above: Number.POSITIVE_INFINITY })).toEqual(['above']);
			expect(reasonsFor({ to: {} as unknown as TrackedValue })).toEqual(['to']);
			expect(reasonsFor({ mode: 'sometimes' as unknown as 'edge' })).toEqual(['mode']);
			expect(reasonsFor({ mode: 'level' })).toEqual(['mode']);
			expect(validateStateWatchSpec({ propertyId: '' }).map((problem) => problem.field)).toEqual(['propertyId']);
		});

		it('makes watch() throw for a refused spec without tracking the property', () => {
			expect(() => tracker.watch({ propertyId: 'occ', from: true, forSeconds: 60 }, fire)).toThrow(StateWatchSpecError);
			expect(tracker.trackedCount()).toBe(0);
			expect(tracked).toEqual([]);
		});
	});

	describe('predicates', () => {
		it('holdsTargetState keeps the previous state only inside the hysteresis band', () => {
			const spec: StateWatchSpec = { propertyId: 'p', above: 25, hysteresis: 1 };

			expect(holdsTargetState(spec, 26)).toBe(true);
			expect(holdsTargetState(spec, 24.5, false)).toBe(false);
			expect(holdsTargetState(spec, 24.5, true)).toBe(true);
			expect(holdsTargetState(spec, 24, true)).toBe(false);
			expect(holdsTargetState({ propertyId: 'p' }, 1)).toBe(false);
		});

		it('transitionFires needs a real change that matches the filters', () => {
			expect(transitionFires({ propertyId: 'p' }, 1, 1)).toBe(false);
			expect(transitionFires({ propertyId: 'p' }, 1, 2)).toBe(true);
			expect(transitionFires({ propertyId: 'p', from: 1 }, 2, 3)).toBe(false);
			expect(transitionFires({ propertyId: 'p', to: 3 }, 2, 3)).toBe(true);
		});
	});
});

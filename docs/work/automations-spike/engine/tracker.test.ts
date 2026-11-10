import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

import { startFakeTime, stopFakeTime } from './helpers.ts';
import { CH_PROPERTY_UPDATED, CH_STATE_CHANGED, CH_VALUE_SET, FakeBus, StateTracker } from './tracker.ts';
import type { FireData } from './tracker.ts';

const tick = (s: number): void => mock.timers.tick(s * 1000);

describe('state tracker', () => {
	let bus: FakeBus;
	let tracker: StateTracker;
	let fired: FireData[];
	const fire = (d: FireData): void => void fired.push(d);
	const report = (propertyId: string, value: unknown, valid = true, online = true): void =>
		bus.emit(CH_VALUE_SET, { propertyId, value, valid, online });

	beforeEach(() => {
		startFakeTime();
		bus = new FakeBus();
		tracker = new StateTracker(bus);
		fired = [];
	});
	afterEach(() => stopFakeTime());

	it('holds exactly one listener per channel regardless of the number of watches', () => {
		for (let i = 0; i < 40; i++) tracker.watch({ propertyId: `p${i}`, to: true }, fire);
		assert.equal(bus.listenerCount(CH_VALUE_SET), 1);
		assert.equal(bus.listenerCount(CH_PROPERTY_UPDATED), 1);
		assert.equal(bus.listenerCount(CH_STATE_CHANGED), 1);
	});

	it('keeps last-seen values only for referenced properties and drops them on release', () => {
		const release = tracker.reference('lux');
		report('lux', 10);
		report('other', 99);
		assert.equal(tracker.trackedCount(), 1);
		assert.deepEqual(tracker.read('lux'), { status: 'ok', value: 10 });
		assert.deepEqual(tracker.read('other'), { status: 'unknown' });
		release();
		assert.equal(tracker.trackedCount(), 0);
	});

	it('fires on transition only: repeated reports of the same value do not fire', () => {
		tracker.watch({ propertyId: 'occ', to: true }, fire);
		report('occ', false);
		report('occ', true);
		report('occ', true);
		report('occ', true);
		assert.equal(fired.length, 1);
		assert.deepEqual(fired[0], { propertyId: 'occ', from: false, to: true });
		report('occ', false);
		report('occ', true);
		assert.equal(fired.length, 2);
	});

	it('RULE: the first report of a never-seen property is not a transition', () => {
		tracker.watch({ propertyId: 'occ', to: true }, fire);
		report('occ', true);
		assert.equal(fired.length, 0);
	});

	it('supports from / to / any filters', () => {
		const any: FireData[] = [];
		const fromOff: FireData[] = [];
		tracker.watch({ propertyId: 'mode' }, (d) => void any.push(d));
		tracker.watch({ propertyId: 'mode', from: 'off' }, (d) => void fromOff.push(d));
		tracker.watch({ propertyId: 'mode', from: 'off', to: 'heat' }, fire);
		report('mode', 'off');
		report('mode', 'cool');
		report('mode', 'off');
		report('mode', 'heat');
		assert.equal(any.length, 3);
		assert.equal(fromOff.length, 2);
		assert.equal(fired.length, 1);
	});

	it('numeric thresholds fire on crossing only', () => {
		tracker.watch({ propertyId: 'temp', above: 25 }, fire);
		report('temp', 24);
		report('temp', 25); // not above
		assert.equal(fired.length, 0);
		report('temp', 26);
		report('temp', 27);
		report('temp', 26);
		assert.equal(fired.length, 1);
		report('temp', 24.9);
		report('temp', 25.1);
		assert.equal(fired.length, 2);
	});

	it('FINDING: without hysteresis a value jittering around the threshold fires on every crossing', () => {
		tracker.watch({ propertyId: 'temp', above: 25 }, fire);
		report('temp', 24.9);
		for (let i = 0; i < 10; i++) {
			report('temp', 25.1);
			report('temp', 24.9);
		}
		assert.equal(fired.length, 10);
	});

	it('an invalid or offline report neither fires nor erases the last good value', () => {
		tracker.watch({ propertyId: 'occ', to: false }, fire);
		report('occ', true);
		report('occ', false, false); // invalid
		assert.equal(fired.length, 0);
		assert.equal(tracker.read('occ').status, 'invalid');
		report('occ', true); // back, same as last good → no transition
		assert.equal(fired.length, 0);
		bus.emit(CH_STATE_CHANGED, { propertyId: 'occ', online: false });
		assert.equal(tracker.read('occ').status, 'offline');
		report('occ', false); // valid + online again, differs from last good (true)
		assert.equal(fired.length, 1);
	});

	it('startup seeding does not fire, and the seeded value is the baseline for the next transition', () => {
		tracker.watch({ propertyId: 'occ', to: true }, fire);
		tracker.watch({ propertyId: 'temp', above: 25 }, fire);
		tracker.seed({ occ: { value: true }, temp: { value: 30 }, unreferenced: { value: 1 } });
		assert.equal(fired.length, 0);
		assert.equal(tracker.trackedCount(), 2);
		report('occ', true);
		report('temp', 31);
		assert.equal(fired.length, 0);
		report('occ', false);
		report('occ', true);
		assert.equal(fired.length, 1);
	});

	it('picks up a combined metadata+value change delivered on the property-updated channel', () => {
		tracker.watch({ propertyId: 'occ', to: true }, fire);
		report('occ', false);
		bus.emit(CH_PROPERTY_UPDATED, { propertyId: 'occ', value: true, valid: true, online: true });
		assert.equal(fired.length, 1);
		assert.deepEqual(tracker.read('occ'), { status: 'ok', value: true });
		report('occ', true); // the follow-up plain report must not fire again
		assert.equal(fired.length, 1);
		bus.emit(CH_PROPERTY_UPDATED, { propertyId: 'occ' }); // metadata only: no value, nothing happens
		assert.equal(fired.length, 1);
	});

	describe('"for" timers', () => {
		beforeEach(() => {
			tracker.watch({ propertyId: 'occ', to: false, forSeconds: 120 }, fire);
			report('occ', true);
		});

		it('fires once after the value held for the duration; repeats neither restart nor re-fire', () => {
			report('occ', false);
			tick(60);
			report('occ', false); // repeat must not restart the timer
			tick(59);
			assert.equal(fired.length, 0);
			tick(1);
			assert.equal(fired.length, 1);
			assert.equal(fired[0].heldForMs, 120_000);
			report('occ', false);
			tick(600);
			assert.equal(fired.length, 1);
		});

		it('is cancelled when the value leaves the target state, and starts fresh on the next transition', () => {
			report('occ', false);
			tick(60);
			report('occ', true);
			tick(600);
			assert.equal(fired.length, 0);
			report('occ', false);
			tick(119);
			assert.equal(fired.length, 0);
			tick(1);
			assert.equal(fired.length, 1);
		});

		it('is cancelled when the value becomes invalid', () => {
			report('occ', false);
			tick(60);
			bus.emit(CH_STATE_CHANGED, { propertyId: 'occ', valid: false });
			tick(600);
			assert.equal(fired.length, 0);
			assert.equal(tracker.pendingTimers(), 0);
		});

		it('is cancelled when the device goes offline; coming back online alone does not restart it', () => {
			report('occ', false);
			tick(60);
			bus.emit(CH_STATE_CHANGED, { propertyId: 'occ', online: false });
			tick(600);
			assert.equal(fired.length, 0);
			bus.emit(CH_STATE_CHANGED, { propertyId: 'occ', online: true });
			tick(600);
			assert.equal(fired.length, 0, 'no fresh report yet');
			report('occ', false); // fresh valid report in the target state → full duration from now
			tick(119);
			assert.equal(fired.length, 0);
			tick(1);
			assert.equal(fired.length, 1);
		});

		it('RULE: after it fired, an offline blip followed by the same value does not fire it again', () => {
			report('occ', false);
			tick(120);
			assert.equal(fired.length, 1);
			bus.emit(CH_STATE_CHANGED, { propertyId: 'occ', online: false });
			report('occ', false);
			tick(600);
			assert.equal(fired.length, 1);
		});

		it('unsubscribing cancels the pending timer', () => {
			const fired2: FireData[] = [];
			const unsub = tracker.watch({ propertyId: 'door', to: 'open', forSeconds: 30 }, (d) => void fired2.push(d));
			report('door', 'closed');
			report('door', 'open');
			assert.equal(tracker.pendingTimers(), 1);
			unsub();
			assert.equal(tracker.pendingTimers(), 0);
			tick(60);
			assert.equal(fired2.length, 0);
		});
	});

	it('seeding restarts "for" timers from boot time when the state already holds (and only when usable)', () => {
		tracker.watch({ propertyId: 'occ', to: false, forSeconds: 120 }, fire);
		tracker.watch({ propertyId: 'occ2', to: false, forSeconds: 120 }, fire);
		tracker.seed({ occ: { value: false }, occ2: { value: false, online: false } });
		assert.equal(fired.length, 0);
		assert.equal(tracker.pendingTimers(), 1); // occ2 is offline: no timer on a stale value
		tick(120);
		assert.equal(fired.length, 1);
		assert.equal(fired[0].propertyId, 'occ');
	});

	it('level mode (used by wait-until) fires on unknown → true with a fresh report', () => {
		tracker.watch({ propertyId: 'door', to: 'closed', mode: 'level' }, fire);
		report('door', 'closed');
		assert.equal(fired.length, 1);
		report('door', 'closed');
		assert.equal(fired.length, 1);
	});
});

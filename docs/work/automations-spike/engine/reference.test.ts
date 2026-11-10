// The reference scenario from the design doc, in two modellings, across modes and restart scopes.
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import type { Automation, Mode } from './engine.ts';
import { advance, flush, graph, harness, startFakeTime, stopFakeTime } from './helpers.ts';
import type { Harness } from './helpers.ts';
import { CH_STATE_CHANGED } from './tracker.ts';

const NIGHT = '2026-11-10T22:30:00Z'; // 23:30 in Europe/Prague
const DAY = '2026-11-10T12:00:00Z'; // 13:00 in Europe/Prague

const onBranch: [string, string, Record<string, unknown>?][] = [
	['tOn', 'device.property.changed', { property_id: 'occ', to: true }],
	['cDark', 'device.property.compare', { property_id: 'lux', operator: 'lt', value: 50 }],
	['cNight', 'time.window', { from: '22:00', to: '06:00' }],
	['aDim', 'device.property.set', { property_id: 'light', value: 20 }],
	['aFull', 'device.property.set', { property_id: 'light', value: 100 }],
];
const onEdges = ['tOn:out>cDark', 'cDark:yes>cNight', 'cNight:yes>aDim', 'cNight:no>aFull'];
const aOff: [string, string, Record<string, unknown>] = ['aOff', 'device.property.set', { property_id: 'light', value: 0 }];

/** Variant 1: Trigger B is "occupancy false FOR 120 s" → off. The wait lives in the state tracker. */
const variant1 = (mode: Mode = 'restart'): Automation => ({
	id: 'ref',
	enabled: true,
	mode,
	revision: 1,
	graph: graph(
		[...onBranch, ['tOff', 'device.property.changed', { property_id: 'occ', to: false, for_seconds: 120 }], aOff],
		[...onEdges, 'tOff:out>aOff'],
	),
});

/** Variant 2: Trigger B is "occupancy becomes false" → Delay 120 s → off. The wait lives in the run. */
const variant2 = (mode: Mode = 'restart'): Automation => ({
	id: 'ref',
	enabled: true,
	mode,
	revision: 1,
	graph: graph(
		[...onBranch, ['tOff', 'device.property.changed', { property_id: 'occ', to: false }], ['delay', 'flow.delay', { seconds: 120 }], aOff],
		[...onEdges, 'tOff:out>delay', 'delay:out>aOff'],
	),
});

/** Variant 2b: as variant 2, but the delay is followed by a re-check "occupancy is still false". */
const variant2b = (mode: Mode = 'restart'): Automation => ({
	id: 'ref',
	enabled: true,
	mode,
	revision: 1,
	graph: graph(
		[
			...onBranch,
			['tOff', 'device.property.changed', { property_id: 'occ', to: false }],
			['delay', 'flow.delay', { seconds: 120 }],
			['cStillEmpty', 'device.property.compare', { property_id: 'occ', operator: 'eq', value: false }],
			aOff,
		],
		[...onEdges, 'tOff:out>delay', 'delay:out>cStillEmpty', 'cStillEmpty:yes>aOff'],
	),
});

const light = (h: Harness): unknown[] => h.writes.map((w) => w.value);

afterEach(() => stopFakeTime());

describe('reference scenario, variant 1 ("for 120 s" trigger), restart mode', () => {
	const setup = (at: string, seed = { occ: { value: false }, lux: { value: 10 } }): Harness => {
		startFakeTime(at);
		const h = harness({ seed });
		const v = h.engine.load(variant1());
		assert.deepEqual(v.errors, []);
		return h;
	};

	it('dark + night → 20 %', async () => {
		const h = setup(NIGHT);
		h.report('occ', true);
		await flush();
		assert.deepEqual(light(h), [20]);
		const [run] = h.engine.runs('ref');
		assert.equal(run.status, 'completed');
		assert.equal(run.triggerNodeId, 'tOn');
		assert.deepEqual(
			run.steps.map((s) => [s.nodeId, s.output]),
			[
				['cDark', 'yes'],
				['cNight', 'yes'],
				['aDim', 'done'],
			],
		);
		assert.equal(run.steps[0].observed, 10);
		assert.equal(run.steps[1].observed, 'tue 23:30 Europe/Prague');
		assert.deepEqual(run.steps[2].result, { success: true });
	});

	it('dark + day → 100 %', async () => {
		const h = setup(DAY);
		h.report('occ', true);
		await flush();
		assert.deepEqual(light(h), [100]);
	});

	it('bright → nothing', async () => {
		const h = setup(NIGHT, { occ: { value: false }, lux: { value: 300 } });
		h.report('occ', true);
		await flush();
		assert.deepEqual(light(h), []);
		const [run] = h.engine.runs('ref');
		assert.deepEqual(run.steps.map((s) => [s.nodeId, s.output, s.observed]), [['cDark', 'no', 300]]);
		assert.equal(run.status, 'completed');
	});

	it('occupancy clears → off after exactly 120 s', async () => {
		const h = setup(NIGHT);
		h.report('occ', true);
		await advance(10_000);
		h.report('occ', false);
		await advance(119_000);
		assert.deepEqual(light(h), [20]);
		await advance(1_000);
		assert.deepEqual(light(h), [20, 0]);
		assert.equal(h.writes[1].at - h.writes[0].at, 130_000);
	});

	it('occupancy returns at 60 s → off never happens', async () => {
		const h = setup(NIGHT);
		h.report('occ', true);
		await advance(10_000);
		h.report('occ', false);
		await advance(60_000);
		h.report('occ', true);
		await advance(600_000);
		assert.deepEqual(light(h), [20, 20]); // second "on" from the returning motion; no 0
	});

	it('repeated `true` reports do not re-fire', async () => {
		const h = setup(NIGHT);
		for (let i = 0; i < 5; i++) {
			h.report('occ', true);
			await advance(30_000);
		}
		assert.deepEqual(light(h), [20]);
		assert.equal(h.engine.runs('ref').length, 1);
	});

	it('sensor goes offline during the 120 s → no off; off only 120 s after a fresh valid report', async () => {
		const h = setup(NIGHT);
		h.report('occ', true);
		await advance(1_000);
		h.report('occ', false);
		await advance(60_000);
		h.bus.emit(CH_STATE_CHANGED, { propertyId: 'occ', online: false });
		await advance(600_000);
		assert.deepEqual(light(h), [20]);
		h.bus.emit(CH_STATE_CHANGED, { propertyId: 'occ', online: true });
		await advance(600_000);
		assert.deepEqual(light(h), [20], 'online without a report restarts nothing');
		h.report('occ', false);
		await advance(119_000);
		assert.deepEqual(light(h), [20]);
		await advance(1_000);
		assert.deepEqual(light(h), [20, 0]);
	});

	for (const [name, seed, reason] of [
		['unknown', { occ: { value: false } }, 'property is unknown'],
		['invalid', { occ: { value: false }, lux: { value: 10, valid: false } }, 'property is invalid'],
		['offline', { occ: { value: false }, lux: { value: 10, online: false } }, 'property is offline'],
	] as const) {
		it(`illuminance ${name} → condition is "no" with a recorded reason, light stays off`, async () => {
			const h = setup(NIGHT, seed as never);
			h.report('occ', true);
			await flush();
			assert.deepEqual(light(h), []);
			const step = h.engine.runs('ref')[0].steps[0];
			assert.equal(step.output, 'no');
			assert.equal(step.reason, reason);
		});
	}

	it('startup: seeded occupancy=true does not fire; seeded occupancy=false starts the 120 s from boot', async () => {
		startFakeTime(NIGHT);
		const h = harness({});
		h.engine.load(variant1());
		h.tracker.seed({ occ: { value: false }, lux: { value: 10 } });
		await advance(119_000);
		assert.deepEqual(light(h), []);
		await advance(1_000);
		assert.deepEqual(light(h), [0], 'FINDING: every boot with an empty room sends one "off" 120 s after start');
	});
});

describe('variant 1 behaves the same in every mode and restart scope (the wait is not inside a run)', () => {
	for (const mode of ['single', 'restart', 'parallel'] as const) {
		for (const restartScope of ['automation', 'trigger'] as const) {
			it(`${mode} / scope=${restartScope}: motion at 60 s prevents the off; later absence turns off`, async () => {
				startFakeTime(NIGHT);
				const h = harness({ seed: { occ: { value: true }, lux: { value: 10 } }, restartScope });
				h.engine.load(variant1(mode));
				h.report('occ', false);
				await advance(60_000);
				h.report('occ', true);
				await advance(300_000);
				assert.deepEqual(light(h), [20]);
				h.report('occ', false);
				await advance(120_000);
				assert.deepEqual(light(h), [20, 0]);
			});
		}
	}
});

describe('variant 2 (becomes false → Delay 120 s → off): what must `restart` cancel?', () => {
	const scenario = async (mode: Mode, restartScope: 'automation' | 'trigger', def = variant2): Promise<Harness> => {
		startFakeTime(NIGHT);
		const h = harness({ seed: { occ: { value: true }, lux: { value: 10 } }, restartScope });
		h.engine.load(def(mode));
		h.report('occ', false); // t = 0: pending off parked on the Delay
		await advance(60_000);
		h.report('occ', true); // t = 60 s: motion returns
		await advance(300_000);
		return h;
	};

	it('restart + scope=automation: new motion cancels the pending off (WORKS)', async () => {
		const h = await scenario('restart', 'automation');
		assert.deepEqual(light(h), [20]);
		const [offRun, onRun] = h.engine.runs('ref');
		assert.equal(offRun.status, 'cancelled');
		assert.equal(offRun.endReason, 'restarted');
		assert.deepEqual(offRun.steps.map((s) => [s.nodeId, s.output]), [['delay', 'cancelled']]);
		assert.equal(onRun.status, 'completed');
	});

	it('restart + scope=same trigger: the off still fires at 120 s with the room occupied (BROKEN)', async () => {
		const h = await scenario('restart', 'trigger');
		assert.deepEqual(light(h), [20, 0]);
		assert.equal(h.writes[1].at - h.writes[0].at, 60_000);
	});

	it('single: returning motion is ignored while the off run is parked, then the off fires (BROKEN twice)', async () => {
		const h = await scenario('single', 'automation');
		assert.deepEqual(light(h), [0]);
		assert.deepEqual(h.engine.triggerLog('ref').map((l) => [l.triggerNodeId, l.outcome]), [
			['tOff', 'started'],
			['tOn', 'ignored'],
		]);
	});

	it('parallel: the off fires at 120 s with the room occupied (BROKEN)', async () => {
		const h = await scenario('parallel', 'automation');
		assert.deepEqual(light(h), [20, 0]);
	});

	it('even with restart + scope=automation, variant 2 turns the light off on a stale value when the sensor drops', async () => {
		startFakeTime(NIGHT);
		const h = harness({ seed: { occ: { value: true }, lux: { value: 10 } } });
		h.engine.load(variant2('restart'));
		h.report('occ', false);
		await advance(30_000);
		h.bus.emit(CH_STATE_CHANGED, { propertyId: 'occ', online: false });
		await advance(120_000);
		assert.deepEqual(light(h), [0], 'a Delay knows nothing about the sensor: violates "must not turn off on last known value"');
	});

	it('variant 2b (re-check after the delay) fixes the offline case: unknown is "no"', async () => {
		startFakeTime(NIGHT);
		const h = harness({ seed: { occ: { value: true }, lux: { value: 10 } } });
		h.engine.load(variant2b('restart'));
		h.report('occ', false);
		await advance(30_000);
		h.bus.emit(CH_STATE_CHANGED, { propertyId: 'occ', online: false });
		await advance(120_000);
		assert.deepEqual(light(h), []);
		const step = h.engine.runs('ref')[0].steps.find((s) => s.nodeId === 'cStillEmpty')!;
		assert.equal(step.output, 'no');
		assert.equal(step.reason, 'property is offline');
	});

	it('variant 2b survives the wrong scope/mode for a single return of motion…', async () => {
		for (const [mode, scope] of [
			['restart', 'trigger'],
			['parallel', 'automation'],
		] as const) {
			const h = await scenario(mode, scope, variant2b);
			assert.deepEqual(light(h), [20], `${mode}/${scope}`);
			stopFakeTime();
		}
	});

	it('…but in parallel mode it turns off too early when the room empties again before the first delay ends', async () => {
		startFakeTime(NIGHT);
		const h = harness({ seed: { occ: { value: true }, lux: { value: 10 } } });
		h.engine.load(variant2b('parallel'));
		h.report('occ', false); // t=0
		await advance(60_000);
		h.report('occ', true); // t=60
		await advance(40_000);
		h.report('occ', false); // t=100: the room has been empty for 20 s at t=120
		await advance(20_000);
		assert.deepEqual(light(h), [20, 0], 'off 20 s after the last motion instead of 120 s');
	});

	it('…while restart + scope=automation gives the full 120 s after the last motion', async () => {
		startFakeTime(NIGHT);
		const h = harness({ seed: { occ: { value: true }, lux: { value: 10 } } });
		h.engine.load(variant2b('restart'));
		h.report('occ', false);
		await advance(60_000);
		h.report('occ', true);
		await advance(40_000);
		h.report('occ', false); // t=100
		await advance(119_000);
		assert.deepEqual(light(h), [20]);
		await advance(1_000);
		assert.deepEqual(light(h), [20, 0]);
	});
});

describe('cost of restart scope=automation', () => {
	it('two unrelated flows on one canvas cancel each other', async () => {
		startFakeTime(DAY);
		const h = harness({});
		h.engine.load({
			id: 'mixed',
			enabled: true,
			mode: 'restart',
			revision: 1,
			graph: graph(
				[
					['tDoor', 'manual'],
					['delay', 'flow.delay', { seconds: 10 }],
					['aNotify', 'test.action', { name: 'notify door left open' }],
					['tButton', 'manual'],
					['aFan', 'test.action', { name: 'toggle fan' }],
				],
				['tDoor:out>delay', 'delay:out>aNotify', 'tButton:out>aFan'],
			),
		});
		h.engine.trigger('mixed', 'tDoor');
		await advance(5_000);
		h.engine.trigger('mixed', 'tButton');
		await advance(60_000);
		assert.deepEqual(h.log, ['toggle fan'], 'the door notification was silently cancelled by an unrelated button');
	});
});

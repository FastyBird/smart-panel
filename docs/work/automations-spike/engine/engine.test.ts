import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import type { Automation, Mode } from './engine.ts';
import { validateGraph } from './graph.ts';
import type { Graph } from './graph.ts';
import { advance, flush, graph, harness, startFakeTime, stopFakeTime } from './helpers.ts';
import { createRegistry, inTimeWindow, localTime, parseHm } from './nodes.ts';

const auto = (g: Graph, mode: Mode = 'restart', id = 'a'): Automation => ({ id, enabled: true, mode, revision: 1, graph: g });
const act = (name: string, extra: Record<string, unknown> = {}): [string, string, Record<string, unknown>] => [name, 'test.action', { name, ...extra }];
const outputs = (steps: { nodeId: string; output?: string }[]): string[] => steps.map((s) => `${s.nodeId}:${s.output}`);

beforeEach(() => startFakeTime());
afterEach(() => stopFakeTime());

describe('graph validator', () => {
	const registry = createRegistry();
	const codes = (g: Graph, opts = {}): { errors: string[]; warnings: string[] } => {
		const r = validateGraph(g, registry, opts);
		return { errors: r.errors.map((e) => e.code), warnings: r.warnings.map((w) => w.code) };
	};
	const set = (id: string): [string, string, Record<string, unknown>] => [id, 'device.property.set', { property_id: 'p', value: 1 }];

	it('accepts a minimal valid graph', () => {
		assert.deepEqual(codes(graph([['t', 'manual'], set('a')], ['t:out>a'])), { errors: [], warnings: [] });
	});

	it('requires at least one trigger', () => {
		assert.deepEqual(codes(graph([set('a')], [])).errors, ['no_trigger']);
	});

	it('rejects an edge into a trigger', () => {
		const r = codes(graph([['t', 'manual'], ['t2', 'manual'], set('a')], ['t:out>a', 'a:done>t2']));
		assert.deepEqual(r.errors, ['edge_into_trigger']);
	});

	it('rejects ports that do not exist on the node type (source and target side)', () => {
		const g = graph([['t', 'manual'], set('a'), set('b')], ['t:out>a', 'a:yes>b']);
		g.edges.push({ id: 'x', source: 't', source_port: 'out', target: 'b', target_port: 'input2' });
		assert.deepEqual(codes(g).errors, ['unknown_port', 'unknown_port']);
	});

	it('rejects cycles and names the nodes', () => {
		const g = graph([['t', 'manual'], set('a'), set('b'), set('c')], ['t:out>a', 'a:done>b', 'b:done>c', 'c:done>a']);
		const r = validateGraph(g, registry);
		assert.deepEqual(r.errors.map((e) => e.code), ['cycle']);
		assert.match(r.errors[0].message, /a, b, c/);
	});

	it('reports unreachable nodes as warnings, not errors', () => {
		const r = validateGraph(graph([['t', 'manual'], set('a'), set('orphan')], ['t:out>a']), registry);
		assert.equal(r.valid, true);
		assert.deepEqual(r.warnings.map((w) => [w.code, w.nodeId]), [['unreachable', 'orphan']]);
	});

	it('enforces the node-count limit', () => {
		const nodes: [string, string, Record<string, unknown>?][] = [['t', 'manual']];
		for (let i = 0; i < 100; i++) nodes.push(set(`a${i}`));
		assert.deepEqual(codes(graph(nodes, ['t:out>a0'])).errors, ['too_many_nodes']);
		assert.deepEqual(codes(graph(nodes.slice(0, 100), ['t:out>a0'])).errors, []);
	});

	it('rejects unknown node types, dangling and duplicate edges, bad config, delays over 24 h', () => {
		assert.deepEqual(codes(graph([['t', 'manual'], ['x', 'nope']], [])).errors, ['unknown_node_type']);
		assert.deepEqual(codes(graph([['t', 'manual']], ['t:out>ghost'])).errors, ['dangling_edge']);
		assert.deepEqual(codes(graph([['t', 'manual'], set('a')], ['t:out>a', 't:out>a'])).errors, ['duplicate_edge']);
		assert.deepEqual(codes(graph([['t', 'manual'], ['d', 'flow.delay', { seconds: 86_401 }]], ['t:out>d'])).errors, ['invalid_config']);
		assert.deepEqual(codes(graph([['t', 'manual'], ['d', 'flow.delay', { seconds: 86_400 }]], ['t:out>d'])).errors, []);
		assert.deepEqual(codes(graph([['t', 'manual'], ['c', 'time.window', { from: '08:00', to: '08:00' }]], ['t:out>c'])).errors, ['invalid_config']);
	});

	it('SPIKE RULE: an All join fed by two different triggers can never complete → error', () => {
		const g = graph([['t1', 'manual'], ['t2', 'manual'], ['all', 'flow.all'], set('a')], ['t1:out>all', 't2:out>all', 'all:out>a']);
		assert.deepEqual(codes(g).errors, ['all_never_completes']);
	});

	it('SPIKE RULE: warns when an action writes a property one of the automation\'s own triggers watches', () => {
		const g = graph([['t', 'device.property.changed', { property_id: 'p' }], set('a')], ['t:out>a']);
		assert.deepEqual(codes(g), { errors: [], warnings: ['writes_own_trigger'] });
	});

	it('an invalid automation is loaded with status "invalid" and holds no subscriptions', () => {
		const h = harness();
		const r = h.engine.load(auto(graph([act('a')], [])));
		assert.equal(r.valid, false);
		assert.equal(h.engine.status('a'), 'invalid');
		assert.equal(h.engine.subscriptionCount('a'), 0);
		assert.equal(h.engine.trigger('a'), false);
	});
});

describe('run walker', () => {
	it('several edges from one output all run; start order is the order of graph.edges', async () => {
		const h = harness();
		h.engine.load(auto(graph([['t', 'manual'], act('first'), act('second'), act('third')], ['t:out>first', 't:out>second', 't:out>third'])));
		h.engine.trigger('a');
		await flush();
		assert.deepEqual(h.log, ['first', 'second', 'third']);
		assert.equal(h.engine.runs('a')[0].status, 'completed');
	});

	it('FINDING: parallel branches interleave at await points; completion order follows action latency', async () => {
		const h = harness();
		h.engine.load(auto(graph([['t', 'manual'], act('slow', { takesMs: 3000 }), act('fast')], ['t:out>slow', 't:out>fast'])));
		h.engine.trigger('a');
		await advance(5000);
		assert.deepEqual(h.log, ['fast', 'slow']);
	});

	it('conditions route to yes/no and the trace records trigger, node, output, observed value and action result', async () => {
		const h = harness({ seed: { temp: { value: 30 } } });
		h.engine.load(
			auto(
				graph(
					[['t', 'manual'], ['c', 'device.property.compare', { property_id: 'temp', operator: 'gt', value: 25 }], act('hot'), act('cold')],
					['t:out>c', 'c:yes>hot', 'c:no>cold'],
				),
			),
		);
		h.engine.trigger('a', 't', { who: 'test' });
		await flush();
		h.report('temp', 20);
		h.engine.trigger('a');
		await flush();
		assert.deepEqual(h.log, ['hot', 'cold']);
		const [r1, r2] = h.engine.runs('a');
		assert.equal(r1.triggerNodeId, 't');
		assert.deepEqual(r1.triggerData, { who: 'test' });
		assert.deepEqual(outputs(r1.steps), ['c:yes', 'hot:done']);
		assert.equal(r1.steps[0].observed, 30);
		assert.equal(r1.steps[0].via, 'e1');
		assert.deepEqual(r1.steps[1].result, { success: true });
		assert.deepEqual(outputs(r2.steps), ['c:no', 'cold:done']);
		assert.equal(r2.steps[0].observed, 20);
	});

	it('actions route to done/error; a failing or throwing action takes the error output', async () => {
		const h = harness({ failWrites: ['lock'] });
		h.engine.load(
			auto(
				graph(
					[
						['t', 'manual'],
						act('a1', { fail: true }),
						act('a2', { throws: true }),
						['a3', 'device.property.set', { property_id: 'lock', value: 1 }],
						act('onDone'),
						act('onError'),
					],
					['t:out>a1', 't:out>a2', 't:out>a3', 'a1:done>onDone', 'a1:error>onError', 'a2:error>onError', 'a3:error>onError'],
				),
			),
		);
		h.engine.trigger('a');
		await flush();
		assert.deepEqual(h.log, ['a1', 'onError', 'onError', 'onError']);
		const run = h.engine.runs('a')[0];
		assert.equal(run.steps.find((s) => s.nodeId === 'a2')!.reason, 'a2 exploded');
		assert.equal(run.steps.find((s) => s.nodeId === 'a3')!.reason, 'device rejected the command');
		assert.equal(run.status, 'completed', 'every error was handled by an edge');
	});

	it('SPIKE RULE: an error output with no edge ends that token and marks the run "failed"; other branches continue', async () => {
		const h = harness();
		h.engine.load(auto(graph([['t', 'manual'], act('bad', { fail: true }), act('next'), act('other')], ['t:out>bad', 'bad:done>next', 't:out>other'])));
		h.engine.trigger('a');
		await flush();
		assert.deepEqual(h.log, ['bad', 'other']);
		assert.equal(h.engine.runs('a')[0].status, 'failed');
		assert.equal(h.engine.info('a').lastRunStatus, 'failed');
	});

	it('Delay parks the token; the run stays active until the timer fires', async () => {
		const h = harness();
		h.engine.load(auto(graph([['t', 'manual'], ['d', 'flow.delay', { seconds: 300 }], act('later')], ['t:out>d', 'd:out>later'])));
		h.engine.trigger('a');
		await advance(299_000);
		assert.deepEqual(h.log, []);
		assert.equal(h.engine.activeCount('a'), 1);
		assert.deepEqual(outputs(h.engine.runs('a')[0].steps), ['d:parked']);
		await advance(1_000);
		assert.deepEqual(h.log, ['later']);
		assert.equal(h.engine.activeCount('a'), 0);
		assert.deepEqual(outputs(h.engine.runs('a')[0].steps), ['d:out', 'later:done']);
	});

	it('the safety policy is consulted before every action; a refusal takes the error output and is traced', async () => {
		const asked: string[] = [];
		const h = harness({
			safetyPolicy: (req) => {
				asked.push(req.nodeId);
				return req.config.property_id === 'door.lock' && req.config.value === 'unlocked'
					? { allow: false, reason: 'unlocking a door is not allowed from an automation' }
					: { allow: true };
			},
		});
		h.engine.load(
			auto(
				graph(
					[
						['t', 'manual'],
						['unlock', 'device.property.set', { property_id: 'door.lock', value: 'unlocked' }],
						['lock', 'device.property.set', { property_id: 'door.lock', value: 'locked' }],
						act('refused'),
					],
					['t:out>unlock', 't:out>lock', 'unlock:error>refused'],
				),
			),
		);
		h.engine.trigger('a');
		await flush();
		assert.deepEqual(asked.sort(), ['lock', 'refused', 'unlock']);
		assert.deepEqual(h.writes.map((w) => w.value), ['locked']);
		assert.deepEqual(h.log, ['refused']);
		const step = h.engine.runs('a')[0].steps.find((s) => s.nodeId === 'unlock')!;
		assert.equal(step.output, 'error');
		assert.equal(step.refused, true);
		assert.equal(step.reason, 'unlocking a door is not allowed from an automation');
	});
});

describe('modes', () => {
	const delayed = (mode: Mode): Automation =>
		auto(graph([['t', 'manual'], ['d', 'flow.delay', { seconds: 10 }], act('done')], ['t:out>d', 'd:out>done']), mode);

	it('single: triggers are ignored while a run is active, accepted again afterwards', async () => {
		const h = harness();
		h.engine.load(delayed('single'));
		assert.equal(h.engine.trigger('a'), true);
		await advance(5_000);
		assert.equal(h.engine.trigger('a'), false);
		await advance(5_000);
		assert.deepEqual(h.log, ['done']);
		assert.equal(h.engine.trigger('a'), true);
		await advance(10_000);
		assert.deepEqual(h.log, ['done', 'done']);
		assert.deepEqual(h.engine.triggerLog('a').map((l) => l.outcome), ['started', 'ignored', 'started']);
	});

	it('restart: the active run and its parked delay are cancelled, a new run starts', async () => {
		const h = harness();
		h.engine.load(delayed('restart'));
		h.engine.trigger('a');
		await advance(5_000);
		h.engine.trigger('a');
		await advance(9_000);
		assert.deepEqual(h.log, [], 'the first run would have finished at t=10 s');
		await advance(1_000);
		assert.deepEqual(h.log, ['done']);
		const [r1, r2] = h.engine.runs('a');
		assert.deepEqual([r1.status, r1.endReason, r2.status], ['cancelled', 'restarted', 'completed']);
	});

	it('parallel: runs overlap up to the cap (10); the 11th trigger is dropped and logged', async () => {
		const h = harness();
		h.engine.load(delayed('parallel'));
		const started = Array.from({ length: 12 }, () => h.engine.trigger('a'));
		assert.equal(started.filter(Boolean).length, 10);
		assert.equal(h.engine.activeCount('a'), 10);
		assert.equal(h.engine.triggerLog('a').filter((l) => l.outcome === 'dropped').length, 2);
		await advance(10_000);
		assert.equal(h.log.length, 10);
		assert.equal(h.engine.trigger('a'), true);
	});

	it('SPIKE RULE: an action already in flight when its run is cancelled is not aborted; its result is traced, its output is not followed', async () => {
		const h = harness();
		h.engine.load(auto(graph([['t', 'manual'], act('slow', { takesMs: 3000 }), act('after')], ['t:out>slow', 'slow:done>after'])));
		h.engine.trigger('a');
		await advance(1_000);
		h.engine.trigger('a'); // restart while "slow" of run 1 is in flight
		await advance(10_000);
		assert.deepEqual(h.log, ['slow', 'slow', 'after'], 'both side effects happened; only run 2 continued');
		const [r1] = h.engine.runs('a');
		assert.equal(r1.status, 'cancelled');
		assert.deepEqual(r1.steps.map((s) => [s.nodeId, s.output, s.afterCancel]), [['slow', 'done', true]]);
	});
});

describe('guards', () => {
	const instant = (): Automation => auto(graph([['t', 'device.property.changed', { property_id: 'btn' }], act('x')], ['t:out>x']), 'parallel');

	it('more than 30 runs per minute → suspended, subscriptions dropped, notified exactly once', async () => {
		const h = harness({ seed: { btn: { value: 0 } } });
		h.engine.load(instant());
		assert.equal(h.engine.subscriptionCount('a'), 1);
		for (let i = 1; i <= 30; i++) {
			h.report('btn', i);
			await advance(1_000);
		}
		assert.equal(h.engine.status('a'), 'ok');
		assert.equal(h.log.length, 30);
		h.report('btn', 31); // the 31st run inside one minute
		await flush();
		assert.equal(h.engine.status('a'), 'suspended');
		assert.equal(h.engine.subscriptionCount('a'), 0);
		assert.equal(h.tracker.trackedCount(), 0);
		assert.equal(h.notifications.length, 1);
		assert.equal(h.notifications[0].automationId, 'a');
		for (let i = 32; i < 60; i++) h.report('btn', i);
		await advance(120_000);
		assert.equal(h.log.length, 30, 'the 31st run did not execute and nothing ran afterwards');
		assert.equal(h.notifications.length, 1);
		assert.equal(h.engine.trigger('a'), false, 'manual start is refused while suspended');
	});

	it('the window slides: 30 runs, a pause of a minute, 30 more runs is fine', async () => {
		const h = harness({ seed: { btn: { value: 0 } } });
		h.engine.load(instant());
		for (let i = 1; i <= 30; i++) {
			h.report('btn', i);
			await flush();
		}
		await advance(60_000);
		for (let i = 31; i <= 60; i++) {
			h.report('btn', i);
			await flush();
		}
		assert.equal(h.engine.status('a'), 'ok');
		assert.equal(h.log.length, 60);
	});

	it('suspension cancels parked runs; saving the automation again resumes it (SPIKE RULE)', async () => {
		const h = harness({ maxRunsPerMinute: 3 });
		const def = auto(graph([['t', 'manual'], ['d', 'flow.delay', { seconds: 30 }], act('x')], ['t:out>d', 'd:out>x']), 'parallel');
		h.engine.load(def);
		for (let i = 0; i < 4; i++) h.engine.trigger('a');
		assert.equal(h.engine.status('a'), 'suspended');
		await advance(60_000);
		assert.deepEqual(h.log, []);
		assert.deepEqual(h.engine.runs('a').map((r) => r.endReason), ['suspended', 'suspended', 'suspended']);
		h.engine.load({ ...def, revision: 2 });
		assert.equal(h.engine.status('a'), 'ok');
		assert.equal(h.engine.trigger('a'), true);
	});

	it('global cap on concurrent runs drops triggers across automations', async () => {
		const h = harness({ maxConcurrentRuns: 3 });
		const g = graph([['t', 'manual'], ['d', 'flow.delay', { seconds: 30 }]], ['t:out>d']);
		h.engine.load(auto(g, 'parallel', 'a'));
		h.engine.load(auto(g, 'parallel', 'b'));
		assert.deepEqual([h.engine.trigger('a'), h.engine.trigger('a'), h.engine.trigger('b'), h.engine.trigger('b')], [true, true, true, false]);
		assert.match(h.engine.triggerLog('b')[1].reason!, /global concurrent run cap/);
		await advance(30_000);
		assert.equal(h.engine.trigger('b'), true);
	});

	const toggleType = {
		type: 'test.toggle',
		kind: 'action' as const,
		ports: { inputs: ['in'], outputs: ['done', 'error'] },
		writes: () => ['sw'],
		execute: async (_c: unknown, ctx: any) => {
			await ctx.services.writeProperty('sw', !ctx.tracker.read('sw').value);
			return { success: true };
		},
	};
	const loopGraph = (): Graph => graph([['t', 'device.property.changed', { property_id: 'sw' }], ['flip', 'test.toggle']], ['t:out>flip']);

	for (const mode of ['single', 'restart', 'parallel'] as const) {
		it(`a self-triggering loop (action toggles the property its trigger watches, device echoes after 200 ms) is stopped by the rate guard — ${mode}`, async () => {
			const h = harness({ seed: { sw: { value: false } }, echoWrites: true, echoDelayMs: 200, registry: createRegistry([toggleType]) });
			const v = h.engine.load(auto(loopGraph(), mode));
			assert.deepEqual(v.warnings.map((w) => w.code), ['writes_own_trigger']);
			h.report('sw', true); // one external change starts the loop
			await advance(10_000, 100);
			assert.equal(h.engine.status('a'), 'suspended');
			assert.equal(h.notifications.length, 1);
			assert.equal(h.writes.length, 30, 'exactly the 30 allowed runs wrote before the guard stopped it');
			assert.ok(h.writes[29].at - h.writes[0].at < 6_000, 'stopped within 6 s');
			await advance(120_000);
			assert.equal(h.writes.length, 30, 'no further writes after suspension');
		});
	}

	it('FINDING: with a synchronous echo the loop re-enters the engine inside the action; the mode decides what happens', async () => {
		const result: Record<string, [string, number]> = {};
		for (const mode of ['single', 'restart', 'parallel'] as const) {
			const h = harness({ seed: { sw: { value: false } }, echoWrites: true, registry: createRegistry([toggleType]) });
			h.engine.load(auto(loopGraph(), mode));
			h.report('sw', true);
			await advance(5_000);
			result[mode] = [h.engine.status('a'), h.writes.length];
		}
		assert.deepEqual(result, {
			single: ['ok', 1], // the re-entrant trigger is ignored: the run is still active
			restart: ['suspended', 30], // each echo restarts; the rate guard ends it
			parallel: ['ok', 10], // the parallel cap drops the 11th nested trigger
		});
	});

	it('FINDING: a loop slower than the limit (one write every 3 s = 20/min) is never caught', async () => {
		const toggle = {
			type: 'test.toggle',
			kind: 'action' as const,
			ports: { inputs: ['in'], outputs: ['done', 'error'] },
			execute: async (_c: unknown, ctx: any) => {
				await ctx.services.writeProperty('sw', !ctx.tracker.read('sw').value);
				return { success: true };
			},
		};
		const h = harness({ seed: { sw: { value: false } }, echoWrites: true, registry: createRegistry([toggle]) });
		h.engine.load(
			auto(graph([['t', 'device.property.changed', { property_id: 'sw' }], ['d', 'flow.delay', { seconds: 3 }], ['flip', 'test.toggle']], ['t:out>d', 'd:out>flip'])),
		);
		h.report('sw', true);
		await advance(600_000);
		assert.equal(h.engine.status('a'), 'ok');
		assert.equal(h.writes.length, 200, 'the light flips every 3 s for ten minutes and nothing intervenes');
	});
});

describe('Any / All joins', () => {
	it('plain fan-in (two edges into one node) executes the node once per arriving token', async () => {
		const h = harness();
		h.engine.load(auto(graph([['t', 'manual'], act('p'), act('q'), act('target')], ['t:out>p', 't:out>q', 'p:done>target', 'q:done>target'])));
		h.engine.trigger('a');
		await flush();
		assert.deepEqual(h.log, ['p', 'q', 'target', 'target']);
	});

	it('Any passes the first arrival and absorbs later arrivals of the same run (traced)', async () => {
		const h = harness();
		h.engine.load(
			auto(
				graph(
					[['t', 'manual'], act('p'), ['d', 'flow.delay', { seconds: 5 }], ['any', 'flow.any'], act('target')],
					['t:out>p', 't:out>d', 'p:done>any', 'd:out>any', 'any:out>target'],
				),
			),
		);
		h.engine.trigger('a');
		await advance(10_000);
		assert.deepEqual(h.log, ['p', 'target']);
		const run = h.engine.runs('a')[0];
		assert.deepEqual(outputs(run.steps.filter((s) => s.nodeId === 'any')), ['any:out', 'any:absorbed']);
		assert.equal(run.status, 'completed');
	});

	it('Any state is per run: a new run passes again', async () => {
		const h = harness();
		h.engine.load(auto(graph([['t1', 'manual'], ['t2', 'manual'], ['any', 'flow.any'], act('target')], ['t1:out>any', 't2:out>any', 'any:out>target']), 'parallel'));
		h.engine.trigger('a', 't1');
		h.engine.trigger('a', 't2');
		await flush();
		assert.deepEqual(h.log, ['target', 'target']);
	});

	it('All waits for a token on every incoming edge, then fires once', async () => {
		const h = harness();
		h.engine.load(
			auto(
				graph(
					[['t', 'manual'], act('p'), ['d', 'flow.delay', { seconds: 5 }], ['all', 'flow.all'], act('target')],
					['t:out>p', 't:out>d', 'p:done>all', 'd:out>all', 'all:out>target'],
				),
			),
		);
		h.engine.trigger('a');
		await advance(4_000);
		assert.deepEqual(h.log, ['p']);
		assert.equal(h.engine.activeCount('a'), 1);
		await advance(1_000);
		assert.deepEqual(h.log, ['p', 'target']);
		assert.deepEqual(outputs(h.engine.runs('a')[0].steps.filter((s) => s.nodeId === 'all')), ['all:waiting', 'all:out']);
	});

	const twoConditions = (): Graph =>
		graph(
			[
				['t', 'manual'],
				['cDark', 'device.property.compare', { property_id: 'lux', operator: 'lt', value: 50 }],
				['cHome', 'device.property.compare', { property_id: 'home', operator: 'eq', value: true }],
				['all', 'flow.all'],
				act('target'),
			],
			['t:out>cDark', 't:out>cHome', 'cDark:yes>all', 'cHome:yes>all', 'all:out>target'],
		);

	it('All over two conditions is a logical AND when both say yes', async () => {
		const h = harness({ seed: { lux: { value: 10 }, home: { value: true } } });
		h.engine.load(auto(twoConditions()));
		h.engine.trigger('a');
		await flush();
		assert.deepEqual(h.log, ['target']);
	});

	it('SPIKE RULE: when one branch can never arrive (condition went "no"), All does not fire; the run ends and the trace says which input was missing', async () => {
		const h = harness({ seed: { lux: { value: 10 }, home: { value: false } } });
		h.engine.load(auto(twoConditions()));
		h.engine.trigger('a');
		await flush();
		assert.deepEqual(h.log, []);
		const run = h.engine.runs('a')[0];
		assert.equal(run.status, 'completed');
		assert.equal(h.engine.activeCount('a'), 0, 'the half-arrived join does not keep the run alive');
		const last = run.steps[run.steps.length - 1];
		assert.equal(last.output, 'unsatisfied');
		assert.deepEqual(last.detail, { missing: ['e4'] });
	});

	it('restart cancels a half-arrived All together with its run; arrivals never leak into the next run', async () => {
		const h = harness();
		h.engine.load(
			auto(
				graph(
					[['t', 'manual'], act('p'), ['d', 'flow.delay', { seconds: 5 }], ['all', 'flow.all'], act('target')],
					['t:out>p', 't:out>d', 'p:done>all', 'd:out>all', 'all:out>target'],
				),
			),
		);
		h.engine.trigger('a'); // run 1: p arrived at All, delay pending
		await advance(3_000);
		h.engine.trigger('a'); // run 2 at t=3 s
		await advance(4_000); // t=7 s: run 1's delay would have fired at 5 s
		assert.deepEqual(h.log, ['p', 'p']);
		await advance(1_000); // t=8 s: run 2's delay fires
		assert.deepEqual(h.log, ['p', 'p', 'target']);
		assert.deepEqual(h.engine.runs('a').map((r) => r.status), ['cancelled', 'completed']);
	});
});

describe('Wait until', () => {
	const g = (): Graph =>
		graph(
			[['t', 'manual'], ['w', 'flow.wait_until', { property_id: 'door', to: 'closed', timeout_seconds: 60 }], act('closed'), act('timedOut')],
			['t:out>w', 'w:out>closed', 'w:timeout>timedOut'],
		);

	it('continues on "out" when the event arrives before the timeout, and releases its timer', async () => {
		const h = harness({ seed: { door: { value: 'open' } } });
		h.engine.load(auto(g()));
		h.engine.trigger('a');
		await advance(30_000);
		assert.deepEqual(outputs(h.engine.runs('a')[0].steps), ['w:waiting']);
		h.report('door', 'closed');
		await advance(120_000);
		assert.deepEqual(h.log, ['closed']);
		assert.deepEqual(outputs(h.engine.runs('a')[0].steps), ['w:out', 'closed:done']);
	});

	it('takes the "timeout" output when nothing happens', async () => {
		const h = harness({ seed: { door: { value: 'open' } } });
		h.engine.load(auto(g()));
		h.engine.trigger('a');
		await advance(59_000);
		assert.deepEqual(h.log, []);
		await advance(1_000);
		assert.deepEqual(h.log, ['timedOut']);
		h.report('door', 'closed'); // late event: the subscription is gone
		await advance(10_000);
		assert.deepEqual(h.log, ['timedOut']);
	});

	it('SPIKE RULE: passes immediately when the state already holds on arrival', async () => {
		const h = harness({ seed: { door: { value: 'closed' } } });
		h.engine.load(auto(g()));
		h.engine.trigger('a');
		await flush();
		assert.deepEqual(h.log, ['closed']);
		assert.equal(h.engine.runs('a')[0].steps[0].reason, 'already true on arrival');
	});

	it('an offline device does not satisfy the wait on its last value; a fresh report does', async () => {
		const h = harness({ seed: { door: { value: 'closed', online: false } } });
		h.engine.load(auto(g()));
		h.engine.trigger('a');
		await advance(10_000);
		assert.deepEqual(h.log, []);
		h.report('door', 'closed');
		await flush();
		assert.deepEqual(h.log, ['closed']);
	});

	it('is cancelled by restart: neither output fires for the old run', async () => {
		const h = harness({ seed: { door: { value: 'open' } } });
		h.engine.load(auto(g()));
		h.engine.trigger('a');
		await advance(30_000);
		h.engine.trigger('a');
		await advance(59_000); // old run would have timed out at t=60 s
		assert.deepEqual(h.log, []);
		await advance(1_000);
		assert.deepEqual(h.log, ['timedOut']);
		assert.deepEqual(outputs(h.engine.runs('a')[0].steps), ['w:cancelled']);
	});
});

describe('editing an automation while it runs', () => {
	const def = (seconds = 30, revision = 1): Automation => ({
		...auto(graph([['t', 'manual'], ['d', 'flow.delay', { seconds }], act('x')], ['t:out>d', 'd:out>x'])),
		revision,
	});

	it('SPIKE RULE: saving a changed graph cancels active runs (reason automation_updated)', async () => {
		const h = harness();
		h.engine.load(def());
		h.engine.trigger('a');
		await advance(10_000);
		h.engine.load(def(31, 2));
		await advance(60_000);
		assert.deepEqual(h.log, []);
		assert.deepEqual(h.engine.runs('a').map((r) => [r.status, r.endReason, r.revision]), [['cancelled', 'automation_updated', 1]]);
	});

	it('SPIKE RULE: a metadata-only save (same graph, mode, enabled) leaves runs alone', async () => {
		const h = harness();
		h.engine.load(def());
		h.engine.trigger('a');
		await advance(10_000);
		h.engine.load(def(30, 2));
		await advance(20_000);
		assert.deepEqual(h.log, ['x']);
	});

	it('disabling cancels runs and drops subscriptions and "for" timers; deleting does the same', async () => {
		const h = harness({ seed: { occ: { value: true } } });
		const g = graph(
			[['t', 'device.property.changed', { property_id: 'occ', to: false, for_seconds: 120 }], ['d', 'flow.delay', { seconds: 30 }], act('x'), ['m', 'manual']],
			['t:out>d', 'm:out>d', 'd:out>x'],
		);
		h.engine.load(auto(g));
		h.engine.trigger('a', 'm');
		h.report('occ', false);
		assert.equal(h.tracker.pendingTimers(), 1);
		h.engine.setEnabled('a', false);
		assert.equal(h.tracker.pendingTimers(), 0);
		assert.equal(h.tracker.trackedCount(), 0);
		assert.equal(h.engine.runs('a')[0].endReason, 'automation_disabled');
		await advance(300_000);
		assert.deepEqual(h.log, []);
		h.engine.setEnabled('a', true);
		h.engine.trigger('a', 'm');
		h.engine.remove('a');
		await advance(300_000);
		assert.deepEqual(h.log, []);
	});

	it('FINDING: a graph save in the middle of a "for" duration restarts the duration from the save', async () => {
		const h = harness({ seed: { occ: { value: true } } });
		const g = (name: string): Graph => graph([['t', 'device.property.changed', { property_id: 'occ', to: false, for_seconds: 120 }], act(name)], ['t:out>off']);
		h.engine.load(auto(g('off')));
		// keep the tracker's value alive across the reload, as PropertyValueService would
		const keep = h.tracker.reference('occ');
		h.report('occ', false);
		await advance(100_000);
		const changed = g('off');
		changed.nodes[1].config = { name: 'off (edited)' };
		h.engine.load({ ...auto(changed), revision: 2 });
		await advance(119_000);
		assert.deepEqual(h.log, []);
		await advance(1_000);
		assert.deepEqual(h.log, ['off (edited)'], 'fired 220 s after the room emptied, not 120 s');
		keep();
	});
});

describe('time window condition', () => {
	const m = (s: string): number => parseHm(s)!;

	it('a window crossing midnight is [from, to): 22:00–06:00', () => {
		const inside = (t: string): boolean => inTimeWindow(m('22:00'), m('06:00'), m(t), 2);
		assert.deepEqual(['21:59', '22:00', '23:59', '00:00', '05:59', '06:00', '12:00'].map(inside), [false, true, true, true, true, false, false]);
	});

	it('a same-day window', () => {
		const inside = (t: string): boolean => inTimeWindow(m('08:00'), m('17:00'), m(t), 2);
		assert.deepEqual(['07:59', '08:00', '16:59', '17:00'].map(inside), [false, true, true, false]);
	});

	it('SPIKE RULE: weekdays name the day the window started, so Fri 22:00–06:00 covers Saturday 01:00', () => {
		const FRI = 5;
		const SAT = 6;
		assert.equal(inTimeWindow(m('22:00'), m('06:00'), m('23:00'), FRI, [FRI]), true);
		assert.equal(inTimeWindow(m('22:00'), m('06:00'), m('01:00'), SAT, [FRI]), true);
		assert.equal(inTimeWindow(m('22:00'), m('06:00'), m('23:00'), SAT, [FRI]), false);
		assert.equal(inTimeWindow(m('22:00'), m('06:00'), m('01:00'), FRI, [FRI]), false);
	});

	it('evaluates in the house timezone, not UTC or the process timezone', () => {
		// 2026-11-10 21:30 UTC is 22:30 in Prague (inside) but 21:30 in UTC (outside)
		const t = localTime(Date.parse('2026-11-10T21:30:00Z'), 'Europe/Prague');
		assert.deepEqual(t, { minutes: 22 * 60 + 30, weekday: 2 });
		assert.equal(localTime(Date.parse('2026-11-10T21:30:00Z'), 'UTC').minutes, 21 * 60 + 30);
	});

	it('the condition node works across midnight with fake time', async () => {
		stopFakeTime();
		startFakeTime('2026-11-10T20:30:00Z'); // 21:30 Prague
		const h = harness();
		h.engine.load(auto(graph([['t', 'manual'], ['c', 'time.window', { from: '22:00', to: '06:00' }], act('night'), act('day')], ['t:out>c', 'c:yes>night', 'c:no>day'])));
		const seen: string[] = [];
		for (let i = 0; i < 5; i++) {
			h.engine.trigger('a');
			await flush();
			seen.push(`${String(h.engine.runs('a')[i].steps[0].observed).slice(0, 9)}=${h.log[i]}`);
			await advance(3 * 3600_000, 3600_000); // +3 h
		}
		assert.deepEqual(seen, ['tue 21:30=day', 'wed 00:30=night', 'wed 03:30=night', 'wed 06:30=day', 'wed 09:30=day']);
	});

	it('FINDING (DST): a window inside the skipped hour never matches; inside the repeated hour it matches for two real hours', () => {
		const win = (iso: string): boolean => {
			const t = localTime(Date.parse(iso), 'Europe/Prague');
			return inTimeWindow(m('02:00'), m('03:00'), t.minutes, t.weekday);
		};
		// Spring forward 2026-03-29: 01:59 CET → 03:00 CEST
		assert.equal(win('2026-03-29T00:59:00Z'), false); // 01:59
		assert.equal(win('2026-03-29T01:00:00Z'), false); // 03:00
		// Fall back 2026-10-25: 02:00–02:59 happens twice
		assert.equal(win('2026-10-25T00:30:00Z'), true); // 02:30 CEST
		assert.equal(win('2026-10-25T01:30:00Z'), true); // 02:30 CET
		assert.equal(win('2026-10-25T02:00:00Z'), false); // 03:00 CET
	});
});

describe('time source', () => {
	it('a wall-clock jump (NTP sync after boot, manual change) moves neither parked delays nor the rate window', async () => {
		let offset = 0;
		const clock = {
			wallNow: () => Date.now() + offset,
			monoNow: () => Date.now(), // stands in for a monotonic source under fake timers
			setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
			clearTimeout: (handle: unknown) => clearTimeout(handle as NodeJS.Timeout),
		};
		const h = harness({ clock, maxRunsPerMinute: 3 });
		h.engine.load(auto(graph([['t', 'manual'], ['d', 'flow.delay', { seconds: 60 }], act('x')], ['t:out>d', 'd:out>x']), 'parallel'));
		for (let i = 0; i < 3; i++) h.engine.trigger('a');
		await advance(10_000);
		offset = 365 * 24 * 3600_000; // the wall clock jumps a year ahead
		await advance(49_000);
		assert.deepEqual(h.log, []);
		await advance(1_000);
		assert.deepEqual(h.log, ['x', 'x', 'x'], 'delays ran for 60 s of elapsed time');
		const run = h.engine.runs('a')[0];
		assert.ok(run.finishedAt! - run.startedAt > 300 * 24 * 3600_000, 'FINDING: trace timestamps are wall clock, so durations computed from them are wrong');
		h.engine.load(auto(graph([['t', 'manual'], act('y')], ['t:out>y']), 'parallel', 'b'));
		for (let i = 0; i < 3; i++) h.engine.trigger('b');
		offset *= 2;
		h.engine.trigger('b');
		assert.equal(h.engine.status('b'), 'suspended', 'the 4th run within a monotonic minute is still caught');
	});
});

import { AutomationNodeReference, AutomationNodeType, AutomationNodeTypeOwner } from '../graph/node-type';
import { ALL_NODE_TYPE } from '../nodes/all.node-type';
import { ANY_NODE_TYPE } from '../nodes/any.node-type';
import { DELAY_NODE_TYPE } from '../nodes/delay.node-type';
import { WAIT_UNTIL_NODE_TYPE, createWaitUntilNodeType } from '../nodes/wait-until.node-type';
import {
	ENGINE_ACTION_TYPE,
	ENGINE_BROKEN_TRIGGER_TYPE,
	ENGINE_CONDITION_TYPE,
	ENGINE_PLUGIN_ACTION_TYPE,
	ENGINE_PLUGIN_DELAY_TYPE,
	ENGINE_PLUGIN_TRIGGER_TYPE,
	ENGINE_TEST_PLUGIN,
	ENGINE_TRIGGER_TYPE,
	EngineHarness,
	Graph,
	flush,
	graph,
	node,
} from '../testing/engine-harness';
import { FAKE_JOIN_TYPE } from '../testing/fake-node-types';
import { FakeTrackerClock } from '../testing/fake-tracker-clock';
import { PROPERTY_BOOL, fixtureFindProperty, target } from '../testing/node-fixtures';
import { StateTracker } from '../tracker/state-tracker';

import {
	ActionPolicyRequest,
	ActionPolicyVerdict,
	AutomationEngine,
	AutomationEngineOptions,
	EngineAutomation,
	EngineAutomationState,
	automationRunSignature,
} from './automation-engine';
import { RunMode } from './mode-policy';
import { RunRecord } from './run-walker';

describe('AutomationEngine', () => {
	const ID = 'automation-1';

	let clock: FakeTrackerClock;
	let harness: EngineHarness;
	let engine: AutomationEngine;
	let started: RunRecord[];
	let ended: RunRecord[];
	let settled: RunRecord[];
	let parked: RunRecord[];
	let statusChanges: { state: EngineAutomationState; previous: string }[];
	let errors: string[];
	let pluginEnabled: boolean;
	let missing: Set<string>;
	let held: string[];
	let releasedReferences: string[];
	let policy: ((request: ActionPolicyRequest) => ActionPolicyVerdict | PromiseLike<ActionPolicyVerdict>) | undefined;

	const create = (options: Partial<AutomationEngineOptions> = {}): AutomationEngine =>
		new AutomationEngine({
			lookup: harness.lookup,
			clock,
			wallNow: () => 1_700_000_000_000 + clock.now(),
			isOwnerEnabled: (owner: AutomationNodeTypeOwner) => owner.type !== ENGINE_TEST_PLUGIN || pluginEnabled,
			referenceExists: (reference: AutomationNodeReference) => !missing.has(`${reference.kind}:${reference.id}`),
			holdReference: (reference: AutomationNodeReference) => {
				held.push(`${reference.kind}:${reference.id}`);

				return () => releasedReferences.push(`${reference.kind}:${reference.id}`);
			},
			actionPolicy: (request) => policy?.(request) ?? { allow: true },
			hooks: {
				statusChanged: (state, previous) => statusChanges.push({ state, previous }),
				runStarted: (record) => started.push(record),
				runParked: (record) => parked.push(record),
				runEnded: (record) => ended.push(record),
				runSettled: (record) => settled.push(record),
				error: (_error, what) => errors.push(what),
			},
			...options,
		});

	beforeEach(() => {
		clock = new FakeTrackerClock();
		harness = new EngineHarness(clock);
		started = [];
		ended = [];
		settled = [];
		parked = [];
		statusChanges = [];
		errors = [];
		pluginEnabled = true;
		missing = new Set();
		held = [];
		releasedReferences = [];
		policy = undefined;
		engine = create();
	});

	const automation = (automationGraph: Graph, overrides: Partial<EngineAutomation> = {}): EngineAutomation => ({
		id: ID,
		enabled: true,
		mode: 'restart',
		revision: 1,
		graph: automationGraph,
		...overrides,
	});

	/** trigger → action */
	const simple = graph([node('t', ENGINE_TRIGGER_TYPE), node('a', ENGINE_ACTION_TYPE)], ['t:out>a']);

	/** trigger → Delay 120 s → action: the reference "becomes clear → wait → off" */
	const delayed = graph(
		[node('t', ENGINE_TRIGGER_TYPE), node('wait', DELAY_NODE_TYPE, { seconds: 120 }), node('off', ENGINE_ACTION_TYPE)],
		['t:out>wait', 'wait:out>off'],
	);

	const fire = async (key = 'default'): Promise<void> => {
		harness.fire(key);
		await flush();
	};

	const state = (id = ID): EngineAutomationState => {
		const found = engine.state(id);

		if (!found) throw new Error(`automation ${id} is not loaded`);

		return found;
	};

	describe('loading', () => {
		it('arms an enabled automation and runs it when its trigger fires', async () => {
			expect(await engine.load(automation(simple))).toMatchObject({
				status: 'ok',
				armed: true,
				armedTriggers: 1,
				activeRuns: 0,
				problems: [],
			});
			expect(harness.activeSubscriptions()).toBe(1);

			await fire();

			expect(harness.calls).toEqual(['a']);
			expect(started).toHaveLength(1);
			expect(ended.map((record) => record.status)).toEqual(['completed']);
			expect(settled).toHaveLength(1);
			expect(state()).toMatchObject({
				lastRunStatus: 'completed',
				triggers: { started: 1, ignored: 0, dropped: 0 },
				lastTriggeredAt: expect.any(Number) as number,
			});
		});

		it('hands the trigger data and the revision to the run', async () => {
			await engine.load(automation(simple, { revision: 7 }));

			harness.fire('default', { to: true, from: false });
			await flush();

			expect(started[0]).toMatchObject({
				automationId: ID,
				revision: 7,
				trigger: { nodeId: 't', data: { to: true, from: false }, manual: false },
			});
			expect(harness.contexts.get('a')?.trigger).toEqual({
				nodeId: 't',
				data: { to: true, from: false },
				manual: false,
			});
		});

		it('a disabled automation holds no subscription, no reference and no timer', async () => {
			const withReference = graph(
				[
					node('t', ENGINE_TRIGGER_TYPE),
					node('a', ENGINE_ACTION_TYPE, { references: [{ kind: 'property', id: 'p-1' }] }),
				],
				['t:out>a'],
			);

			expect(await engine.load(automation(withReference, { enabled: false }))).toMatchObject({
				status: 'ok',
				armed: false,
				armedTriggers: 0,
			});
			expect(harness.subscribed).toBe(0);
			expect(held).toEqual([]);
			expect(clock.pending()).toBe(0);
		});

		it('keeps the last-seen value of every referenced property of an armed automation, and lets go when it stops', async () => {
			const withReferences = graph(
				[
					node('t', ENGINE_TRIGGER_TYPE, { references: [{ kind: 'property', id: 'p-1' }] }),
					node('c', ENGINE_CONDITION_TYPE, { references: [{ kind: 'property', id: 'p-2' }] }),
					node('a', ENGINE_ACTION_TYPE, {
						references: [
							{ kind: 'property', id: 'p-2' },
							{ kind: 'scene', id: 's-1' },
						],
					}),
				],
				['t:out>c', 'c:yes>a'],
			);

			await engine.load(automation(withReferences));

			expect(held).toEqual(['property:p-1', 'property:p-2', 'scene:s-1']);

			await engine.load(automation(withReferences, { enabled: false, revision: 2 }));

			expect(releasedReferences).toEqual(['property:p-1', 'property:p-2', 'scene:s-1']);
		});

		it('an unfinished graph is fine while disabled and invalid when enabled', async () => {
			const noTrigger = graph([node('a', ENGINE_ACTION_TYPE)]);

			expect(await engine.load(automation(noTrigger, { enabled: false }))).toMatchObject({
				status: 'ok',
				problems: [],
			});
			expect(await engine.load(automation(noTrigger, { enabled: true, revision: 2 }))).toMatchObject({
				status: 'invalid',
				armed: false,
				problems: [{ code: 'no_trigger' }],
			});
		});

		it('a node type that is not registered marks the automation invalid instead of failing', async () => {
			const unknown = graph([node('t', ENGINE_TRIGGER_TYPE), node('gone', 'plugin.removed')], ['t:out>gone']);

			for (const enabled of [true, false]) {
				expect(await engine.load(automation(unknown, { enabled, revision: enabled ? 1 : 2 }))).toMatchObject({
					status: 'invalid',
					armed: false,
					problems: [{ code: 'unknown_node_type', node_id: 'gone' }],
				});
			}

			expect(harness.subscribed).toBe(0);
			expect(errors).toEqual([]);
		});

		it('a node type that disappears is noticed by the next save, and one that comes back heals the automation', async () => {
			await engine.load(automation(simple));

			harness.unregister(ENGINE_ACTION_TYPE);

			expect(await engine.load(automation(simple, { revision: 2 }))).toMatchObject({ status: 'ok' });

			// A changed graph is validated again
			const moved = graph([node('t', ENGINE_TRIGGER_TYPE), node('a2', ENGINE_ACTION_TYPE)], ['t:out>a2']);

			expect(await engine.load(automation(moved, { revision: 3 }))).toMatchObject({ status: 'invalid' });
			expect(harness.activeSubscriptions()).toBe(0);

			harness = new EngineHarness(clock);
			engine = create();

			expect(await engine.load(automation(moved, { revision: 4 }))).toMatchObject({ status: 'ok', armed: true });
		});

		it('a block the engine cannot run marks an enabled automation invalid', async () => {
			const withJoin = graph(
				[node('t', ENGINE_TRIGGER_TYPE), node('j', FAKE_JOIN_TYPE)],
				[{ id: 'e1', source: 't', source_port: 'out', target: 'j', target_port: 'a' }],
			);

			expect(await engine.load(automation(withJoin))).toMatchObject({
				status: 'invalid',
				problems: [{ code: 'not_runnable', node_id: 'j' }],
			});
			expect(await engine.load(automation(withJoin, { enabled: false, revision: 2 }))).toMatchObject({ status: 'ok' });
		});

		it('a reference to something that does not exist marks the automation invalid and names the node', async () => {
			missing.add('scene:s-1');

			const withScene = graph(
				[
					node('t', ENGINE_TRIGGER_TYPE),
					node('run', ENGINE_ACTION_TYPE, { references: [{ kind: 'scene', id: 's-1' }] }),
				],
				['t:out>run'],
			);

			expect(await engine.load(automation(withScene))).toMatchObject({
				status: 'invalid',
				armed: false,
				problems: [
					{ code: 'missing_reference', node_id: 'run', message: 'The scene this block refers to no longer exists.' },
				],
			});

			missing.clear();

			expect(await engine.load(automation(withScene, { revision: 2 }))).toMatchObject({ status: 'ok', armed: true });
		});

		it('a reference lookup that fails does not stop the automation', async () => {
			engine = create({
				referenceExists: () => {
					throw new Error('database is busy');
				},
			});

			const withScene = graph(
				[
					node('t', ENGINE_TRIGGER_TYPE),
					node('run', ENGINE_ACTION_TYPE, { references: [{ kind: 'scene', id: 's-1' }] }),
				],
				['t:out>run'],
			);

			expect(await engine.load(automation(withScene))).toMatchObject({ status: 'ok', armed: true });
			expect(errors).toEqual(['checking a scene reference']);
		});

		it('a trigger that cannot be armed marks the automation invalid and leaves nothing subscribed', async () => {
			const broken = graph(
				[node('t1', ENGINE_TRIGGER_TYPE), node('t2', ENGINE_BROKEN_TRIGGER_TYPE), node('a', ENGINE_ACTION_TYPE)],
				['t1:out>a', 't2:out>a'],
			);

			expect(await engine.load(automation(broken))).toMatchObject({
				status: 'invalid',
				armed: false,
				problems: [{ code: 'trigger_failed', node_id: 't2' }],
			});
			expect(harness.activeSubscriptions()).toBe(0);
		});

		it('ignores a revision older than the one it holds', async () => {
			await engine.load(automation(simple, { revision: 5 }));

			expect(await engine.load(automation(simple, { revision: 4, enabled: false }))).toMatchObject({
				revision: 5,
				enabled: true,
				armed: true,
			});
		});

		it('loads what loadAll reads before anything asked for meanwhile', async () => {
			const all = engine.loadAll(async () => {
				await flush();

				return [{ automation: automation(simple, { revision: 1 }) }];
			});
			const later = engine.load(automation(simple, { revision: 2, enabled: false }));

			await Promise.all([all, later]);

			expect(state()).toMatchObject({ revision: 2, enabled: false, armed: false });
		});

		it('a trigger that fires through a released subscription starts nothing', async () => {
			await engine.load(automation(simple));
			await engine.load(automation(simple, { enabled: false, revision: 2 }));

			harness.fireStale();
			await flush();

			expect(started).toHaveLength(0);
		});

		it('removes an automation: subscriptions dropped, runs cancelled', async () => {
			await engine.load(automation(delayed));
			await fire();

			expect(await engine.remove(ID)).toBe(true);
			await flush();

			expect(engine.state(ID)).toBeUndefined();
			expect(harness.activeSubscriptions()).toBe(0);
			expect(ended[0]).toMatchObject({ status: 'cancelled', endReason: 'automation_deleted' });
			expect(clock.pending()).toBe(0);
			expect(await engine.remove(ID)).toBe(false);
		});
	});

	describe('modes', () => {
		const load = (mode: RunMode, automationGraph = delayed): Promise<EngineAutomationState> =>
			engine.load(automation(automationGraph, { mode }));

		it('single: a trigger is ignored while a run is active, counted, and accepted again afterwards', async () => {
			await load('single');
			await fire();
			await fire();

			expect(started).toHaveLength(1);
			expect(state()).toMatchObject({
				activeRuns: 1,
				triggers: { started: 1, ignored: 1, dropped: 0 },
				lastSkipped: { outcome: 'ignored', nodeId: 't', reason: 'A run is already active and the mode is single.' },
			});

			clock.advanceSeconds(120);
			await flush();

			expect(harness.calls).toEqual(['off']);

			await fire();

			expect(started).toHaveLength(2);
		});

		it('restart: the active run and its parked delay are cancelled and a new run starts', async () => {
			await load('restart');
			await fire();

			clock.advanceSeconds(60);
			await fire();

			expect(ended).toHaveLength(1);
			expect(ended[0]).toMatchObject({ status: 'cancelled', endReason: 'restarted' });
			expect(state().activeRuns).toBe(1);

			// The first run would have switched off here
			clock.advanceSeconds(60);
			await flush();

			expect(harness.calls).toEqual([]);

			clock.advanceSeconds(60);
			await flush();

			expect(harness.calls).toEqual(['off']);
			expect(ended.map((record) => record.status)).toEqual(['cancelled', 'completed']);
		});

		it('restart cancels every active run of the automation, whichever trigger started it', async () => {
			// "becomes clear → Delay → off" and "motion → on" on one canvas: new motion must cancel the pending off
			const motionLight = graph(
				[
					node('clear', ENGINE_TRIGGER_TYPE, { key: 'clear' }),
					node('motion', ENGINE_TRIGGER_TYPE, { key: 'motion' }),
					node('wait', DELAY_NODE_TYPE, { seconds: 120 }),
					node('off', ENGINE_ACTION_TYPE),
					node('on', ENGINE_ACTION_TYPE),
				],
				['clear:out>wait', 'wait:out>off', 'motion:out>on'],
			);

			await load('restart', motionLight);
			await fire('clear');

			clock.advanceSeconds(60);
			await fire('motion');

			clock.advanceSeconds(600);
			await flush();

			expect(harness.calls).toEqual(['on']);
			expect(ended.map((record) => [record.trigger.nodeId, record.status])).toEqual([
				['clear', 'cancelled'],
				['motion', 'completed'],
			]);
		});

		it('parallel: runs overlap up to 10; the 11th trigger is dropped and counted', async () => {
			await load('parallel');

			for (let run = 0; run < 11; run += 1) await fire();

			expect(started).toHaveLength(10);
			expect(state()).toMatchObject({
				activeRuns: 10,
				triggers: { started: 10, ignored: 0, dropped: 1 },
				lastSkipped: { outcome: 'dropped', reason: 'The limit of 10 parallel runs is reached.' },
			});

			clock.advanceSeconds(120);
			await flush();

			expect(harness.calls).toHaveLength(10);
			expect(state().activeRuns).toBe(0);
		});

		it('a cancelled run whose action is still executing no longer counts as active', async () => {
			const slow = graph(
				[node('t', ENGINE_TRIGGER_TYPE), node('write', ENGINE_ACTION_TYPE, { latencyMs: 500 })],
				['t:out>write'],
			);

			await load('single', slow);
			await fire();
			await engine.load(automation(slow, { mode: 'restart', revision: 2 }));

			expect(ended[0]).toMatchObject({ status: 'cancelled', endReason: 'automation_updated' });
			expect(settled).toHaveLength(0);
			expect(engine.activeRunCount()).toBe(0);

			clock.advance(500);
			await flush();

			expect(settled).toHaveLength(1);
			expect(settled[0].steps[0]).toMatchObject({ nodeId: 'write', afterCancel: true });
		});
	});

	describe('guards', () => {
		it('more than 30 runs in a minute suspends the automation, drops its subscriptions and reports it once', async () => {
			await engine.load(automation(simple));

			for (let run = 0; run < 30; run += 1) {
				await fire();
				clock.advanceSeconds(1);
			}

			expect(started).toHaveLength(30);
			expect(statusChanges).toHaveLength(0);

			await fire();

			expect(started).toHaveLength(30);
			expect(statusChanges).toHaveLength(1);
			expect(statusChanges[0]).toMatchObject({
				previous: 'ok',
				state: {
					id: ID,
					status: 'suspended',
					armed: false,
					suspendedReason: 'The automation started more than 30 runs per minute.',
				},
			});
			expect(harness.activeSubscriptions()).toBe(0);

			harness.fireStale();
			await flush();

			expect(started).toHaveLength(30);
			expect(statusChanges).toHaveLength(1);
		});

		it('the window slides: 30 runs, a pause of a minute, 30 more runs is fine', async () => {
			await engine.load(automation(simple));

			for (let run = 0; run < 30; run += 1) await fire();

			clock.advanceSeconds(60);

			for (let run = 0; run < 30; run += 1) await fire();

			expect(started).toHaveLength(60);
			expect(state().status).toBe('ok');
		});

		it('a slow loop passes the minute window and is suspended by the hourly one', async () => {
			await engine.load(automation(simple));

			// One run every three seconds: 20 a minute
			for (let run = 0; run < 201; run += 1) {
				await fire();
				clock.advanceSeconds(3);
			}

			expect(started).toHaveLength(200);
			expect(state()).toMatchObject({
				status: 'suspended',
				suspendedReason: 'The automation started more than 200 runs per hour.',
			});
		});

		it('suspension cancels parked runs', async () => {
			engine = create({ limits: { maxParallelRuns: 100 } });
			await engine.load(automation(delayed, { mode: 'parallel' }));

			for (let run = 0; run < 31; run += 1) await fire();

			expect(state()).toMatchObject({ status: 'suspended', activeRuns: 0 });
			expect(ended.filter((record) => record.endReason === 'suspended')).toHaveLength(30);

			clock.advanceSeconds(120);
			await flush();

			expect(harness.calls).toEqual([]);
		});

		it('saving the automation clears the suspension, even when nothing but its name changed', async () => {
			await engine.load(automation(simple));

			for (let run = 0; run < 31; run += 1) await fire();

			expect(state().status).toBe('suspended');

			expect(await engine.load(automation(simple, { revision: 2 }))).toMatchObject({ status: 'ok', armed: true });

			await fire();

			expect(started).toHaveLength(31);
		});

		it('an event that carries the revision the engine already holds does not clear the suspension', async () => {
			await engine.load(automation(simple));

			for (let run = 0; run < 31; run += 1) await fire();

			expect(await engine.load(automation(simple))).toMatchObject({ status: 'suspended', armed: false });
		});

		it('stays suspended when loaded as suspended, as after a restart of the backend', async () => {
			expect(await engine.load(automation(simple), { suspended: true })).toMatchObject({
				status: 'suspended',
				armed: false,
			});
			expect(harness.subscribed).toBe(0);
		});

		it('the global cap on concurrent runs drops triggers across automations', async () => {
			engine = create({ limits: { maxConcurrentRuns: 3 } });

			for (const id of ['one', 'two']) {
				await engine.load(
					automation(
						graph(
							[node('t', ENGINE_TRIGGER_TYPE, { key: id }), node('wait', DELAY_NODE_TYPE, { seconds: 60 })],
							['t:out>wait'],
						),
						{ id, mode: 'parallel' },
					),
				);
			}

			await fire('one');
			await fire('one');
			await fire('two');
			await fire('two');

			expect(engine.activeRunCount()).toBe(3);
			expect(state('two')).toMatchObject({
				triggers: { started: 1, dropped: 1 },
				lastSkipped: { outcome: 'dropped', reason: 'The limit of 3 concurrent runs is reached.' },
			});

			clock.advanceSeconds(60);
			await flush();
			await fire('two');

			expect(state('two').triggers.started).toBe(2);
		});

		it('the counters survive a save', async () => {
			await engine.load(automation(delayed, { mode: 'single' }));
			await fire();
			await fire();
			await engine.load(automation(simple, { mode: 'single', revision: 2 }));

			expect(state().triggers).toEqual({ started: 1, ignored: 1, dropped: 0 });
		});
	});

	describe('saving while it runs', () => {
		it('a changed graph cancels active runs and rebuilds the subscriptions', async () => {
			await engine.load(automation(delayed));
			await fire();

			await engine.load(automation(simple, { revision: 2 }));

			expect(ended[0]).toMatchObject({ status: 'cancelled', endReason: 'automation_updated' });
			expect(harness.subscribed).toBe(2);
			expect(harness.released).toBe(1);
			expect(clock.pending()).toBe(0);
		});

		it('a changed mode cancels active runs', async () => {
			await engine.load(automation(delayed));
			await fire();
			await engine.load(automation(delayed, { mode: 'single', revision: 2 }));

			expect(ended[0]).toMatchObject({ status: 'cancelled', endReason: 'automation_updated' });
		});

		it('a save that changes nothing of how it runs leaves runs, timers and subscriptions alone', async () => {
			await engine.load(automation(delayed));
			await fire();

			// A rename, and nodes moved on the canvas
			const tidied: Graph = {
				...delayed,
				nodes: delayed.nodes.map((item, index) => ({ ...item, position: { x: index * 200, y: 40 } })),
			};

			expect(await engine.load(automation(tidied, { revision: 2 }))).toMatchObject({ revision: 2, activeRuns: 1 });
			expect(ended).toHaveLength(0);
			expect(harness.subscribed).toBe(1);
			expect(harness.released).toBe(0);

			clock.advanceSeconds(120);
			await flush();

			expect(harness.calls).toEqual(['off']);
			expect(automationRunSignature(automation(tidied))).toBe(automationRunSignature(automation(delayed)));
		});

		it('disabling cancels runs and drops the subscriptions', async () => {
			await engine.load(automation(delayed));
			await fire();
			await engine.load(automation(delayed, { enabled: false, revision: 2 }));

			expect(ended[0]).toMatchObject({ status: 'cancelled', endReason: 'automation_disabled' });
			expect(harness.activeSubscriptions()).toBe(0);
			expect(clock.pending()).toBe(0);
			expect(state()).toMatchObject({ armed: false, lastRunStatus: 'cancelled' });
		});

		it('ends active runs as interrupted when the engine stops', async () => {
			await engine.load(automation(delayed));
			await fire();
			await engine.clear('engine_stopped');

			expect(ended[0]).toMatchObject({ status: 'interrupted', endReason: 'engine_stopped' });
			expect(engine.states()).toEqual([]);
			expect(harness.activeSubscriptions()).toBe(0);
			expect(clock.pending()).toBe(0);
		});
	});

	describe('manual run', () => {
		const twoTriggers = graph(
			[
				node('t1', ENGINE_TRIGGER_TYPE, { key: 'one' }),
				node('t2', ENGINE_TRIGGER_TYPE, { key: 'two' }),
				node('a1', ENGINE_ACTION_TYPE),
				node('a2', ENGINE_ACTION_TYPE),
			],
			['t1:out>a1', 't2:out>a2'],
		);

		it('starts at the first trigger by default, or at the trigger asked for', async () => {
			await engine.load(automation(twoTriggers, { mode: 'parallel' }));

			expect(await engine.trigger(ID)).toEqual({ outcome: 'started', runId: started[0].id });
			expect(await engine.trigger(ID, 't2')).toMatchObject({ outcome: 'started' });
			await flush();

			expect(harness.calls).toEqual(['a1', 'a2']);
			expect(started[0].trigger).toEqual({ nodeId: 't1', data: { manual: true }, manual: true });
		});

		it('may start only at a trigger node', async () => {
			await engine.load(automation(twoTriggers));

			expect(await engine.trigger(ID, 'a1')).toMatchObject({ outcome: 'refused', code: 'not_a_trigger' });
			expect(await engine.trigger(ID, 'nowhere')).toMatchObject({ outcome: 'refused', code: 'not_a_trigger' });
			expect(started).toHaveLength(0);
		});

		it('is refused while the automation is invalid, suspended, disabled or unknown', async () => {
			expect(await engine.trigger(ID)).toMatchObject({ outcome: 'refused', code: 'not_found' });

			await engine.load(automation(simple, { enabled: false }));

			expect(await engine.trigger(ID)).toMatchObject({ outcome: 'refused', code: 'disabled' });

			await engine.load(automation(simple, { revision: 2 }), { suspended: true });

			expect(await engine.trigger(ID)).toMatchObject({ outcome: 'refused', code: 'suspended' });

			await engine.load(automation(graph([node('a', ENGINE_ACTION_TYPE)]), { revision: 3 }));

			expect(await engine.trigger(ID)).toMatchObject({ outcome: 'refused', code: 'invalid' });
			expect(started).toHaveLength(0);
		});

		it('obeys the mode and the guards like any other trigger', async () => {
			await engine.load(automation(delayed, { mode: 'single' }));

			expect(await engine.trigger(ID)).toMatchObject({ outcome: 'started' });
			expect(await engine.trigger(ID)).toMatchObject({ outcome: 'ignored' });
			expect(state().triggers).toEqual({ started: 1, ignored: 1, dropped: 0 });
		});

		it('waits for a save that was asked for before it', async () => {
			const loading = engine.load(automation(simple));
			const outcome = engine.trigger(ID);

			await loading;

			expect(await outcome).toMatchObject({ outcome: 'started' });
		});
	});

	describe('invalidation', () => {
		const withReferences = graph(
			[
				node('t', ENGINE_TRIGGER_TYPE, { references: [{ kind: 'property', id: 'p-1' }] }),
				node('wait', DELAY_NODE_TYPE, { seconds: 60 }),
				node('scene', ENGINE_ACTION_TYPE, { references: [{ kind: 'scene', id: 's-1' }] }),
			],
			['t:out>wait', 'wait:out>scene'],
		);

		it('marks the automation invalid and stops it when something it refers to is removed', async () => {
			await engine.load(automation(withReferences));
			await engine.load(
				automation(
					graph([node('t', ENGINE_TRIGGER_TYPE, { key: 'other' }), node('a', ENGINE_ACTION_TYPE)], ['t:out>a']),
					{
						id: 'other',
					},
				),
			);
			await fire();

			const hit = await engine.invalidate((reference) => reference.kind === 'scene' && reference.id === 's-1');

			expect(hit.map((item) => item.id)).toEqual([ID]);
			expect(state()).toMatchObject({
				status: 'invalid',
				armed: false,
				activeRuns: 0,
				problems: [{ code: 'missing_reference', node_id: 'scene' }],
			});
			expect(state('other')).toMatchObject({ status: 'ok', armed: true });
			expect(ended.find((record) => record.automationId === ID)).toMatchObject({
				status: 'cancelled',
				endReason: 'automation_invalid',
			});
			expect(statusChanges).toHaveLength(1);
			expect(statusChanges[0]).toMatchObject({ previous: 'ok', state: { id: ID, status: 'invalid' } });
			expect(releasedReferences).toContain('property:p-1');

			harness.fire();
			clock.advanceSeconds(60);
			await flush();

			expect(harness.calls).toEqual([]);
		});

		it('also marks a disabled automation, and reports an automation only once', async () => {
			await engine.load(automation(withReferences, { enabled: false }));

			await engine.invalidate((reference) => reference.kind === 'property');
			await engine.invalidate((reference) => reference.kind === 'scene');

			expect(state().problems.map((problem) => problem.node_id)).toEqual(['t', 'scene']);
			expect(statusChanges).toHaveLength(1);
		});

		it('leaves automations that do not refer to it alone', async () => {
			await engine.load(automation(withReferences));

			expect(await engine.invalidate((reference) => reference.id === 'something-else')).toEqual([]);
			expect(state().status).toBe('ok');
		});

		it('a save with the reference still missing stays invalid; one without it recovers', async () => {
			await engine.load(automation(withReferences));
			missing.add('scene:s-1');
			await engine.invalidate((reference) => reference.kind === 'scene');

			expect(await engine.load(automation(withReferences, { revision: 2 }))).toMatchObject({ status: 'invalid' });
			expect(await engine.load(automation(simple, { revision: 3 }))).toMatchObject({ status: 'ok', armed: true });
		});
	});

	describe('a node type that is not available', () => {
		it('keeps an enabled automation armed: the card copes without what it needs', async () => {
			const trigger = harness.lookup(ENGINE_TRIGGER_TYPE)?.definition as AutomationNodeType<any>;

			harness.register({ ...trigger, type: 'engine.unavailable-trigger', unavailableReason: () => 'Not set up.' });

			expect(
				await engine.load(
					automation(graph([node('t', 'engine.unavailable-trigger'), node('a', ENGINE_ACTION_TYPE)], ['t:out>a'])),
				),
			).toMatchObject({ status: 'ok', armed: true, armedTriggers: 1, problems: [] });

			await fire();

			expect(harness.calls).toEqual(['a']);
		});
	});

	describe('owning plugin', () => {
		const pluginGraph = graph(
			[
				node('core', ENGINE_TRIGGER_TYPE, { key: 'core' }),
				node('plugin', ENGINE_PLUGIN_TRIGGER_TYPE, { key: 'plugin' }),
				node('own', ENGINE_PLUGIN_ACTION_TYPE),
				node('handler', ENGINE_ACTION_TYPE),
			],
			['core:out>own', 'plugin:out>own', 'own:error>handler'],
		);

		it('does not arm a trigger whose plugin is disabled; the automation stays valid', async () => {
			pluginEnabled = false;

			expect(await engine.load(automation(pluginGraph))).toMatchObject({ status: 'ok', armed: true, armedTriggers: 1 });
			expect(harness.fire('plugin')).toBe(0);
		});

		it('does not execute a node whose plugin is disabled: an action takes error and the refusal is traced', async () => {
			pluginEnabled = false;

			await engine.load(automation(pluginGraph));
			await fire('core');

			expect(harness.calls).toEqual(['handler']);
			expect(settled[0].steps[0]).toMatchObject({
				nodeId: 'own',
				output: 'error',
				refused: true,
				reason: 'The plugin this block belongs to is disabled.',
			});
		});

		it('does not park on a delay whose plugin is disabled: the token ends and the run fails', async () => {
			pluginEnabled = false;

			await engine.load(
				automation(
					graph(
						[
							node('core', ENGINE_TRIGGER_TYPE, { key: 'core' }),
							node('wait', ENGINE_PLUGIN_DELAY_TYPE, { seconds: 60 }),
							node('after', ENGINE_ACTION_TYPE),
						],
						['core:out>wait', 'wait:out>after'],
					),
				),
			);
			await fire('core');
			clock.advance(60_000);
			await flush();

			expect(harness.calls).toEqual([]);
			expect(parked).toEqual([]);
			expect(settled[0]).toMatchObject({ status: 'failed' });
			expect(settled[0].steps[0]).toMatchObject({
				nodeId: 'wait',
				refused: true,
				reason: 'The plugin this block belongs to is disabled.',
			});
		});

		it('arms and drops the triggers of a plugin when it is enabled or disabled, without touching runs', async () => {
			await engine.load(automation(pluginGraph));

			expect(state().armedTriggers).toBe(2);
			expect(await engine.refreshOwners()).toEqual([]);

			pluginEnabled = false;

			expect(await engine.refreshOwners()).toEqual([ID]);
			expect(state()).toMatchObject({ status: 'ok', armedTriggers: 1 });
			expect(harness.fire('plugin')).toBe(0);

			pluginEnabled = true;
			await engine.refreshOwners();

			expect(state().armedTriggers).toBe(2);
			expect(harness.fire('plugin')).toBe(1);
			expect(ended.filter((record) => record.status === 'cancelled')).toHaveLength(0);
		});

		it('ignores a trigger that fires after its plugin was disabled', async () => {
			await engine.load(automation(pluginGraph));

			pluginEnabled = false;
			await fire('plugin');

			expect(started).toHaveLength(0);
			expect(state().triggers).toEqual({ started: 0, ignored: 1, dropped: 0 });
		});
	});

	describe('action policy', () => {
		it('is asked before every action; a refusal takes error and is traced', async () => {
			const requests: ActionPolicyRequest[] = [];

			policy = (request) => {
				requests.push(request);

				return request.nodeId === 'unlock' ? { allow: false, reason: 'Unlocking is not allowed.' } : { allow: true };
			};

			await engine.load(
				automation(
					graph(
						[
							node('t', ENGINE_TRIGGER_TYPE),
							node('c', ENGINE_CONDITION_TYPE),
							node('unlock', ENGINE_ACTION_TYPE, { name: 'unlock', level: 1 }),
							node('light', ENGINE_ACTION_TYPE),
						],
						['t:out>c', 'c:yes>unlock', 'c:yes>light'],
					),
				),
			);
			await fire();

			expect(harness.calls).toEqual(['c', 'light']);
			expect(requests.map((request) => request.nodeId)).toEqual(['unlock', 'light']);
			expect(requests[0]).toMatchObject({ automationId: ID, type: ENGINE_ACTION_TYPE, config: { level: 1 } });
			expect(settled[0].steps.find((step) => step.nodeId === 'unlock')).toMatchObject({
				output: 'error',
				refused: true,
				reason: 'Unlocking is not allowed.',
			});
			expect(settled[0].status).toBe('failed');
		});

		it('waits for a policy that has to look something up', async () => {
			policy = (request) =>
				new Promise<ActionPolicyVerdict>((resolve) => {
					clock.setTimeout(
						() =>
							resolve(
								request.nodeId === 'unlock'
									? { allow: false, reason: 'An automation can not unlock a lock.' }
									: { allow: true },
							),
						20,
					);
				});

			await engine.load(
				automation(
					graph(
						[node('t', ENGINE_TRIGGER_TYPE), node('unlock', ENGINE_ACTION_TYPE), node('light', ENGINE_ACTION_TYPE)],
						['t:out>unlock', 'unlock:error>light'],
					),
				),
			);

			harness.fire();
			await flush();

			expect(harness.calls).toEqual([]);

			clock.advance(20);
			await flush();
			clock.advance(20);
			await flush();

			expect(harness.calls).toEqual(['light']);
			expect(settled[0].steps.find((step) => step.nodeId === 'unlock')).toMatchObject({
				output: 'error',
				refused: true,
				reason: 'An automation can not unlock a lock.',
			});
			expect(settled[0].status).toBe('completed');
		});

		it('a policy that rejects lets nothing through', async () => {
			policy = () => Promise.reject(new Error('database is locked'));

			await engine.load(automation(simple));
			await fire();

			expect(harness.calls).toEqual([]);
			expect(settled[0].steps[0]).toMatchObject({
				output: 'error',
				refused: true,
				reason: 'The safety policy could not be checked.',
			});
			expect(errors).toContain('asking the action policy');
		});

		it('a policy that fails lets nothing through', async () => {
			policy = () => {
				throw new Error('policy broke');
			};

			await engine.load(automation(simple));
			await fire();

			expect(harness.calls).toEqual([]);
			expect(settled[0].steps[0]).toMatchObject({ output: 'error', refused: true });
		});

		it('a policy whose answer can not be read lets nothing through and the action takes error', async () => {
			policy = (request) =>
				request.nodeId === 'unlock'
					? (Object.defineProperty({ allow: true }, 'then', {
							get: () => {
								throw new Error('then broke');
							},
						}) as ActionPolicyVerdict)
					: { allow: true };

			await engine.load(
				automation(
					graph(
						[node('t', ENGINE_TRIGGER_TYPE), node('unlock', ENGINE_ACTION_TYPE), node('light', ENGINE_ACTION_TYPE)],
						['t:out>unlock', 'unlock:error>light'],
					),
				),
			);
			await fire();

			expect(harness.calls).toEqual(['light']);
			expect(settled[0].steps.find((step) => step.nodeId === 'unlock')).toMatchObject({
				output: 'error',
				refused: true,
				reason: 'The safety policy could not be checked.',
			});
			expect(settled[0].status).toBe('completed');
			expect(errors).toContain('asking the action policy');
		});

		it('does not execute an action whose plugin was disabled while the policy was looking it up', async () => {
			let answer: (verdict: ActionPolicyVerdict) => void = () => undefined;

			policy = (request) =>
				request.nodeId === 'own'
					? new Promise<ActionPolicyVerdict>((resolve) => {
							answer = resolve;
						})
					: { allow: true };

			await engine.load(
				automation(
					graph(
						[
							node('t', ENGINE_TRIGGER_TYPE),
							node('own', ENGINE_PLUGIN_ACTION_TYPE),
							node('handler', ENGINE_ACTION_TYPE),
						],
						['t:out>own', 'own:error>handler'],
					),
				),
			);

			harness.fire();
			await flush();

			pluginEnabled = false;
			await engine.refreshOwners();

			answer({ allow: true });
			await flush();

			expect(harness.calls).toEqual(['handler']);
			expect(settled[0].steps.find((step) => step.nodeId === 'own')).toMatchObject({
				output: 'error',
				refused: true,
				reason: 'The plugin this block belongs to is disabled.',
			});
		});
	});

	it('survives hooks that throw', async () => {
		engine = create({
			hooks: {
				runStarted: () => {
					throw new Error('hook broke');
				},
				runEnded: () => {
					throw new Error('hook broke');
				},
				error: (_error, what) => errors.push(what),
			},
		});

		await engine.load(automation(simple));
		await fire();

		expect(harness.calls).toEqual(['a']);
		expect(engine.state(ID)).toMatchObject({ lastRunStatus: 'completed', activeRuns: 0 });
		expect(errors).toEqual(['the runStarted hook', 'the runEnded hook']);
	});
	describe('joins and Wait until', () => {
		/** trigger → action → All, and trigger → Delay 60 s → All; All → off */
		const joined = graph(
			[
				node('t', ENGINE_TRIGGER_TYPE),
				node('now', ENGINE_ACTION_TYPE),
				node('wait', DELAY_NODE_TYPE, { seconds: 60 }),
				node('all', ALL_NODE_TYPE),
				node('off', ENGINE_ACTION_TYPE),
			],
			['t:out>now', 't:out>wait', 'now:done>all', 'wait:out>all', 'all:out>off'],
		);

		it('an All continues once every branch of the run has arrived', async () => {
			expect(await engine.load(automation(joined))).toMatchObject({ status: 'ok' });

			await fire();

			expect(harness.calls).toEqual(['now']);
			expect(started[0].steps.find((step) => step.nodeId === 'all')).toMatchObject({
				state: 'parked',
				missingEdges: ['wait:out>all'],
			});

			clock.advanceSeconds(60);
			await flush();

			expect(harness.calls).toEqual(['now', 'off']);
			expect(ended.map((record) => record.status)).toEqual(['completed']);
		});

		it('restart cancels a run held at an All and marks the held token in its trace', async () => {
			await engine.load(automation(joined, { mode: 'restart' }));
			await fire();

			clock.advanceSeconds(30);
			await fire();

			expect(ended[0]).toMatchObject({ status: 'cancelled', endReason: 'restarted' });
			expect(ended[0].steps.filter((step) => step.nodeId === 'all')).toEqual([
				expect.objectContaining({ state: 'cancelled', missingEdges: ['wait:out>all'] }),
			]);

			// What arrived in the cancelled run does not count in the new one
			clock.advanceSeconds(30);
			await flush();

			expect(harness.calls).toEqual(['now', 'now']);

			clock.advanceSeconds(30);
			await flush();

			expect(harness.calls).toEqual(['now', 'now', 'off']);
			expect(ended.map((record) => record.status)).toEqual(['cancelled', 'completed']);
		});

		it('an Any continues once per run, and again in the next run', async () => {
			await engine.load(
				automation(
					graph(
						[
							node('t', ENGINE_TRIGGER_TYPE),
							node('a', ENGINE_ACTION_TYPE),
							node('b', ENGINE_ACTION_TYPE),
							node('any', ANY_NODE_TYPE),
							node('on', ENGINE_ACTION_TYPE),
						],
						['t:out>a', 't:out>b', 'a:done>any', 'b:done>any', 'any:out>on'],
					),
				),
			);

			await fire();
			await fire();

			expect(harness.calls).toEqual(['a', 'b', 'on', 'a', 'b', 'on']);
			expect(settled[1].steps.filter((step) => step.nodeId === 'any').map((step) => step.absorbed === true)).toEqual([
				false,
				true,
			]);
		});

		it('refuses an All fed from two different triggers', async () => {
			const twoTriggers = graph(
				[
					node('t1', ENGINE_TRIGGER_TYPE, { key: 'one' }),
					node('t2', ENGINE_TRIGGER_TYPE, { key: 'two' }),
					node('all', ALL_NODE_TYPE),
					node('on', ENGINE_ACTION_TYPE),
				],
				['t1:out>all', 't2:out>all', 'all:out>on'],
			);

			expect(await engine.load(automation(twoTriggers))).toMatchObject({
				status: 'invalid',
				problems: [{ code: 'join_never_completes', node_id: 'all' }],
			});
		});

		describe('Wait until', () => {
			let tracker: StateTracker;
			let holdValue: () => void;

			/** trigger → Wait until the property is true (30 s) → on; timeout → late */
			const waiting = graph(
				[
					node('t', ENGINE_TRIGGER_TYPE),
					node('wait', WAIT_UNTIL_NODE_TYPE, { ...target(PROPERTY_BOOL), to: true, timeout_seconds: 30 }),
					node('on', ENGINE_ACTION_TYPE),
					node('late', ENGINE_ACTION_TYPE),
				],
				['t:out>wait', 'wait:out>on', 'wait:timeout>late'],
			);

			const waitStep = (record: RunRecord) => record.steps.find((step) => step.nodeId === 'wait');

			beforeEach(() => {
				tracker = new StateTracker(clock);
				harness.register(
					createWaitUntilNodeType({
						tracker: {
							watch: (spec, callback) => tracker.watch(spec, callback),
							read: (propertyId) => tracker.read(propertyId),
							settled: () => Promise.resolve(),
						},
						findProperty: fixtureFindProperty,
					}),
				);

				// What the engine adapter does for a referenced property
				holdValue = tracker.reference(PROPERTY_BOOL);
				tracker.seed(PROPERTY_BOOL, { value: false });
			});

			afterEach(() => holdValue());

			it('parks the run, writes the marker, and resumes when the value reaches the state', async () => {
				expect(await engine.load(automation(waiting))).toMatchObject({ status: 'ok' });
				expect(held).toContain(`property:${PROPERTY_BOOL}`);

				await fire();

				expect(parked).toHaveLength(1);
				expect(waitStep(started[0])).toMatchObject({ state: 'parked', timeoutMs: 30_000, observed: false });

				clock.advanceSeconds(10);
				tracker.report(PROPERTY_BOOL, { value: true });
				await flush();

				expect(harness.calls).toEqual(['on']);
				expect(waitStep(ended[0])).toMatchObject({ state: 'done', output: 'out', observed: true });
				expect(tracker.trackedCount()).toBe(1);
			});

			it('passes at once when the state already holds', async () => {
				tracker.report(PROPERTY_BOOL, { value: true });

				await engine.load(automation(waiting));
				await fire();

				expect(parked).toHaveLength(0);
				expect(harness.calls).toEqual(['on']);
				expect(waitStep(ended[0])).toMatchObject({ output: 'out', reason: 'The state already held.' });
			});

			it('takes the timeout output when the value does not get there in time', async () => {
				await engine.load(automation(waiting));
				await fire();

				clock.advanceSeconds(30);
				await flush();

				expect(harness.calls).toEqual(['late']);
				expect(waitStep(ended[0])).toMatchObject({ output: 'timeout', timedOut: true });

				tracker.report(PROPERTY_BOOL, { value: true });
				await flush();

				expect(harness.calls).toEqual(['late']);
			});

			it('restart cancels a waiting run, lets go of its watch and marks it in the trace', async () => {
				await engine.load(automation(waiting, { mode: 'restart' }));
				await fire();
				await fire();

				expect(ended[0]).toMatchObject({ status: 'cancelled', endReason: 'restarted' });
				expect(waitStep(ended[0])?.state).toBe('cancelled');

				tracker.report(PROPERTY_BOOL, { value: true });
				await flush();

				// Only the new run went on
				expect(harness.calls).toEqual(['on']);
				expect(ended.map((record) => record.status)).toEqual(['cancelled', 'completed']);
			});
		});
	});
});

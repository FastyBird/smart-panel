import { AutomationActionResult, AutomationRunContext } from '../graph/node-type';
import { flush } from '../testing/engine-harness';
import { FakeTrackerClock } from '../testing/fake-tracker-clock';

import {
	RunGate,
	RunPlan,
	RunPlanActionNode,
	RunPlanConditionNode,
	RunPlanGatedNode,
	RunPlanNode,
	RunRecord,
	RunStep,
	RunWalker,
	runPlanPortKey,
} from './run-walker';

interface Behaviour {
	result?: boolean;
	fail?: boolean;
	throws?: boolean;
	hang?: boolean;
	latencyMs?: number;
	observed?: unknown;
	timeoutMs?: number;
	garbage?: boolean;
}

describe('RunWalker', () => {
	let clock: FakeTrackerClock;
	let wall: number;
	let calls: string[];
	let contexts: Map<string, AutomationRunContext>;
	let events: string[];

	beforeEach(() => {
		clock = new FakeTrackerClock();
		wall = 1_700_000_000_000;
		calls = [];
		contexts = new Map();
		events = [];
	});

	const answer = <T>(id: string, behaviour: Behaviour, context: AutomationRunContext, value: T): Promise<T> => {
		calls.push(id);
		contexts.set(id, context);

		if (behaviour.throws) return Promise.reject(new Error(`${id} broke`));
		if (behaviour.hang) return new Promise<T>(() => undefined);
		if (behaviour.garbage) return Promise.resolve(undefined as T);

		if (behaviour.latencyMs !== undefined) {
			return new Promise<T>((resolve) => {
				clock.setTimeout(() => resolve(value), behaviour.latencyMs ?? 0);
			});
		}

		return Promise.resolve(value);
	};

	const trigger = (id: string): RunPlanNode => ({ id, type: 'test.trigger', kind: 'trigger', config: {} });

	const condition = (id: string, behaviour: Behaviour = {}): RunPlanConditionNode => ({
		id,
		type: 'test.condition',
		kind: 'condition',
		config: {},
		timeoutMs: behaviour.timeoutMs ?? 30_000,
		evaluate: (context) =>
			answer(id, behaviour, context, {
				result: behaviour.result ?? true,
				...(behaviour.observed !== undefined ? { observed: behaviour.observed } : {}),
			}),
	});

	const action = (id: string, behaviour: Behaviour = {}): RunPlanActionNode => ({
		id,
		type: 'test.action',
		kind: 'action',
		config: {},
		timeoutMs: behaviour.timeoutMs ?? 30_000,
		execute: (context) =>
			answer(
				id,
				behaviour,
				context,
				behaviour.fail ? { success: false, reason: 'the device refused' } : { success: true },
			),
	});

	const delay = (id: string, delayMs: number): RunPlanNode => ({
		id,
		type: 'flow.delay',
		kind: 'flow',
		flow: 'delay',
		config: {},
		delayMs,
	});

	/** Edges are written `source:port>target` and keep their order */
	const plan = (nodes: RunPlanNode[], edges: string[]): RunPlan => {
		const result: RunPlan = { nodes: new Map(nodes.map((item) => [item.id, item])), outgoing: new Map() };

		for (const spec of edges) {
			const [from, target] = spec.split('>');
			const [source, sourcePort] = from.split(':');
			const key = runPlanPortKey(source, sourcePort);

			result.outgoing.set(key, [...(result.outgoing.get(key) ?? []), { id: spec, source, sourcePort, target }]);
		}

		return result;
	};

	const walk = (
		runPlan: RunPlan,
		options: {
			beforeExecute?: (node: RunPlanGatedNode) => RunGate;
			checkAction?: (node: RunPlanActionNode) => RunGate | PromiseLike<RunGate>;
			maxSteps?: number;
		} = {},
	): RunWalker =>
		new RunWalker({
			plan: runPlan,
			clock,
			wallNow: () => wall,
			runId: 'run-1',
			automationId: 'automation-1',
			revision: 3,
			trigger: { nodeId: 't', data: { to: true }, manual: false },
			observer: {
				parked: () => events.push('parked'),
				ended: (record: RunRecord) => events.push(`ended:${record.status}`),
				settled: () => events.push('settled'),
			},
			...options,
		});

	const stepOf = (walker: RunWalker, nodeId: string): RunStep => {
		const found = walker.record.steps.find((step) => step.nodeId === nodeId);

		if (!found) throw new Error(`no step for ${nodeId}`);

		return found;
	};

	it('a trigger with nothing behind it completes at once', () => {
		const walker = walk(plan([trigger('t')], []));

		walker.start();

		expect(walker.record).toMatchObject({ status: 'completed', steps: [], durationMs: 0 });
		expect(events).toEqual(['ended:completed', 'settled']);
		expect(walker.active).toBe(false);
	});

	it('runs every edge leaving one output, started in the order of the edges', async () => {
		const walker = walk(plan([trigger('t'), action('a'), action('b'), action('c')], ['t:out>b', 't:out>a', 't:out>c']));

		walker.start();

		// The actions were called before anything was awaited
		expect(calls).toEqual(['b', 'a', 'c']);
		expect(walker.active).toBe(true);

		await flush();

		expect(walker.record.status).toBe('completed');
		expect(events).toEqual(['ended:completed', 'settled']);
	});

	it('starts an action in the same tick when its check answers at once', async () => {
		const walker = walk(plan([trigger('t'), action('a'), action('b')], ['t:out>a', 't:out>b']), {
			checkAction: () => ({ allow: true }),
		});

		walker.start();

		// The actions were called before anything was awaited
		expect(calls).toEqual(['a', 'b']);

		await flush();

		expect(walker.record.status).toBe('completed');
	});

	it('parallel branches interleave: the order of completion follows the latency, not the edges', async () => {
		const walker = walk(
			plan(
				[
					trigger('t'),
					action('slow', { latencyMs: 500 }),
					action('fast', { latencyMs: 100 }),
					action('after-slow'),
					action('after-fast'),
				],
				['t:out>slow', 't:out>fast', 'slow:done>after-slow', 'fast:done>after-fast'],
			),
		);

		walker.start();
		clock.advance(100);
		await flush();
		clock.advance(400);
		await flush();

		expect(calls).toEqual(['slow', 'fast', 'after-fast', 'after-slow']);
		expect(walker.record.status).toBe('completed');
	});

	it('a condition continues on yes or no and the trace records what it saw', async () => {
		const walker = walk(
			plan(
				[
					trigger('t'),
					condition('dark', { observed: 12 }),
					condition('home', { result: false }),
					action('on'),
					action('off'),
					action('never'),
				],
				['t:out>dark', 'dark:yes>home', 'dark:no>never', 'home:yes>never', 'home:no>off', 'dark:yes>on'],
			),
		);

		walker.start();
		await flush();

		expect(calls).toEqual(['dark', 'home', 'on', 'off']);
		expect(stepOf(walker, 'dark')).toMatchObject({
			seq: 1,
			kind: 'condition',
			type: 'test.condition',
			via: 't:out>dark',
			state: 'done',
			output: 'yes',
			observed: 12,
		});
		expect(stepOf(walker, 'home')).toMatchObject({ output: 'no', via: 'dark:yes>home' });
		expect(stepOf(walker, 'on')).toMatchObject({ kind: 'action', output: 'done', result: { success: true } });
		expect(walker.record.status).toBe('completed');
	});

	it('an action continues on done or error; one that fails or throws takes error', async () => {
		const walker = walk(
			plan(
				[
					trigger('t'),
					action('ok'),
					action('refuses', { fail: true }),
					action('throws', { throws: true }),
					action('after-ok'),
					action('handler-1'),
					action('handler-2'),
					action('never'),
				],
				[
					't:out>ok',
					't:out>refuses',
					't:out>throws',
					'ok:done>after-ok',
					'ok:error>never',
					'refuses:error>handler-1',
					'refuses:done>never',
					'throws:error>handler-2',
				],
			),
		);

		walker.start();
		await flush();

		expect(calls.sort()).toEqual(['after-ok', 'handler-1', 'handler-2', 'ok', 'refuses', 'throws']);
		expect(stepOf(walker, 'refuses')).toMatchObject({
			output: 'error',
			result: { success: false, reason: 'the device refused' },
			reason: 'the device refused',
		});
		expect(stepOf(walker, 'throws')).toMatchObject({
			output: 'error',
			result: { success: false, reason: 'throws broke' },
		});
		// Every error was handled by an edge
		expect(walker.record.status).toBe('completed');
	});

	it('keeps the refusal an action reports for itself, and only for an action that did nothing', async () => {
		const reporting = (id: string, result: unknown): RunPlanActionNode => ({
			...action(id),
			execute: () => Promise.resolve(result as AutomationActionResult),
		});
		const walker = walk(
			plan(
				[
					trigger('t'),
					reporting('inner', { success: false, reason: 'the scene was refused', refused: true }),
					reporting('lying', { success: true, refused: true }),
					action('handler'),
				],
				['t:out>inner', 't:out>lying', 'inner:error>handler'],
			),
		);

		walker.start();
		await flush();

		expect(stepOf(walker, 'inner')).toMatchObject({
			output: 'error',
			refused: true,
			reason: 'the scene was refused',
			result: { success: false, refused: true },
		});
		expect(stepOf(walker, 'lying')).toMatchObject({ output: 'done', result: { success: true } });
		expect(stepOf(walker, 'lying').refused).toBeUndefined();
		expect(stepOf(walker, 'lying').result).not.toHaveProperty('refused');
		expect(calls).toContain('handler');
	});

	it('an error output with no edge ends that token and fails the run; other branches continue', async () => {
		const walker = walk(
			plan(
				[trigger('t'), action('breaks', { fail: true }), action('fine'), action('after-fine')],
				['t:out>breaks', 't:out>fine', 'fine:done>after-fine'],
			),
		);

		walker.start();
		await flush();

		expect(calls).toEqual(['breaks', 'fine', 'after-fine']);
		expect(walker.record.status).toBe('failed');
		expect(events).toEqual(['ended:failed', 'settled']);
	});

	it('two edges into one node execute it once per arriving token', async () => {
		const walker = walk(
			plan(
				[trigger('t'), action('a'), action('b'), action('both')],
				['t:out>a', 't:out>b', 'a:done>both', 'b:done>both'],
			),
		);

		walker.start();
		await flush();

		expect(calls.filter((name) => name === 'both')).toHaveLength(2);
		expect(walker.record.steps.filter((step) => step.nodeId === 'both').map((step) => step.via)).toEqual([
			'a:done>both',
			'b:done>both',
		]);
	});

	it('a condition that throws evaluates to no and records why', async () => {
		const walker = walk(
			plan(
				[trigger('t'), condition('c', { throws: true }), action('yes'), action('no')],
				['t:out>c', 'c:yes>yes', 'c:no>no'],
			),
		);

		walker.start();
		await flush();

		expect(calls).toEqual(['c', 'no']);
		expect(stepOf(walker, 'c')).toMatchObject({ output: 'no', reason: 'The condition failed: c broke' });
		expect(walker.record.status).toBe('completed');
	});

	it('a condition that does not answer in time evaluates to no', async () => {
		const walker = walk(
			plan(
				[trigger('t'), condition('c', { hang: true, timeoutMs: 5000 }), action('yes'), action('no')],
				['t:out>c', 'c:yes>yes', 'c:no>no'],
			),
		);

		walker.start();
		clock.advance(4999);
		await flush();

		expect(walker.record.steps).toHaveLength(0);

		clock.advance(1);
		await flush();

		expect(calls).toEqual(['c', 'no']);
		expect(stepOf(walker, 'c')).toMatchObject({
			output: 'no',
			timedOut: true,
			reason: 'The condition did not answer within 5 s.',
		});
		expect(contexts.get('c')?.signal.aborted).toBe(true);
	});

	it('an action that does not finish in time takes error, so a hung device call cannot hold a run open', async () => {
		const walker = walk(
			plan([trigger('t'), action('hangs', { hang: true }), action('handler')], ['t:out>hangs', 'hangs:error>handler']),
		);

		walker.start();
		await flush();

		expect(walker.active).toBe(true);
		expect(clock.pending()).toBe(1);

		clock.advance(30_000);
		await flush();

		expect(stepOf(walker, 'hangs')).toMatchObject({ output: 'error', timedOut: true, result: { success: false } });
		expect(contexts.get('hangs')?.signal.aborted).toBe(true);
		expect(calls).toEqual(['hangs', 'handler']);
		expect(walker.record.status).toBe('completed');
		expect(clock.pending()).toBe(0);
	});

	it('an answer that arrives after the timeout is ignored', async () => {
		const walker = walk(
			plan(
				[trigger('t'), action('late', { latencyMs: 2000, timeoutMs: 1000 }), action('done'), action('error')],
				['t:out>late', 'late:done>done', 'late:error>error'],
			),
		);

		walker.start();
		clock.advance(1000);
		await flush();
		clock.advance(1000);
		await flush();

		expect(calls).toEqual(['late', 'error']);
		expect(walker.record.steps.filter((step) => step.nodeId === 'late')).toHaveLength(1);
	});

	it('a handler that returns nothing is a failure, not a success', async () => {
		const walker = walk(
			plan(
				[trigger('t'), condition('c', { garbage: true }), action('a', { garbage: true }), action('no')],
				['t:out>c', 't:out>a', 'c:no>no'],
			),
		);

		walker.start();
		await flush();

		expect(stepOf(walker, 'c')).toMatchObject({ output: 'no' });
		expect(stepOf(walker, 'a')).toMatchObject({ output: 'error' });
		expect(walker.record.status).toBe('failed');
	});

	it('gives every node its run, its node id and what triggered the run', async () => {
		const walker = walk(plan([trigger('t'), action('a')], ['t:out>a']));

		walker.start();
		await flush();

		expect(contexts.get('a')).toMatchObject({
			automationId: 'automation-1',
			runId: 'run-1',
			nodeId: 'a',
			trigger: { nodeId: 't', data: { to: true }, manual: false },
		});
		expect(contexts.get('a')?.signal.aborted).toBe(false);
	});

	describe('Delay', () => {
		it('parks the token; the run stays active until the timer fires', async () => {
			const walker = walk(plan([trigger('t'), delay('wait', 120_000), action('off')], ['t:out>wait', 'wait:out>off']));

			walker.start();
			await flush();

			expect(events).toEqual(['parked']);
			expect(stepOf(walker, 'wait')).toMatchObject({ kind: 'flow', state: 'parked', delayMs: 120_000 });
			expect(walker.active).toBe(true);

			clock.advance(119_999);
			await flush();

			expect(calls).toEqual([]);

			clock.advance(1);
			await flush();

			expect(stepOf(walker, 'wait')).toMatchObject({ state: 'done', output: 'out' });
			expect(calls).toEqual(['off']);
			expect(walker.record).toMatchObject({ status: 'completed', durationMs: 120_000 });
			expect(events).toEqual(['parked', 'ended:completed', 'settled']);
		});

		it('reports every park, so the latest one says where the run waits', async () => {
			const parkedOn: string[] = [];
			const walker = new RunWalker({
				plan: plan([trigger('t'), delay('one', 10), delay('two', 20)], ['t:out>one', 'one:out>two']),
				clock,
				wallNow: () => wall,
				runId: 'run-1',
				automationId: 'automation-1',
				revision: 3,
				trigger: { nodeId: 't', data: {}, manual: false },
				observer: {
					parked: (record: RunRecord) =>
						parkedOn.push(
							record.steps
								.filter((item) => item.state === 'parked')
								.map((item) => item.nodeId)
								.join(),
						),
				},
			});

			walker.start();
			await flush();

			expect(parkedOn).toEqual(['one']);

			clock.advance(10);
			await flush();

			expect(parkedOn).toEqual(['one', 'two']);

			clock.advance(20);
			await flush();

			expect(parkedOn).toEqual(['one', 'two']);
			expect(walker.record.status).toBe('completed');
		});

		it('runs on the monotonic clock: a jump of the wall clock moves neither the delay nor the measured time', async () => {
			const walker = walk(plan([trigger('t'), delay('wait', 60_000), action('off')], ['t:out>wait', 'wait:out>off']));

			walker.start();
			await flush();

			// NTP steps in on a board without a real-time clock
			wall += 3 * 365 * 24 * 60 * 60 * 1000;

			clock.advance(59_999);
			await flush();

			expect(calls).toEqual([]);

			clock.advance(1);
			await flush();

			expect(calls).toEqual(['off']);
			expect(stepOf(walker, 'off').elapsedMs).toBe(60_000);
			expect(walker.record.durationMs).toBe(60_000);
		});
	});

	describe('cancelling', () => {
		it('ends the run at once and drops a parked delay', async () => {
			const walker = walk(plan([trigger('t'), delay('wait', 120_000), action('off')], ['t:out>wait', 'wait:out>off']));

			walker.start();
			await flush();

			walker.cancel('restarted');

			expect(walker.record).toMatchObject({ status: 'cancelled', endReason: 'restarted' });
			expect(walker.active).toBe(false);
			expect(clock.pending()).toBe(0);

			await flush();

			expect(stepOf(walker, 'wait').state).toBe('cancelled');
			expect(events).toEqual(['parked', 'ended:cancelled', 'settled']);

			clock.advance(200_000);
			await flush();

			expect(calls).toEqual([]);
		});

		it('an action already executing is not recalled: its result is traced and its output is not followed', async () => {
			const walker = walk(
				plan([trigger('t'), action('write', { latencyMs: 500 }), action('next')], ['t:out>write', 'write:done>next']),
			);

			walker.start();
			await flush();

			walker.cancel('restarted');

			expect(events).toEqual(['ended:cancelled']);
			expect(walker.settled).toBe(false);
			expect(contexts.get('write')?.signal.aborted).toBe(true);

			clock.advance(500);
			await flush();

			expect(stepOf(walker, 'write')).toMatchObject({ output: 'done', result: { success: true }, afterCancel: true });
			expect(calls).toEqual(['write']);
			expect(walker.record.status).toBe('cancelled');
			expect(events).toEqual(['ended:cancelled', 'settled']);
		});

		it('a cancelled run always settles: a node that never answers is cut off by its timeout', async () => {
			const walker = walk(plan([trigger('t'), action('hangs', { hang: true })], ['t:out>hangs']));

			walker.start();
			await flush();
			walker.cancel('automation_updated');
			await flush();

			expect(walker.settled).toBe(false);

			clock.advance(30_000);
			await flush();

			expect(walker.settled).toBe(true);
			expect(stepOf(walker, 'hangs')).toMatchObject({ timedOut: true, afterCancel: true });
			expect(walker.record.status).toBe('cancelled');
		});

		it('ends as interrupted when the engine itself stops', async () => {
			const walker = walk(plan([trigger('t'), delay('wait', 1000)], ['t:out>wait']));

			walker.start();
			await flush();
			walker.cancel('engine_stopped', 'interrupted');

			expect(walker.record).toMatchObject({ status: 'interrupted', endReason: 'engine_stopped' });
		});

		it('does nothing to a run that has ended', async () => {
			const walker = walk(plan([trigger('t'), action('a')], ['t:out>a']));

			walker.start();
			await flush();
			walker.cancel('restarted');

			expect(walker.record.status).toBe('completed');
			expect(walker.record.endReason).toBeUndefined();
			expect(events).toEqual(['ended:completed', 'settled']);
		});
	});

	describe('gate', () => {
		const refuse = (node: RunPlanGatedNode): RunGate =>
			node.id.startsWith('blocked')
				? { allow: false, reason: 'The plugin this block belongs to is disabled.' }
				: { allow: true };

		it('a refused action is not executed and takes error', async () => {
			const walker = walk(
				plan(
					[trigger('t'), action('blocked'), action('handler'), action('never')],
					['t:out>blocked', 'blocked:error>handler', 'blocked:done>never'],
				),
				{ beforeExecute: refuse },
			);

			walker.start();
			await flush();

			expect(calls).toEqual(['handler']);
			expect(stepOf(walker, 'blocked')).toMatchObject({
				output: 'error',
				refused: true,
				result: { success: false, reason: 'The plugin this block belongs to is disabled.' },
			});
		});

		it('a refused condition is not asked and evaluates to no', async () => {
			const walker = walk(
				plan(
					[trigger('t'), condition('blocked'), action('yes'), action('no')],
					['t:out>blocked', 'blocked:yes>yes', 'blocked:no>no'],
				),
				{ beforeExecute: refuse },
			);

			walker.start();
			await flush();

			expect(calls).toEqual(['no']);
			expect(stepOf(walker, 'blocked')).toMatchObject({ output: 'no', refused: true });
		});

		it('a refused delay parks nothing: its token ends and the run fails, other branches continue', async () => {
			const walker = walk(
				plan(
					[trigger('t'), delay('blocked', 60_000), action('never'), action('other')],
					['t:out>blocked', 'blocked:out>never', 't:out>other'],
				),
				{ beforeExecute: refuse },
			);

			walker.start();
			await flush();
			clock.advance(60_000);
			await flush();

			expect(calls).toEqual(['other']);
			expect(events).toEqual(['ended:failed', 'settled']);

			const step = stepOf(walker, 'blocked');

			expect(step).toMatchObject({
				kind: 'flow',
				state: 'done',
				refused: true,
				reason: 'The plugin this block belongs to is disabled.',
			});
			expect(step.output).toBeUndefined();
		});
	});

	describe('action check', () => {
		const graphOf = (first: RunPlanActionNode = action('unlock')): RunPlan =>
			plan(
				[trigger('t'), condition('c'), first, action('handler'), action('never'), action('light')],
				['t:out>c', 'c:yes>unlock', 'unlock:error>handler', 'unlock:done>never', 'c:yes>light'],
			);

		const refuseUnlock = (node: RunPlanActionNode): RunGate =>
			node.id === 'unlock' ? { allow: false, reason: 'An automation can not unlock a lock.' } : { allow: true };

		it('is asked for actions only; a refused action is not executed, takes error and is traced as refused', async () => {
			const asked: string[] = [];

			const walker = walk(graphOf(), {
				checkAction: (node) => {
					asked.push(node.id);

					return refuseUnlock(node);
				},
			});

			walker.start();
			await flush();

			expect(asked.sort()).toEqual(['handler', 'light', 'unlock']);
			expect(calls.sort()).toEqual(['c', 'handler', 'light']);
			expect(stepOf(walker, 'unlock')).toMatchObject({
				output: 'error',
				refused: true,
				reason: 'An automation can not unlock a lock.',
				result: { success: false, reason: 'An automation can not unlock a lock.' },
			});
			expect(events).toEqual(['ended:completed', 'settled']);
		});

		it('a refusal nothing handles fails the run', async () => {
			const walker = walk(plan([trigger('t'), action('unlock')], ['t:out>unlock']), { checkAction: refuseUnlock });

			walker.start();
			await flush();

			expect(calls).toEqual([]);
			expect(events).toEqual(['ended:failed', 'settled']);
		});

		it('waits for a check that takes its time', async () => {
			const walker = walk(graphOf(), {
				checkAction: (node) =>
					new Promise<RunGate>((resolve) => {
						clock.setTimeout(() => resolve(refuseUnlock(node)), 50);
					}),
			});

			walker.start();
			await flush();

			expect(calls).toEqual(['c']);
			expect(walker.active).toBe(true);

			clock.advance(50);
			await flush();
			clock.advance(50);
			await flush();

			expect(calls.sort()).toEqual(['c', 'handler', 'light']);
			expect(stepOf(walker, 'unlock')).toMatchObject({ output: 'error', refused: true });
			expect(events).toEqual(['ended:completed', 'settled']);
			expect(clock.pending()).toBe(0);
		});

		it.each([
			[
				'throws',
				(): RunGate => {
					throw new Error('check broke');
				},
			],
			['rejects', (): Promise<RunGate> => Promise.reject(new Error('check broke'))],
			['answers nothing', (): RunGate => undefined as unknown as RunGate],
			['answers something else', (): Promise<RunGate> => Promise.resolve({ allow: 'yes' } as unknown as RunGate)],
		])('a check that %s lets nothing through', async (_name, checkAction) => {
			const walker = walk(plan([trigger('t'), action('a')], ['t:out>a']), { checkAction });

			walker.start();
			await flush();

			expect(calls).toEqual([]);
			expect(stepOf(walker, 'a')).toMatchObject({
				output: 'error',
				refused: true,
				reason: 'The action could not be checked, so it was not executed.',
			});
		});

		it('a check that never answers is held to the timeout of the action and refuses', async () => {
			const walker = walk(plan([trigger('t'), action('a', { timeoutMs: 2_000 })], ['t:out>a']), {
				checkAction: () => new Promise<RunGate>(() => undefined),
			});

			walker.start();
			await flush();
			clock.advance(2_000);
			await flush();

			expect(calls).toEqual([]);
			expect(stepOf(walker, 'a')).toMatchObject({
				output: 'error',
				refused: true,
				reason: 'The action could not be checked within 2 s.',
			});
			expect(events).toEqual(['ended:failed', 'settled']);
		});

		it('an action whose run was cancelled while it was being checked is not executed', async () => {
			let answer: (gate: RunGate) => void = () => undefined;

			const walker = walk(plan([trigger('t'), action('a')], ['t:out>a']), {
				checkAction: () =>
					new Promise<RunGate>((resolve) => {
						answer = resolve;
					}),
			});

			walker.start();
			await flush();

			walker.cancel('restarted');
			await flush();

			answer({ allow: true });
			await flush();

			expect(calls).toEqual([]);
			expect(stepOf(walker, 'a')).toMatchObject({ state: 'cancelled' });
			expect(stepOf(walker, 'a').output).toBeUndefined();
			expect(events).toEqual(['ended:cancelled', 'settled']);
			expect(clock.pending()).toBe(0);
		});

		it('is not asked for an action the gate already refused', async () => {
			const checkAction = jest.fn((): RunGate => ({ allow: true }));

			const walker = walk(plan([trigger('t'), action('blocked')], ['t:out>blocked']), {
				beforeExecute: () => ({ allow: false, reason: 'The plugin this block belongs to is disabled.' }),
				checkAction,
			});

			walker.start();
			await flush();

			expect(checkAction).not.toHaveBeenCalled();
			expect(stepOf(walker, 'blocked')).toMatchObject({ refused: true });
		});

		it('asks the gate again after the check: an action refused while it was being checked is not executed', async () => {
			let enabled = true;
			let answer: (gate: RunGate) => void = () => undefined;

			const walker = walk(plan([trigger('t'), action('a'), action('handler')], ['t:out>a', 'a:error>handler']), {
				beforeExecute: (node) =>
					enabled || node.id !== 'a'
						? { allow: true }
						: { allow: false, reason: 'The plugin this block belongs to is disabled.' },
				checkAction: (node) =>
					node.id === 'a'
						? new Promise<RunGate>((resolve) => {
								answer = resolve;
							})
						: { allow: true },
			});

			walker.start();
			await flush();

			enabled = false;
			answer({ allow: true });
			await flush();

			expect(calls).toEqual(['handler']);
			expect(stepOf(walker, 'a')).toMatchObject({
				output: 'error',
				refused: true,
				reason: 'The plugin this block belongs to is disabled.',
			});
			expect(events).toEqual(['ended:completed', 'settled']);
		});

		it('a check whose answer can not be read lets nothing through and the action takes error', async () => {
			const broken = Object.defineProperty({ allow: true }, 'then', {
				get: () => {
					throw new Error('then broke');
				},
			}) as RunGate;

			const walker = walk(plan([trigger('t'), action('a'), action('handler')], ['t:out>a', 'a:error>handler']), {
				checkAction: (node) => (node.id === 'a' ? broken : { allow: true }),
			});

			walker.start();
			await flush();

			expect(calls).toEqual(['handler']);
			expect(stepOf(walker, 'a')).toMatchObject({
				output: 'error',
				refused: true,
				reason: 'The action could not be checked, so it was not executed.',
			});
			expect(events).toEqual(['ended:completed', 'settled']);
		});

		it.each([
			['at once', (verdict: RunGate): RunGate => verdict],
			['later', (verdict: RunGate): Promise<RunGate> => Promise.resolve(verdict)],
		])('a verdict that can not be read, answered %s, lets nothing through', async (_label, answer) => {
			const broken = Object.defineProperty({}, 'allow', {
				get: () => {
					throw new Error('allow broke');
				},
			}) as RunGate;

			const walker = walk(plan([trigger('t'), action('a'), action('handler')], ['t:out>a', 'a:error>handler']), {
				checkAction: (node) => (node.id === 'a' ? answer(broken) : { allow: true }),
			});

			walker.start();
			await flush();

			expect(calls).toEqual(['handler']);
			expect(stepOf(walker, 'a')).toMatchObject({
				output: 'error',
				refused: true,
				reason: 'The action could not be checked, so it was not executed.',
			});
			expect(events).toEqual(['ended:completed', 'settled']);
		});
	});

	it('stops a run whose tokens multiply beyond the step limit', async () => {
		// Each layer doubles the tokens: two edges into every node
		const nodes: RunPlanNode[] = [trigger('t')];
		const edges: string[] = ['t:out>n0', 't:out>n0'];

		for (let layer = 0; layer < 12; layer += 1) {
			nodes.push(action(`n${layer}`));

			if (layer > 0) {
				edges.push(`n${layer - 1}:done>n${layer}`, `n${layer - 1}:error>n${layer}`);
			}
		}

		// Both outputs lead on, but only one is taken; double the edges of the taken one instead
		const doubled = edges.flatMap((spec) => (spec.includes(':done>') ? [spec, spec] : [spec]));
		const walker = walk(plan(nodes, doubled), { maxSteps: 50 });

		walker.start();
		await flush();
		await flush();

		expect(walker.record.status).toBe('failed');
		expect(walker.record.endReason).toBe('The run was stopped after 50 steps.');
		expect(walker.settled).toBe(true);
		expect(walker.record.steps.length).toBeLessThan(200);
	});

	it('counts a step for every token it admits, so a node past the limit is never executed', async () => {
		// Two nodes a layer, each leading to both of the next: 2 + 4 + ... + 512 = 1,022 tokens over nine
		// layers. The last layer has nothing behind it, so nothing follows the step that reaches the limit.
		const nodes: RunPlanNode[] = [trigger('t')];
		const edges: string[] = ['t:out>a0', 't:out>b0'];

		for (let layer = 0; layer < 9; layer += 1) {
			nodes.push(action(`a${layer}`), action(`b${layer}`));

			if (layer > 0) {
				for (const source of ['a', 'b']) {
					edges.push(`${source}${layer - 1}:done>a${layer}`, `${source}${layer - 1}:done>b${layer}`);
				}
			}
		}

		const walker = walk(plan(nodes, edges));

		walker.start();
		await flush();
		await flush();

		expect(walker.record.status).toBe('failed');
		expect(walker.record.endReason).toBe('The run was stopped after 1000 steps.');
		expect(calls).toHaveLength(1000);
		expect(walker.settled).toBe(true);
	});

	it('a run that needs exactly the step limit completes', async () => {
		const walker = walk(
			plan([trigger('t'), action('a'), action('b'), action('c')], ['t:out>a', 'a:done>b', 'b:done>c']),
			{ maxSteps: 3 },
		);

		walker.start();
		await flush();

		expect(calls).toEqual(['a', 'b', 'c']);
		expect(walker.record.status).toBe('completed');
	});

	describe('step observer', () => {
		let seen: string[];

		const describeStep = (step: RunStep): string =>
			[step.seq, step.nodeId, step.state, step.output ?? '-', ...(step.afterCancel ? ['late'] : [])].join(':');

		const observed = (runPlan: RunPlan, onStep?: (record: RunRecord, step: RunStep) => void): RunWalker =>
			new RunWalker({
				plan: runPlan,
				clock,
				wallNow: () => wall,
				runId: 'run-1',
				automationId: 'automation-1',
				revision: 3,
				trigger: { nodeId: 't', data: {}, manual: true },
				observer: {
					step: (record, step) => {
						events.push(`step:${step.nodeId}`);
						seen.push(describeStep(step));
						onStep?.(record, step);
					},
					parked: () => events.push('parked'),
					ended: (record) => events.push(`ended:${record.status}`),
					settled: () => events.push('settled'),
					error: () => events.push('error'),
				},
			});

		beforeEach(() => {
			seen = [];
		});

		it('reports every node the run reaches, with the output it took, before the run ends', async () => {
			const walker = observed(
				plan(
					[trigger('t'), condition('c', { result: false, observed: 4 }), action('yes'), action('no', { fail: true })],
					['t:out>c', 'c:yes>yes', 'c:no>no'],
				),
			);

			walker.start();
			await flush();

			expect(seen).toEqual(['1:c:done:no', '2:no:done:error']);
			expect(events).toEqual(['step:c', 'step:no', 'ended:failed', 'settled']);
		});

		it('hands over the step of the record itself', async () => {
			const steps: RunStep[] = [];
			const walker = observed(plan([trigger('t'), action('a')], ['t:out>a']), (record, step) => {
				expect(record).toBe(walker.record);
				steps.push(step);
			});

			walker.start();
			await flush();

			expect(steps).toEqual(walker.record.steps);
			expect(steps[0]).toBe(walker.record.steps[0]);
		});

		it('reports a Delay when it parks the run and again when it lets it go on', async () => {
			const walker = observed(plan([trigger('t'), delay('wait', 60_000), action('a')], ['t:out>wait', 'wait:out>a']));

			walker.start();
			await flush();

			expect(seen).toEqual(['1:wait:parked:-']);
			expect(events).toEqual(['step:wait', 'parked']);

			clock.advance(60_000);
			await flush();

			expect(seen).toEqual(['1:wait:parked:-', '1:wait:done:out', '2:a:done:done']);
		});

		it('reports a parked Delay as cancelled when the run is cancelled', async () => {
			const walker = observed(plan([trigger('t'), delay('wait', 60_000), action('a')], ['t:out>wait', 'wait:out>a']));

			walker.start();
			await flush();
			walker.cancel('restarted');
			await flush();

			expect(seen).toEqual(['1:wait:parked:-', '1:wait:cancelled:-']);
			expect(walker.settled).toBe(true);
		});

		it('reports a node that finishes after the run was cancelled as late, once', async () => {
			const walker = observed(
				plan([trigger('t'), action('slow', { latencyMs: 500 }), action('next')], ['t:out>slow', 'slow:done>next']),
			);

			walker.start();
			await flush();
			walker.cancel('restarted');
			clock.advance(500);
			await flush();

			expect(seen).toEqual(['1:slow:done:done:late']);
			expect(stepOf(walker, 'slow').afterCancel).toBe(true);
			expect(calls).toEqual(['slow']);
		});

		it('carries on when the observer throws on a step', async () => {
			const walker = observed(plan([trigger('t'), action('a'), action('b')], ['t:out>a', 'a:done>b']), () => {
				throw new Error('nobody is listening');
			});

			walker.start();
			await flush();

			expect(calls).toEqual(['a', 'b']);
			expect(walker.record.status).toBe('completed');
			expect(events.filter((event) => event === 'error')).toHaveLength(2);
		});
	});
});

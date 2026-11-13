/**
 * The token walk of one automation run (design § Runs, ADR 0003 decision 3).
 *
 * Framework-free (ADR 0003, decision 15): it knows neither the node type registry nor where a run is
 * stored. It is given a compiled plan, a clock and an observer, and it never throws.
 *
 * The rules:
 *
 * - A run starts at one trigger node. A token is put on every edge leaving the output a node took; several
 *   edges from one output run in parallel, started in the order of the edges in the graph document.
 *   Nothing else about their order is guaranteed: branches interleave wherever a node waits.
 * - Two edges into one node execute it once per arriving token.
 * - A condition continues on `yes` or `no`. One that throws or times out evaluates to `no`.
 * - An action continues on `done` or `error`. One that throws, times out or is refused takes `error`. An
 *   `error` output with no edge ends that token and marks the run `failed`; other branches continue.
 * - A Delay parks its token on a timer of the monotonic clock. A refused Delay has no `error` output to
 *   take: its token ends and the run is marked `failed`.
 * - A Wait until passes at once when the awaited state already holds. Otherwise it parks its token until
 *   the event happens (`out`) or its timeout runs out (`timeout`). A refused or failing Wait until ends its
 *   token and fails the run, like a Delay.
 * - Joins keep their state in the run, so nothing of one run reaches the next. An Any continues on the
 *   first token and absorbs every later one. An All holds the tokens that arrived until one has arrived on
 *   every incoming edge, then continues once. A token held at an All does not keep the run open: when
 *   nothing else of the run is left, no branch can arrive any more, the All does not continue and its
 *   steps name the edges that were missing. Either join continues at most once per run.
 * - A run takes a limited number of steps. Every token put on an edge counts, before its node is executed;
 *   the run ends as `failed` when one more would be needed.
 * - The run ends when no token is left: `completed`, or `failed` when an error went unhandled.
 * - A cancelled run ends at once. Parked tokens - on a Delay, a Wait until or an All - are dropped and their
 *   steps are marked `cancelled`. A node already executing cannot be recalled:
 *   its abort signal fires, its result is traced with `afterCancel` when it returns, and its output is not
 *   followed. Every node has a timeout, so a cancelled run always settles.
 *
 * `ended` is reported the moment the outcome of the run is known, `settled` once nothing of it is left
 * executing and its trace is complete. For a run that was not cancelled both come together.
 */
import {
	AutomationActionResult,
	AutomationConditionResult,
	AutomationNodeConfig,
	AutomationNodeKind,
	AutomationRunContext,
	AutomationRunTrigger,
	AutomationWaitEvent,
	AutomationWaitStart,
} from '../graph/node-type';
import { TrackerClock } from '../tracker/clock';

export type RunStatus = 'running' | 'completed' | 'failed' | 'cancelled' | 'interrupted';

export type RunEndStatus = Exclude<RunStatus, 'running'>;

/**
 * The most steps one run may take: tokens put on an edge, each executing one node. A graph that fans in can
 * multiply tokens far beyond its node count.
 */
export const RUN_MAX_STEPS = 1000;

interface RunPlanNodeBase {
	id: string;
	type: string;
	config: AutomationNodeConfig;
}

export interface RunPlanTriggerNode extends RunPlanNodeBase {
	kind: 'trigger';
}

export interface RunPlanConditionNode extends RunPlanNodeBase {
	kind: 'condition';
	timeoutMs: number;
	evaluate(context: AutomationRunContext): Promise<AutomationConditionResult> | AutomationConditionResult;
}

export interface RunPlanActionNode extends RunPlanNodeBase {
	kind: 'action';
	timeoutMs: number;
	execute(context: AutomationRunContext): Promise<AutomationActionResult> | AutomationActionResult;
}

export interface RunPlanDelayNode extends RunPlanNodeBase {
	kind: 'flow';
	flow: 'delay';
	delayMs: number;
}

export interface RunPlanWaitUntilNode extends RunPlanNodeBase {
	kind: 'flow';
	flow: 'wait_until';
	/** How long the token waits at most before it takes `timeout` */
	timeoutMs: number;
	wait(
		resume: (event: AutomationWaitEvent) => void,
		context: AutomationRunContext,
	): Promise<AutomationWaitStart> | AutomationWaitStart;
}

export interface RunPlanJoinNode extends RunPlanNodeBase {
	kind: 'flow';
	flow: 'any' | 'all';
	/** The edges leading into the join, in the order of the graph document */
	incoming: string[];
}

export type RunPlanNode =
	| RunPlanTriggerNode
	| RunPlanConditionNode
	| RunPlanActionNode
	| RunPlanDelayNode
	| RunPlanWaitUntilNode
	| RunPlanJoinNode;

/** The nodes the gate is asked about before they are executed */
export type RunPlanGatedNode = RunPlanConditionNode | RunPlanActionNode | RunPlanDelayNode | RunPlanWaitUntilNode;

export interface RunPlanEdge {
	id: string;
	source: string;
	sourcePort: string;
	target: string;
}

/**
 * A graph prepared for walking: every node with its handler bound to its configuration, and the edges
 * indexed by the output they leave.
 */
export interface RunPlan {
	nodes: Map<string, RunPlanNode>;
	/** Keyed by `runPlanPortKey(nodeId, port)`; the edges keep the order of the graph document */
	outgoing: Map<string, RunPlanEdge[]>;
}

export const runPlanPortKey = (nodeId: string, port: string): string => JSON.stringify([nodeId, port]);

export type RunStepState = 'done' | 'parked' | 'cancelled';

export interface RunStep {
	seq: number;
	/** Wall-clock milliseconds, for display only */
	at: number;
	/** Monotonic milliseconds since the run started */
	elapsedMs: number;
	nodeId: string;
	type: string;
	kind: AutomationNodeKind;
	/** The edge the token arrived on */
	via?: string;
	/**
	 * `parked` while a Delay, a Wait until or an All holds the token, `cancelled` when the run ended around
	 * it - for an All also when the run ended before every branch arrived
	 */
	state: RunStepState;
	/** The output port taken */
	output?: string;
	/** What a condition saw */
	observed?: unknown;
	reason?: string;
	/** What an action answered */
	result?: AutomationActionResult;
	/** The node was not executed: its owner is disabled or a policy refused it */
	refused?: boolean;
	timedOut?: boolean;
	/** The node finished after the run had ended; its output was not followed */
	afterCancel?: boolean;
	/** For a Delay: how long the token was parked for */
	delayMs?: number;
	/** For a Wait until: how long the token waits at most */
	timeoutMs?: number;
	/** For a join: the token arrived after the join had continued in this run and went no further */
	absorbed?: boolean;
	/** For an All that holds the token or did not continue: the incoming edges no token has arrived on */
	missingEdges?: string[];
}

export interface RunRecord {
	id: string;
	automationId: string;
	/** The revision of the automation the run walks */
	revision: number;
	trigger: AutomationRunTrigger;
	/** Wall-clock milliseconds, for display only */
	startedAt: number;
	finishedAt?: number;
	/** Monotonic duration of the run */
	durationMs?: number;
	status: RunStatus;
	/** Why the run ended early, e.g. `restarted` */
	endReason?: string;
	steps: RunStep[];
}

export type RunGate = { allow: true } | { allow: false; reason: string };

export interface RunObserver {
	/**
	 * A step was added to the trace, or a parked step was released: its `state` is then `done` or
	 * `cancelled`. The step is the one in the record and may still change.
	 */
	step?(record: RunRecord, step: RunStep): void;
	/** The run parked a token on a Delay or a Wait until and will outlive the current tick; reported for every park */
	parked?(record: RunRecord): void;
	/** The outcome of the run is known */
	ended?(record: RunRecord): void;
	/** Nothing of the run is executing any more; its trace is complete */
	settled?(record: RunRecord): void;
	/** An observer callback threw */
	error?(error: unknown): void;
}

export interface RunWalkerOptions {
	plan: RunPlan;
	clock: TrackerClock;
	/** Wall-clock milliseconds; used for the timestamps of the trace only */
	wallNow?: () => number;
	runId: string;
	automationId: string;
	revision: number;
	trigger: AutomationRunTrigger;
	/** Asked before every condition, action and delay; a refusal is traced and the node is not executed */
	beforeExecute?: (node: RunPlanGatedNode) => RunGate;
	/**
	 * Asked before every action that `beforeExecute` let through. It may take its time - it may have to
	 * read what the action is about to touch - and it is held to the timeout of the action. A check that
	 * fails or does not answer in time refuses the action.
	 */
	checkAction?: (node: RunPlanActionNode) => RunGate | PromiseLike<RunGate>;
	observer?: RunObserver;
	maxSteps?: number;
}

type Invocation<T> = { type: 'value'; value: T } | { type: 'threw'; error: unknown } | { type: 'timeout' };

type WaitOutcome =
	| { type: 'holds'; observed?: unknown; reason?: string }
	| { type: 'event'; observed?: unknown }
	| { type: 'timeout' }
	| { type: 'cancelled' }
	| { type: 'threw'; error: unknown };

/** What one join knows within one run */
interface JoinState {
	/** The incoming edges a token has arrived on */
	arrived: Set<string>;
	/** Whether the join has continued; it does at most once per run */
	fired: boolean;
	/** The steps of the tokens an All holds */
	held: RunStep[];
}

const describeError = (error: unknown): string => (error instanceof Error ? error.message : 'unknown error');

const ACTION_CHECK_FAILED_REASON = 'The action could not be checked, so it was not executed.';

const describeSeconds = (ms: number): string => `${Math.round(ms / 100) / 10} s`;

export class RunWalker {
	public readonly record: RunRecord;

	private readonly plan: RunPlan;
	private readonly clock: TrackerClock;
	private readonly wallNow: () => number;
	private readonly observer: RunObserver;
	private readonly beforeExecute?: RunWalkerOptions['beforeExecute'];
	private readonly checkAction?: RunWalkerOptions['checkAction'];
	private readonly maxSteps: number;

	private started = false;
	private ended = false;
	private settledReported = false;
	private startedMono = 0;
	private tokens = 0;
	/** Every token ever put on an edge; unlike `seq` it moves before the node of the token is executed */
	private admitted = 0;
	private seq = 0;
	private unhandledErrors = 0;
	private readonly parked = new Set<() => void>();
	private readonly executing = new Set<AbortController>();
	/** Join state belongs to the run, so it can never reach the next one */
	private readonly joins = new Map<string, JoinState>();

	public constructor(options: RunWalkerOptions) {
		this.plan = options.plan;
		this.clock = options.clock;
		this.wallNow = options.wallNow ?? ((): number => Date.now());
		this.observer = options.observer ?? {};
		this.beforeExecute = options.beforeExecute;
		this.checkAction = options.checkAction;
		this.maxSteps = options.maxSteps ?? RUN_MAX_STEPS;

		this.record = {
			id: options.runId,
			automationId: options.automationId,
			revision: options.revision,
			trigger: options.trigger,
			startedAt: this.wallNow(),
			status: 'running',
			steps: [],
		};
	}

	/** Whether the outcome of the run is still open */
	public get active(): boolean {
		return this.started && !this.ended;
	}

	/** Whether nothing of the run is executing any more */
	public get settled(): boolean {
		return this.settledReported;
	}

	public start(): void {
		if (this.started) return;

		this.started = true;
		this.startedMono = this.clock.now();
		this.record.startedAt = this.wallNow();

		this.follow(this.record.trigger.nodeId, 'out');
		this.settle();
	}

	/**
	 * Ends the run now. Does nothing when the run has already ended.
	 *
	 * @param reason why, for the trace, e.g. `restarted`
	 * @param status `cancelled` by default; `interrupted` when the engine itself stops
	 */
	public cancel(reason: string, status: RunEndStatus = 'cancelled'): void {
		if (!this.started || this.ended) return;

		this.releaseJoins();
		this.end(status, reason);

		for (const release of [...this.parked]) release();
		for (const controller of [...this.executing]) controller.abort();

		this.settle();
	}

	/**
	 * Puts one token on every edge leaving `port` and returns the number of edges. The step limit is checked
	 * for every token: a node is executed as soon as its token is admitted, so the limit must hold before.
	 */
	private follow(nodeId: string, port: string): number {
		const edges = this.plan.outgoing.get(runPlanPortKey(nodeId, port)) ?? [];

		for (const edge of edges) {
			if (this.admitted >= this.maxSteps) {
				this.cancel(`The run was stopped after ${this.maxSteps} steps.`, 'failed');

				break;
			}

			this.admitted += 1;
			this.tokens += 1;

			this.process(edge)
				.catch((error: unknown) => {
					// Nothing in process() is expected to throw; a token lost to a bug must still fail the run
					this.unhandledErrors += 1;

					const step: RunStep = {
						seq: ++this.seq,
						at: this.wallNow(),
						elapsedMs: this.elapsed(),
						nodeId: edge.target,
						type: this.plan.nodes.get(edge.target)?.type ?? 'unknown',
						kind: this.plan.nodes.get(edge.target)?.kind ?? 'action',
						via: edge.id,
						state: 'done',
						reason: `The engine failed on this node: ${describeError(error)}`,
						...(this.ended ? { afterCancel: true } : {}),
					};

					this.record.steps.push(step);
					this.notifyStep(step);
				})
				.finally(() => {
					this.tokens -= 1;
					this.settle();
				});
		}

		return edges.length;
	}

	private async process(edge: RunPlanEdge): Promise<void> {
		if (this.ended) return;

		const node = this.plan.nodes.get(edge.target);

		if (node === undefined) {
			throw new Error('an edge leads to a node that is not part of the plan');
		}

		switch (node.kind) {
			case 'condition':
				return this.runCondition(node, edge);
			case 'action':
				return this.runAction(node, edge);
			case 'flow':
				switch (node.flow) {
					case 'delay':
						return this.runDelay(node, edge);
					case 'wait_until':
						return this.runWaitUntil(node, edge);
					case 'any':
					case 'all':
						return this.runJoin(node, edge);
					default:
						throw new Error('a token reached a flow block the engine does not know');
				}
			default:
				throw new Error('a token reached a trigger');
		}
	}

	private async runCondition(node: RunPlanConditionNode, edge: RunPlanEdge): Promise<void> {
		const gate = this.beforeExecute?.(node) ?? { allow: true };

		let result: AutomationConditionResult;
		let timedOut = false;

		if (gate.allow === false) {
			// A condition that cannot be asked is not true
			result = { result: false, reason: gate.reason };
		} else {
			const outcome = await this.invoke(node, (context) => node.evaluate(context));

			if (outcome.type === 'value') {
				result = this.readConditionResult(outcome.value);
			} else if (outcome.type === 'timeout') {
				timedOut = true;
				result = { result: false, reason: `The condition did not answer within ${describeSeconds(node.timeoutMs)}.` };
			} else {
				result = { result: false, reason: `The condition failed: ${describeError(outcome.error)}` };
			}
		}

		const output = result.result ? 'yes' : 'no';
		// The run may have ended while the condition was asked: it is recorded and nothing follows
		const late = this.ended;

		this.step(node, edge, {
			output,
			...(result.observed !== undefined ? { observed: result.observed } : {}),
			...(result.reason !== undefined ? { reason: result.reason } : {}),
			...(gate.allow ? {} : { refused: true }),
			...(timedOut ? { timedOut: true } : {}),
			...(late ? { afterCancel: true } : {}),
		});

		if (late) return;

		this.follow(node.id, output);
	}

	private async runAction(node: RunPlanActionNode, edge: RunPlanEdge): Promise<void> {
		let gate = this.beforeExecute?.(node) ?? { allow: true };

		if (gate.allow && this.checkAction) {
			const asked = this.askActionCheck(node, this.checkAction);

			// Only a check that takes its time is waited for: an answer given at once keeps the action in this tick
			gate = asked instanceof Promise ? await asked : asked;

			if (this.ended) {
				// The run ended while the action was being checked: the action is not executed
				this.step(node, edge, { state: 'cancelled' });

				return;
			}

			if (gate.allow) {
				// The check may have taken its time: what the gate said before it may no longer hold
				gate = this.beforeExecute?.(node) ?? { allow: true };
			}
		}

		let result: AutomationActionResult;
		let timedOut = false;

		if (gate.allow === false) {
			result = { success: false, reason: gate.reason };
		} else {
			const outcome = await this.invoke(node, (context) => node.execute(context));

			if (outcome.type === 'value') {
				result = this.readActionResult(outcome.value);
			} else if (outcome.type === 'timeout') {
				timedOut = true;
				result = {
					success: false,
					reason: `The action did not finish within ${describeSeconds(node.timeoutMs)}; whether it took effect is not known.`,
				};
			} else {
				result = { success: false, reason: describeError(outcome.error) };
			}
		}

		const output = result.success ? 'done' : 'error';
		// The side effect already happened and cannot be recalled: it is recorded and nothing follows
		const late = this.ended;

		this.step(node, edge, {
			output,
			result,
			...(result.reason !== undefined ? { reason: result.reason } : {}),
			...(gate.allow && result.refused !== true ? {} : { refused: true }),
			...(timedOut ? { timedOut: true } : {}),
			...(late ? { afterCancel: true } : {}),
		});

		if (late) return;

		const followed = this.follow(node.id, output);

		if (output === 'error' && followed === 0) {
			this.unhandledErrors += 1;
		}
	}

	private async runDelay(node: RunPlanDelayNode, edge: RunPlanEdge): Promise<void> {
		const gate = this.beforeExecute?.(node) ?? { allow: true };

		if (gate.allow === false) {
			// A Delay has no `error` output to take: the token ends here and the run fails
			this.step(node, edge, { reason: gate.reason, refused: true });
			this.unhandledErrors += 1;

			return;
		}

		const step = this.step(node, edge, { state: 'parked', delayMs: node.delayMs });
		const resumed = this.park(node.delayMs);

		// Every park is reported, so what is stored of a parked run names the Delay it waits on now
		this.notify('parked');

		// The run may have been cancelled after the timer fired but before this went on
		if (!(await resumed) || this.ended) {
			step.state = 'cancelled';
			this.notifyStep(step);

			return;
		}

		step.state = 'done';
		step.output = 'out';
		this.notifyStep(step);

		this.follow(node.id, 'out');
	}

	private async runWaitUntil(node: RunPlanWaitUntilNode, edge: RunPlanEdge): Promise<void> {
		const gate = this.beforeExecute?.(node) ?? { allow: true };

		if (gate.allow === false) {
			// A Wait until has no `error` output to take: the token ends here and the run fails
			this.step(node, edge, { reason: gate.reason, refused: true, timeoutMs: node.timeoutMs });
			this.unhandledErrors += 1;

			return;
		}

		let step: RunStep | undefined;
		const outcome = await this.waitFor(node, (start) => {
			// The state does not hold yet: the token is parked from now on
			step = this.step(node, edge, {
				state: 'parked',
				timeoutMs: node.timeoutMs,
				...(start.observed !== undefined ? { observed: start.observed } : {}),
				...(start.reason !== undefined ? { reason: start.reason } : {}),
			});

			// Every park is reported, so what is stored of a parked run names the block it waits on now
			this.notify('parked');
		});

		const finish = (fields: Partial<RunStep>): void => {
			if (step === undefined) {
				this.step(node, edge, { timeoutMs: node.timeoutMs, ...fields });

				return;
			}

			delete step.reason;
			Object.assign(step, { state: 'done' }, fields);
			this.notifyStep(step);
		};

		// The run may have been cancelled after the wait ended but before this went on: nothing follows then
		if (outcome.type === 'cancelled' || this.ended) {
			finish({ state: 'cancelled' });

			return;
		}

		switch (outcome.type) {
			case 'threw':
				finish({ reason: `The wait failed: ${describeError(outcome.error)}` });
				this.unhandledErrors += 1;

				return;
			case 'holds':
				finish({
					output: 'out',
					...(outcome.observed !== undefined ? { observed: outcome.observed } : {}),
					reason: outcome.reason ?? 'The state already held.',
				});
				break;
			case 'event':
				finish({ output: 'out', ...(outcome.observed !== undefined ? { observed: outcome.observed } : {}) });
				break;
			case 'timeout':
				finish({
					output: 'timeout',
					timedOut: true,
					reason: `The awaited event did not happen within ${describeSeconds(node.timeoutMs)}.`,
				});
				break;
		}

		this.follow(node.id, outcome.type === 'timeout' ? 'timeout' : 'out');
	}

	/**
	 * Starts a Wait until and resolves with what let the token go on. The timeout runs from the arrival of
	 * the token, also while the node type is still looking at the state. The watch of the node type is
	 * released however the wait ends. The promise always resolves.
	 */
	private waitFor(
		node: RunPlanWaitUntilNode,
		onParked: (start: { observed?: unknown; reason?: string }) => void,
	): Promise<WaitOutcome> {
		const controller = new AbortController();

		this.executing.add(controller);

		return new Promise((resolve) => {
			let finished = false;
			let release: (() => void) | undefined;

			const letGo = (): void => {
				const pending = release;

				release = undefined;

				try {
					pending?.();
				} catch {
					// A watch that can not be released is the node type's to clean up
				}
			};

			const finish = (outcome: WaitOutcome): void => {
				if (finished) return;

				finished = true;
				this.clock.clearTimeout(handle);
				this.parked.delete(cancel);
				this.executing.delete(controller);

				if (outcome.type === 'cancelled' || outcome.type === 'timeout') {
					controller.abort();
				}

				letGo();
				resolve(outcome);
			};
			const cancel = (): void => finish({ type: 'cancelled' });

			this.parked.add(cancel);

			const handle = this.clock.setTimeout(() => finish({ type: 'timeout' }), node.timeoutMs);

			const resume = (event: AutomationWaitEvent): void => {
				const observed = typeof event === 'object' && event !== null ? event.observed : undefined;

				finish({ type: 'event', ...(observed !== undefined ? { observed } : {}) });
			};

			const started = (start: unknown): void => {
				if (typeof start !== 'object' || start === null) {
					finish({ type: 'threw', error: new Error('the block did not say whether the state holds') });

					return;
				}

				const answer = start as Partial<AutomationWaitStart>;

				if (answer.holds !== true && typeof answer.release === 'function') {
					release = answer.release;
				}

				if (finished) {
					// The wait ended while the node type was still looking: nothing is to be watched any more
					letGo();

					return;
				}

				if (answer.holds === true) {
					finish({
						type: 'holds',
						...(answer.observed !== undefined ? { observed: answer.observed } : {}),
						...(typeof answer.reason === 'string' ? { reason: answer.reason } : {}),
					});

					return;
				}

				onParked({
					...(answer.observed !== undefined ? { observed: answer.observed } : {}),
					...(typeof answer.reason === 'string' ? { reason: answer.reason } : {}),
				});
			};

			try {
				Promise.resolve(
					node.wait(resume, {
						automationId: this.record.automationId,
						runId: this.record.id,
						nodeId: node.id,
						signal: controller.signal,
						trigger: this.record.trigger,
					}),
				).then(started, (error: unknown) => finish({ type: 'threw', error }));
			} catch (error) {
				finish({ type: 'threw', error });
			}
		});
	}

	private runJoin(node: RunPlanJoinNode, edge: RunPlanEdge): void {
		let join = this.joins.get(node.id);

		if (join === undefined) {
			join = { arrived: new Set(), fired: false, held: [] };
			this.joins.set(node.id, join);
		}

		if (join.fired) {
			this.step(node, edge, {
				absorbed: true,
				reason:
					node.flow === 'any'
						? 'Another branch already passed this block in this run.'
						: 'This block already continued in this run.',
			});

			return;
		}

		if (node.flow === 'all') {
			if (join.arrived.has(edge.id)) {
				// A strict AND over the edges: a second token on one edge does not stand in for another edge
				this.step(node, edge, { absorbed: true, reason: 'A token already arrived on this edge in this run.' });

				return;
			}

			join.arrived.add(edge.id);

			const arrived = join.arrived;
			const missing = node.incoming.filter((id) => !arrived.has(id));

			if (missing.length > 0) {
				// The tokens held before this one are still waiting, but no longer for this edge
				for (const held of join.held) {
					held.missingEdges = [...missing];
					this.notifyStep(held);
				}

				// The token rests here without keeping the run open: see releaseJoins()
				join.held.push(this.step(node, edge, { state: 'parked', missingEdges: missing }));

				return;
			}
		}

		join.fired = true;

		for (const held of join.held.splice(0)) {
			held.state = 'done';
			delete held.missingEdges;
			this.notifyStep(held);
		}

		this.step(node, edge, { output: 'out' });
		this.follow(node.id, 'out');
	}

	/**
	 * Lets go of the tokens held at an All that did not continue, when the run ends: cancelled, or because
	 * nothing of it is left that could still arrive. Their steps name the edges that were missing.
	 */
	private releaseJoins(reason?: string): void {
		for (const [nodeId, join] of this.joins) {
			if (join.fired || join.held.length === 0) continue;

			const node = this.plan.nodes.get(nodeId);
			const incoming = node?.kind === 'flow' && node.flow === 'all' ? node.incoming : [];
			const missing = incoming.filter((id) => !join.arrived.has(id));

			for (const held of join.held.splice(0)) {
				held.state = 'cancelled';
				held.missingEdges = missing;

				if (reason !== undefined) {
					held.reason = reason;
				}

				this.notifyStep(held);
			}
		}
	}

	/**
	 * Asks the action check. A check that answers at once is not waited for, so an action it lets through
	 * starts in the same tick as before. The promise always resolves.
	 */
	private askActionCheck(
		node: RunPlanActionNode,
		check: NonNullable<RunWalkerOptions['checkAction']>,
	): RunGate | Promise<RunGate> {
		const failed: RunGate = { allow: false, reason: ACTION_CHECK_FAILED_REASON };
		const read = (gate: unknown): RunGate => {
			if (typeof gate !== 'object' || gate === null) return failed;

			try {
				// Reading the verdict is part of the check: a verdict that can not be read lets nothing through
				const { allow, reason } = gate as { allow?: unknown; reason?: unknown };

				if (allow === true) return { allow: true };

				return { allow: false, reason: typeof reason === 'string' ? reason : ACTION_CHECK_FAILED_REASON };
			} catch {
				return failed;
			}
		};

		let asked: RunGate | PromiseLike<RunGate>;
		let pending: boolean;

		try {
			asked = check(node);
			// Reading `then` is part of asking: an answer that can not be read is no answer
			pending = typeof (asked as PromiseLike<RunGate> | null)?.then === 'function';
		} catch {
			return failed;
		}

		if (!pending) {
			return read(asked);
		}

		return new Promise((resolve) => {
			let finished = false;

			const finish = (gate: RunGate): void => {
				if (finished) return;

				finished = true;
				this.clock.clearTimeout(handle);
				this.parked.delete(release);
				resolve(gate);
			};
			// A cancelled run does not wait for the check
			const release = (): void => finish(failed);

			this.parked.add(release);

			const handle = this.clock.setTimeout(
				() =>
					finish({
						allow: false,
						reason: `The action could not be checked within ${describeSeconds(node.timeoutMs)}.`,
					}),
				node.timeoutMs,
			);

			try {
				(asked as PromiseLike<RunGate>).then(
					(gate) => finish(read(gate)),
					() => finish(failed),
				);
			} catch {
				finish(failed);
			}
		});
	}

	/** Parks a token on a timer. Resolves true when the timer fired and false when the run was cancelled. */
	private park(ms: number): Promise<boolean> {
		return new Promise((resolve) => {
			const finish = (resumed: boolean): void => {
				if (!this.parked.delete(release)) return;

				this.clock.clearTimeout(handle);
				resolve(resumed);
			};
			const release = (): void => finish(false);

			this.parked.add(release);

			const handle = this.clock.setTimeout(() => finish(true), ms);
		});
	}

	/**
	 * Runs a handler under its timeout. The promise always resolves: with the value, with what was thrown,
	 * or with `timeout`. A handler that answers after its timeout is ignored.
	 */
	private invoke<T>(
		node: RunPlanConditionNode | RunPlanActionNode,
		call: (context: AutomationRunContext) => Promise<T> | T,
	): Promise<Invocation<T>> {
		const controller = new AbortController();

		this.executing.add(controller);

		return new Promise((resolve) => {
			let finished = false;

			const finish = (outcome: Invocation<T>): void => {
				if (finished) return;

				finished = true;
				this.clock.clearTimeout(handle);
				this.executing.delete(controller);
				resolve(outcome);
			};

			const handle = this.clock.setTimeout(() => {
				controller.abort();
				finish({ type: 'timeout' });
			}, node.timeoutMs);

			try {
				Promise.resolve(
					call({
						automationId: this.record.automationId,
						runId: this.record.id,
						nodeId: node.id,
						signal: controller.signal,
						trigger: this.record.trigger,
					}),
				).then(
					(value) => finish({ type: 'value', value }),
					(error: unknown) => finish({ type: 'threw', error }),
				);
			} catch (error) {
				finish({ type: 'threw', error });
			}
		});
	}

	private readConditionResult(value: unknown): AutomationConditionResult {
		if (typeof value !== 'object' || value === null) {
			return { result: false, reason: 'The condition did not return a result.' };
		}

		const { result, observed, reason } = value as Partial<AutomationConditionResult>;

		return {
			result: result === true,
			...(observed !== undefined ? { observed } : {}),
			...(typeof reason === 'string' ? { reason } : {}),
		};
	}

	private readActionResult(value: unknown): AutomationActionResult {
		if (typeof value !== 'object' || value === null) {
			return { success: false, reason: 'The action did not return a result.' };
		}

		const { success, reason, refused } = value as Partial<AutomationActionResult>;

		return {
			success: success === true,
			...(typeof reason === 'string' ? { reason } : {}),
			// Only an action that did nothing can have been refused
			...(success !== true && refused === true ? { refused: true } : {}),
		};
	}

	private step(node: RunPlanNode, edge: RunPlanEdge, fields: Partial<RunStep>): RunStep {
		const step: RunStep = {
			seq: ++this.seq,
			at: this.wallNow(),
			elapsedMs: this.elapsed(),
			nodeId: node.id,
			type: node.type,
			kind: node.kind,
			via: edge.id,
			state: 'done',
			...fields,
		};

		this.record.steps.push(step);
		this.notifyStep(step);

		return step;
	}

	private elapsed(): number {
		return Math.max(0, Math.round(this.clock.now() - this.startedMono));
	}

	private settle(): void {
		if (this.tokens > 0 || this.settledReported) return;

		if (!this.ended) {
			// Nothing of the run is left, so no branch can arrive at an All any more
			this.releaseJoins('The run ended before a token arrived on every incoming edge, so this block did not continue.');
			this.end(this.unhandledErrors > 0 ? 'failed' : 'completed');
		}

		this.settledReported = true;
		this.notify('settled');
	}

	private end(status: RunEndStatus, reason?: string): void {
		this.ended = true;
		this.record.status = status;
		this.record.finishedAt = this.wallNow();
		this.record.durationMs = this.elapsed();

		if (reason !== undefined) {
			this.record.endReason = reason;
		}

		this.notify('ended');
	}

	private notify(event: 'parked' | 'ended' | 'settled'): void {
		this.observe(() => this.observer[event]?.(this.record));
	}

	private notifyStep(step: RunStep): void {
		this.observe(() => this.observer.step?.(this.record, step));
	}

	private observe(report: () => void): void {
		try {
			report();
		} catch (error) {
			try {
				this.observer.error?.(error);
			} catch {
				// An observer that cannot even report its failure is left alone
			}
		}
	}
}

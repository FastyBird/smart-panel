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
 * - A run takes a limited number of steps. Every token put on an edge counts, before its node is executed;
 *   the run ends as `failed` when one more would be needed.
 * - The run ends when no token is left: `completed`, or `failed` when an error went unhandled.
 * - A cancelled run ends at once. Parked tokens are dropped. A node already executing cannot be recalled:
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

export type RunPlanNode = RunPlanTriggerNode | RunPlanConditionNode | RunPlanActionNode | RunPlanDelayNode;

/** The nodes a token can reach, each of which the gate is asked about */
export type RunPlanGatedNode = RunPlanConditionNode | RunPlanActionNode | RunPlanDelayNode;

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
	/** `parked` while a Delay holds the token, `cancelled` when the run was cancelled around it */
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
	/** The run parked a token for the first time and will outlive the current tick */
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
	observer?: RunObserver;
	maxSteps?: number;
}

type Invocation<T> = { type: 'value'; value: T } | { type: 'threw'; error: unknown } | { type: 'timeout' };

const describeError = (error: unknown): string => (error instanceof Error ? error.message : 'unknown error');

const describeSeconds = (ms: number): string => `${Math.round(ms / 100) / 10} s`;

export class RunWalker {
	public readonly record: RunRecord;

	private readonly plan: RunPlan;
	private readonly clock: TrackerClock;
	private readonly wallNow: () => number;
	private readonly observer: RunObserver;
	private readonly beforeExecute?: RunWalkerOptions['beforeExecute'];
	private readonly maxSteps: number;

	private started = false;
	private ended = false;
	private settledReported = false;
	private parkedReported = false;
	private startedMono = 0;
	private tokens = 0;
	/** Every token ever put on an edge; unlike `seq` it moves before the node of the token is executed */
	private admitted = 0;
	private seq = 0;
	private unhandledErrors = 0;
	private readonly parked = new Set<() => void>();
	private readonly executing = new Set<AbortController>();

	public constructor(options: RunWalkerOptions) {
		this.plan = options.plan;
		this.clock = options.clock;
		this.wallNow = options.wallNow ?? ((): number => Date.now());
		this.observer = options.observer ?? {};
		this.beforeExecute = options.beforeExecute;
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
					this.record.steps.push({
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
					});
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
				return this.runDelay(node, edge);
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
		const step = this.step(node, edge, {
			output,
			...(result.observed !== undefined ? { observed: result.observed } : {}),
			...(result.reason !== undefined ? { reason: result.reason } : {}),
			...(gate.allow ? {} : { refused: true }),
			...(timedOut ? { timedOut: true } : {}),
		});

		if (this.ended) {
			step.afterCancel = true;

			return;
		}

		this.follow(node.id, output);
	}

	private async runAction(node: RunPlanActionNode, edge: RunPlanEdge): Promise<void> {
		const gate = this.beforeExecute?.(node) ?? { allow: true };

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
		const step = this.step(node, edge, {
			output,
			result,
			...(result.reason !== undefined ? { reason: result.reason } : {}),
			...(gate.allow ? {} : { refused: true }),
			...(timedOut ? { timedOut: true } : {}),
		});

		if (this.ended) {
			// The side effect already happened and cannot be recalled: it is recorded and nothing follows
			step.afterCancel = true;

			return;
		}

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

		if (!this.parkedReported) {
			this.parkedReported = true;
			this.notify('parked');
		}

		if (!(await resumed)) {
			step.state = 'cancelled';

			return;
		}

		step.state = 'done';
		step.output = 'out';

		this.follow(node.id, 'out');
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

		const { success, reason } = value as Partial<AutomationActionResult>;

		return { success: success === true, ...(typeof reason === 'string' ? { reason } : {}) };
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

		return step;
	}

	private elapsed(): number {
		return Math.max(0, Math.round(this.clock.now() - this.startedMono));
	}

	private settle(): void {
		if (this.tokens > 0 || this.settledReported) return;

		if (!this.ended) {
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
		try {
			this.observer[event]?.(this.record);
		} catch (error) {
			try {
				this.observer.error?.(error);
			} catch {
				// An observer that cannot even report its failure is left alone
			}
		}
	}
}

/**
 * The automation engine: which automations are armed, what a firing trigger does, and the guards.
 *
 * Framework-free (ADR 0003, decision 15): it must not import NestJS, TypeORM or anything else from the
 * application. The node types come through a lookup, time through an injected clock, and everything the
 * engine wants the outside world to know goes through hooks; `AutomationEngineService` is the thin adapter
 * that connects it to the application.
 *
 * What it holds per automation:
 *
 * - every automation is known to the engine, enabled or not, so a deleted device, scene or space can mark
 *   the automations referring to it `invalid`;
 * - only an automation that is enabled and `ok` is armed: its triggers are subscribed and the properties
 *   its nodes read are kept in the state tracker. A disabled, invalid or suspended automation holds no
 *   subscription, no timer and no run.
 *
 * What a save does (ADR 0003, decision 3): a change of the nodes, the edges, the mode or `enabled` cancels
 * the active runs and rebuilds the subscriptions of that automation only. A save that changes nothing of
 * those - a rename, moving nodes on the canvas - leaves runs, timers and subscriptions alone. Any save
 * clears `suspended`.
 *
 * What a firing trigger does: the mode policy decides (`mode-policy.ts`), then the rate guard
 * (`rate-guard.ts`), then the global cap on concurrent runs. A trigger that does not start a run is counted
 * as ignored or dropped, so "why did it not run" has an answer.
 *
 * Every operation that changes what is loaded is queued and runs one at a time, in the order it was asked
 * for; a trigger firing is handled at once.
 */
import { AutomationGraphIssueCode, validateGraph } from '../graph/graph-validator';
import {
	AUTOMATION_DELAY_MAX_SECONDS,
	AUTOMATION_NODE_DEFAULT_TIMEOUT_SECONDS,
	AUTOMATION_NODE_MAX_TIMEOUT_SECONDS,
	AutomationActionNodeType,
	AutomationConditionNodeType,
	AutomationDelayNodeType,
	AutomationNodeConfig,
	AutomationNodeReference,
	AutomationNodeReferenceKind,
	AutomationNodeTypeLookup,
	AutomationNodeTypeOwner,
	AutomationTriggerData,
	AutomationTriggerNodeType,
	RegisteredAutomationNodeType,
} from '../graph/node-type';
import { applyGraphSavePolicy } from '../graph/save-policy';
import { TrackerClock } from '../tracker/clock';

import { PARALLEL_RUNS_MAX, RunMode, decideRunStart } from './mode-policy';
import { DEFAULT_RUN_RATE_WINDOWS, RunRateGuard, RunRateWindow, describeRunRateWindow } from './rate-guard';
import {
	RUN_MAX_STEPS,
	RunEndStatus,
	RunGate,
	RunPlan,
	RunPlanEdge,
	RunPlanGatedNode,
	RunPlanNode,
	RunRecord,
	RunWalker,
	runPlanPortKey,
} from './run-walker';

export type EngineAutomationStatus = 'ok' | 'invalid' | 'suspended';

/** The most runs that may be active at once, over all automations */
export const CONCURRENT_RUNS_MAX = 50;

export const EngineProblemCode = {
	...AutomationGraphIssueCode,
	/** A node type has no handler the engine can run */
	NOT_RUNNABLE: 'not_runnable',
	/** A device, channel, property, scene, space or automation a node refers to does not exist */
	MISSING_REFERENCE: 'missing_reference',
	/** A trigger threw when it was armed */
	TRIGGER_FAILED: 'trigger_failed',
} as const;

export type EngineProblemCode = (typeof EngineProblemCode)[keyof typeof EngineProblemCode];

/**
 * Why an automation is `invalid`, addressed to the node or edge it is about.
 */
export interface EngineProblem {
	code: EngineProblemCode;
	message: string;
	node_id?: string;
	edge_id?: string;
	node_ids?: string[];
	field?: string;
}

export interface EngineAutomation {
	id: string;
	enabled: boolean;
	mode: RunMode;
	revision: number;
	/** The stored graph document; read defensively, a disabled automation may hold an unfinished one */
	graph: unknown;
}

export interface EngineLoadOptions {
	/**
	 * Keep the automation suspended, for loading at start what the overload guard stopped earlier. A save
	 * clears a suspension, so it is never set when an automation is loaded because it was saved.
	 */
	suspended?: boolean;
}

export interface EngineTriggerCounters {
	/** Triggers that started a run */
	started: number;
	/** Triggers skipped because a run was active in `single` mode, or because their owner is disabled */
	ignored: number;
	/** Triggers skipped because a limit was reached */
	dropped: number;
}

export interface EngineSkippedTrigger {
	outcome: 'ignored' | 'dropped';
	reason: string;
	nodeId: string;
	/** Wall-clock milliseconds */
	at: number;
}

export interface EngineAutomationState {
	id: string;
	revision: number;
	enabled: boolean;
	mode: RunMode;
	status: EngineAutomationStatus;
	/** Whether the triggers are subscribed */
	armed: boolean;
	/** Triggers currently subscribed; lower than the number of triggers when an owning plugin is disabled */
	armedTriggers: number;
	activeRuns: number;
	triggers: EngineTriggerCounters;
	lastSkipped?: EngineSkippedTrigger;
	/** Wall-clock milliseconds */
	lastTriggeredAt?: number;
	lastRunStatus?: RunEndStatus;
	/** Why the automation is `invalid`; empty otherwise */
	problems: EngineProblem[];
	/** Why the automation is `suspended` */
	suspendedReason?: string;
}

export type TriggerRefusalCode =
	| 'not_found'
	| 'disabled'
	| 'invalid'
	| 'suspended'
	| 'not_a_trigger'
	| 'no_trigger'
	/** Used by the adapter: the engine itself is stopped */
	| 'not_running';

export type TriggerOutcome =
	| { outcome: 'started'; runId: string }
	| { outcome: 'ignored' | 'dropped' | 'suspended'; reason: string }
	| { outcome: 'refused'; code: TriggerRefusalCode; reason: string };

export interface ActionPolicyRequest {
	automationId: string;
	nodeId: string;
	type: string;
	config: AutomationNodeConfig;
}

export interface ActionPolicyVerdict {
	allow: boolean;
	reason?: string;
}

export interface EngineLimits {
	maxParallelRuns: number;
	maxConcurrentRuns: number;
	maxRunSteps: number;
	rateWindows: readonly RunRateWindow[];
}

export interface EngineHooks {
	/**
	 * The engine changed the status of an automation on its own: the overload guard suspended it, or
	 * something it refers to was removed. A status that follows from `load()` is returned by `load()`.
	 */
	statusChanged?(state: EngineAutomationState, previous: EngineAutomationStatus): void;
	runStarted?(record: RunRecord): void;
	/** The run parked on a Delay for the first time, so it will outlive the current tick */
	runParked?(record: RunRecord): void;
	/** The outcome of the run is known */
	runEnded?(record: RunRecord): void;
	/** Nothing of the run is executing any more; its trace is complete */
	runSettled?(record: RunRecord): void;
	/** Something the engine called threw; the engine carried on */
	error?(error: unknown, what: string): void;
}

export interface AutomationEngineOptions {
	lookup: AutomationNodeTypeLookup;
	/** Monotonic clock for delays, timeouts and the rate windows (ADR 0003, decision 6) */
	clock: TrackerClock;
	/** Wall-clock milliseconds, for display timestamps only */
	wallNow?: () => number;
	generateRunId?: () => string;
	/** Whether the module or plugin owning a node type is enabled; everything is enabled when left out */
	isOwnerEnabled?: (owner: AutomationNodeTypeOwner) => boolean;
	/** Whether what a node refers to still exists; everything exists when left out */
	referenceExists?: (reference: AutomationNodeReference) => boolean | Promise<boolean>;
	/**
	 * Called for every reference of an armed automation; returns the function that lets it go. The adapter
	 * uses it to keep the last-seen value of referenced properties in the state tracker.
	 */
	holdReference?: (reference: AutomationNodeReference) => (() => void) | undefined;
	/** Asked before every action; a refusal takes the `error` output and is traced */
	actionPolicy?: (request: ActionPolicyRequest) => ActionPolicyVerdict;
	limits?: Partial<EngineLimits>;
	hooks?: EngineHooks;
}

interface NodeReference {
	nodeId: string;
	reference: AutomationNodeReference;
}

interface CompiledNode {
	node: RunPlanNode;
	registered: RegisteredAutomationNodeType;
}

interface Analysis {
	problems: EngineProblem[];
	references: NodeReference[];
	compiled: CompiledNode[];
	plan: RunPlan;
}

interface Loaded {
	def: EngineAutomation;
	signature: string;
	status: EngineAutomationStatus;
	problems: EngineProblem[];
	suspendedReason?: string;
	references: NodeReference[];
	compiled: CompiledNode[];
	plan?: RunPlan;
	/** Replaced on every arming; a trigger firing into a stale one is dropped */
	subscription: { live: boolean };
	releases: (() => void)[];
	armedTriggers: number;
	/** The enabled flag of every owner as it was when the automation was armed */
	owners: Map<string, { owner: AutomationNodeTypeOwner; enabled: boolean }>;
	active: Set<RunWalker>;
	guard: RunRateGuard;
	counters: EngineTriggerCounters;
	lastSkipped?: EngineSkippedTrigger;
	lastTriggeredAt?: number;
	lastRunStatus?: RunEndStatus;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? (value as unknown[]) : []);

const ownerKey = (owner: AutomationNodeTypeOwner): string => `${owner.kind}:${owner.type}`;

const referenceKey = (reference: AutomationNodeReference): string => `${reference.kind}:${reference.id}`;

const resolveTimeoutMs = (seconds: unknown): number => {
	const value =
		typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0
			? seconds
			: AUTOMATION_NODE_DEFAULT_TIMEOUT_SECONDS;

	return Math.min(value, AUTOMATION_NODE_MAX_TIMEOUT_SECONDS) * 1000;
};

/**
 * What of an automation decides how it runs: the nodes with their configuration, the edges, the mode and
 * `enabled`. Positions on the canvas are left out, so tidying up the layout does not cancel a run.
 */
export const automationRunSignature = (automation: EngineAutomation): string => {
	const graph = isRecord(automation.graph) ? automation.graph : {};

	return JSON.stringify([
		automation.enabled,
		automation.mode,
		graph.version,
		asArray(graph.nodes).map((node) => (isRecord(node) ? [node.id, node.type, node.config] : null)),
		asArray(graph.edges).map((edge) =>
			isRecord(edge) ? [edge.id, edge.source, edge.source_port, edge.target, edge.target_port] : null,
		),
	]);
};

export class AutomationEngine {
	private readonly lookup: AutomationNodeTypeLookup;
	private readonly clock: TrackerClock;
	private readonly wallNow: () => number;
	private readonly generateRunId: () => string;
	private readonly options: AutomationEngineOptions;
	private readonly limits: EngineLimits;
	private readonly hooks: EngineHooks;

	private readonly automations = new Map<string, Loaded>();
	private queue: Promise<unknown> = Promise.resolve();
	private activeRuns = 0;
	private runSeq = 0;

	public constructor(options: AutomationEngineOptions) {
		this.options = options;
		this.lookup = options.lookup;
		this.clock = options.clock;
		this.wallNow = options.wallNow ?? ((): number => Date.now());
		this.generateRunId = options.generateRunId ?? ((): string => `run-${++this.runSeq}`);
		this.hooks = options.hooks ?? {};
		this.limits = {
			maxParallelRuns: PARALLEL_RUNS_MAX,
			maxConcurrentRuns: CONCURRENT_RUNS_MAX,
			maxRunSteps: RUN_MAX_STEPS,
			rateWindows: DEFAULT_RUN_RATE_WINDOWS,
			...options.limits,
		};
	}

	// ---- what is loaded --------------------------------------------------------------------------------

	/**
	 * Creates or replaces an automation and returns the state it ends up in. A stale revision is ignored.
	 */
	public load(automation: EngineAutomation, options: EngineLoadOptions = {}): Promise<EngineAutomationState> {
		return this.enqueue(() => this.loadNow(automation, options));
	}

	/**
	 * Loads what `read` returns as one queued operation, so nothing asked for while the automations are
	 * being read is applied before them.
	 */
	public loadAll(
		read: () => Promise<{ automation: EngineAutomation; options?: EngineLoadOptions }[]>,
	): Promise<EngineAutomationState[]> {
		return this.enqueue(async () => {
			const states: EngineAutomationState[] = [];

			for (const { automation, options } of await read()) {
				states.push(await this.loadNow(automation, options ?? {}));
			}

			return states;
		});
	}

	/** Removes an automation: its subscriptions are dropped and its runs cancelled */
	public remove(id: string): Promise<boolean> {
		return this.enqueue(() => {
			const loaded = this.automations.get(id);

			if (!loaded) return false;

			this.teardown(loaded, 'automation_deleted');
			this.automations.delete(id);

			return true;
		});
	}

	/**
	 * Drops everything. Active runs end as `interrupted` when the engine itself stops, and as `cancelled`
	 * when the automations were removed.
	 */
	public clear(reason: 'engine_stopped' | 'automations_removed'): Promise<void> {
		return this.enqueue(() => {
			for (const loaded of this.automations.values()) {
				this.teardown(loaded, reason, reason === 'engine_stopped' ? 'interrupted' : 'cancelled');
			}

			this.automations.clear();
		});
	}

	/**
	 * Marks every automation with a node referring to something that `matches` as `invalid` and stops it.
	 * Returns the automations that were hit.
	 */
	public invalidate(matches: (reference: AutomationNodeReference) => boolean): Promise<EngineAutomationState[]> {
		return this.enqueue(() => {
			const hit: EngineAutomationState[] = [];

			for (const loaded of this.automations.values()) {
				const broken = loaded.references.filter(({ reference }) => this.safely(() => matches(reference), false));

				if (broken.length === 0) continue;

				for (const { nodeId, reference } of broken) {
					this.addMissingReference(loaded.problems, nodeId, reference);
				}

				const previous = loaded.status;

				loaded.status = 'invalid';
				loaded.suspendedReason = undefined;

				this.teardown(loaded, 'automation_invalid');

				const state = this.snapshot(loaded);

				hit.push(state);

				if (previous !== 'invalid') {
					this.hook('statusChanged', state, previous);
				}
			}

			return hit;
		});
	}

	/**
	 * Arms again every automation with a node type whose owner was enabled or disabled since it was armed.
	 * Runs are left alone; the subscriptions are rebuilt, so "for" durations of that automation restart.
	 */
	public refreshOwners(): Promise<string[]> {
		return this.enqueue(() => {
			const rearmed: string[] = [];

			for (const loaded of this.automations.values()) {
				if (loaded.status !== 'ok' || !loaded.def.enabled || !loaded.plan) continue;

				const changed = [...loaded.owners.values()].some(({ owner, enabled }) => this.ownerEnabled(owner) !== enabled);

				if (!changed) continue;

				this.disarm(loaded);
				this.arm(loaded);

				rearmed.push(loaded.def.id);

				if (loaded.status !== 'ok') {
					this.teardown(loaded, 'automation_invalid');
					this.hook('statusChanged', this.snapshot(loaded), 'ok');
				}
			}

			return rearmed;
		});
	}

	/**
	 * Starts a run by hand. Refused while the automation is disabled, `invalid` or `suspended`, and it may
	 * start only at a trigger node - by default the first one of the graph. The mode and the guards apply
	 * as they do to a trigger that fired.
	 */
	public trigger(id: string, nodeId?: string): Promise<TriggerOutcome> {
		return this.enqueue((): TriggerOutcome => {
			const loaded = this.automations.get(id);

			if (!loaded) {
				return { outcome: 'refused', code: 'not_found', reason: 'The automation is not loaded.' };
			}

			if (loaded.status === 'invalid') {
				return { outcome: 'refused', code: 'invalid', reason: 'The automation is invalid and cannot run.' };
			}

			if (loaded.status === 'suspended') {
				return {
					outcome: 'refused',
					code: 'suspended',
					reason: 'The automation is suspended. Save it or enable it again to resume it.',
				};
			}

			if (!loaded.def.enabled || !loaded.plan) {
				return { outcome: 'refused', code: 'disabled', reason: 'The automation is disabled.' };
			}

			const triggers = [...loaded.plan.nodes.values()].filter((node) => node.kind === 'trigger');
			const start = nodeId === undefined ? triggers[0] : triggers.find((node) => node.id === nodeId);

			if (!start) {
				return nodeId === undefined
					? { outcome: 'refused', code: 'no_trigger', reason: 'The automation has no trigger to start at.' }
					: { outcome: 'refused', code: 'not_a_trigger', reason: 'A run can start only at a trigger node.' };
			}

			return this.fire(loaded, start.id, { manual: true }, true);
		});
	}

	public state(id: string): EngineAutomationState | undefined {
		const loaded = this.automations.get(id);

		return loaded ? this.snapshot(loaded) : undefined;
	}

	public states(): EngineAutomationState[] {
		return [...this.automations.values()].map((loaded) => this.snapshot(loaded));
	}

	/** Runs active right now, over all automations */
	public activeRunCount(): number {
		return this.activeRuns;
	}

	/** Resolves once everything asked for so far has been applied */
	public async idle(): Promise<void> {
		await this.queue;
	}

	// ---- loading ---------------------------------------------------------------------------------------

	private async loadNow(automation: EngineAutomation, options: EngineLoadOptions): Promise<EngineAutomationState> {
		const signature = automationRunSignature(automation);
		const previous = this.automations.get(automation.id);

		if (previous) {
			if (automation.revision < previous.def.revision) {
				return this.snapshot(previous);
			}

			// Nothing that decides how it runs changed: runs, timers and subscriptions are left alone. An
			// automation that is not `ok` is looked at again by every save, which is what clears `suspended`
			// and lets an `invalid` one recover.
			if (
				previous.signature === signature &&
				(previous.status === 'ok' || automation.revision === previous.def.revision)
			) {
				previous.def = automation;

				return this.snapshot(previous);
			}

			this.teardown(previous, automation.enabled ? 'automation_updated' : 'automation_disabled');
		}

		const loaded: Loaded = {
			def: automation,
			signature,
			status: 'ok',
			problems: [],
			references: [],
			compiled: [],
			subscription: { live: false },
			releases: [],
			armedTriggers: 0,
			owners: new Map(),
			active: new Set(),
			guard: new RunRateGuard(this.limits.rateWindows),
			counters: previous?.counters ?? { started: 0, ignored: 0, dropped: 0 },
			lastSkipped: previous?.lastSkipped,
			lastTriggeredAt: previous?.lastTriggeredAt,
			lastRunStatus: previous?.lastRunStatus,
		};

		this.automations.set(automation.id, loaded);

		const analysis = await this.analyse(automation);

		loaded.references = analysis.references;
		loaded.problems = analysis.problems;
		loaded.compiled = analysis.compiled;

		if (analysis.problems.length > 0) {
			loaded.status = 'invalid';
		} else if (options.suspended) {
			loaded.status = 'suspended';
		} else if (automation.enabled) {
			loaded.plan = analysis.plan;

			this.arm(loaded);
		}

		return this.snapshot(loaded);
	}

	/**
	 * Finds what stops the automation from running. A disabled automation may hold an unfinished graph, so
	 * for it only what could never run is a problem: a node type that is not registered, an edge on a port
	 * that does not exist, a cycle, a reference to something that is gone.
	 */
	private async analyse(automation: EngineAutomation): Promise<Analysis> {
		const problems: EngineProblem[] = [];
		const references: NodeReference[] = [];
		const compiled: CompiledNode[] = [];
		const plan: RunPlan = { nodes: new Map(), outgoing: new Map() };

		const issues = applyGraphSavePolicy(await validateGraph(automation.graph, this.lookup), {
			enabled: automation.enabled,
		}).issues;

		for (const issue of issues) {
			if (!issue.blocking) continue;

			problems.push({
				code: issue.code,
				message: issue.message,
				...(issue.node_id !== undefined ? { node_id: issue.node_id } : {}),
				...(issue.edge_id !== undefined ? { edge_id: issue.edge_id } : {}),
				...(issue.node_ids !== undefined ? { node_ids: issue.node_ids } : {}),
				...(issue.field !== undefined ? { field: issue.field } : {}),
			});
		}

		const graph = isRecord(automation.graph) ? automation.graph : {};

		for (const raw of asArray(graph.nodes)) {
			if (!isRecord(raw) || typeof raw.id !== 'string' || plan.nodes.has(raw.id)) continue;

			const type = raw.type;
			const registered = this.safely<RegisteredAutomationNodeType | undefined>(
				() => (typeof type === 'string' ? this.lookup(type) : undefined),
				undefined,
			);

			if (!registered) continue;

			const config: AutomationNodeConfig = isRecord(raw.config) ? raw.config : {};
			const nodeId = raw.id;

			for (const reference of this.safely<unknown[]>(() => asArray(registered.references(config)), [])) {
				if (isRecord(reference) && typeof reference.kind === 'string' && typeof reference.id === 'string') {
					references.push({
						nodeId,
						reference: { kind: reference.kind as AutomationNodeReferenceKind, id: reference.id },
					});
				}
			}

			if (!automation.enabled) continue;

			const node = this.compileNode(nodeId, registered, config);

			if (node === undefined) {
				problems.push({
					code: EngineProblemCode.NOT_RUNNABLE,
					message: 'This block cannot be run: its type has nothing the engine can execute.',
					node_id: nodeId,
				});

				continue;
			}

			plan.nodes.set(nodeId, node);
			compiled.push({ node, registered });
		}

		asArray(graph.edges).forEach((raw, index) => {
			if (
				!isRecord(raw) ||
				typeof raw.source !== 'string' ||
				typeof raw.target !== 'string' ||
				typeof raw.source_port !== 'string' ||
				!plan.nodes.has(raw.source) ||
				!plan.nodes.has(raw.target)
			) {
				return;
			}

			const edge: RunPlanEdge = {
				id: typeof raw.id === 'string' ? raw.id : `#${index}`,
				source: raw.source,
				sourcePort: raw.source_port,
				target: raw.target,
			};
			const key = runPlanPortKey(edge.source, edge.sourcePort);
			const edges = plan.outgoing.get(key);

			if (edges) {
				edges.push(edge);
			} else {
				plan.outgoing.set(key, [edge]);
			}
		});

		// References are checked once each, whatever the number of nodes sharing them
		const existence = new Map<string, boolean>();

		for (const { nodeId, reference } of references) {
			const key = referenceKey(reference);

			if (!existence.has(key)) {
				existence.set(key, await this.exists(reference));
			}

			if (existence.get(key) === false) {
				this.addMissingReference(problems, nodeId, reference);
			}
		}

		return { problems, references, compiled, plan };
	}

	private compileNode(
		id: string,
		registered: RegisteredAutomationNodeType,
		config: AutomationNodeConfig,
	): RunPlanNode | undefined {
		const base = { id, type: registered.type, config };

		switch (registered.kind) {
			case 'trigger': {
				const definition = registered.definition as Partial<AutomationTriggerNodeType>;

				return typeof definition.subscribe === 'function' ? { ...base, kind: 'trigger' } : undefined;
			}
			case 'condition': {
				const definition = registered.definition as Partial<AutomationConditionNodeType>;

				if (typeof definition.evaluate !== 'function') return undefined;

				return {
					...base,
					kind: 'condition',
					timeoutMs: resolveTimeoutMs(definition.timeoutSeconds),
					evaluate: (context) => (definition as AutomationConditionNodeType).evaluate(config, context),
				};
			}
			case 'action': {
				const definition = registered.definition as Partial<AutomationActionNodeType>;

				if (typeof definition.execute !== 'function') return undefined;

				return {
					...base,
					kind: 'action',
					timeoutMs: resolveTimeoutMs(definition.timeoutSeconds),
					execute: (context) => (definition as AutomationActionNodeType).execute(config, context),
				};
			}
			case 'flow': {
				const definition = registered.definition as Partial<AutomationDelayNodeType>;

				if (definition.flow !== 'delay' || typeof definition.delaySeconds !== 'function') return undefined;

				const seconds = this.safely(() => (definition as AutomationDelayNodeType).delaySeconds(config), Number.NaN);

				if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return undefined;

				return {
					...base,
					kind: 'flow',
					flow: 'delay',
					delayMs: Math.round(Math.min(seconds, AUTOMATION_DELAY_MAX_SECONDS) * 1000),
				};
			}
			default:
				return undefined;
		}
	}

	private async exists(reference: AutomationNodeReference): Promise<boolean> {
		if (!this.options.referenceExists) return true;

		try {
			return (await this.options.referenceExists(reference)) !== false;
		} catch (error) {
			// A lookup that failed says nothing about the reference; the automation is not stopped for it
			this.hook('error', error, `checking a ${reference.kind} reference`);

			return true;
		}
	}

	private addMissingReference(problems: EngineProblem[], nodeId: string, reference: AutomationNodeReference): void {
		const message = `The ${reference.kind} this block refers to no longer exists.`;

		if (problems.some((problem) => problem.node_id === nodeId && problem.message === message)) return;

		problems.push({ code: EngineProblemCode.MISSING_REFERENCE, message, node_id: nodeId });
	}

	// ---- arming ----------------------------------------------------------------------------------------

	private arm(loaded: Loaded): void {
		const subscription = { live: true };

		loaded.subscription = subscription;
		loaded.owners = new Map();
		loaded.armedTriggers = 0;

		for (const { node, registered } of loaded.compiled) {
			const owner = registered.owner;
			const enabled = this.ownerEnabled(owner);

			if (owner) {
				loaded.owners.set(ownerKey(owner), { owner, enabled });
			}

			if (node.kind !== 'trigger' || !enabled) continue;

			try {
				const release = (registered.definition as AutomationTriggerNodeType).subscribe(
					node.config,
					(data) => {
						if (!subscription.live) return;

						// A trigger is called from wherever its event comes from; nothing may be thrown back there
						this.safely<unknown>(() => this.fire(loaded, node.id, isRecord(data) ? data : {}, false), undefined);
					},
					{ automationId: loaded.def.id, nodeId: node.id },
				);

				if (typeof release === 'function') {
					loaded.releases.push(release);
				}

				loaded.armedTriggers += 1;
			} catch (error) {
				this.hook('error', error, `arming a trigger of automation ${loaded.def.id}`);

				this.disarm(loaded);

				loaded.status = 'invalid';
				loaded.problems.push({
					code: EngineProblemCode.TRIGGER_FAILED,
					message: 'The trigger could not be started.',
					node_id: node.id,
				});

				return;
			}
		}

		if (!this.options.holdReference) return;

		const held = new Set<string>();

		for (const { reference } of loaded.references) {
			const key = referenceKey(reference);

			if (held.has(key)) continue;

			held.add(key);

			const release = this.safely<(() => void) | undefined>(() => this.options.holdReference?.(reference), undefined);

			if (typeof release === 'function') {
				loaded.releases.push(release);
			}
		}
	}

	private disarm(loaded: Loaded): void {
		loaded.subscription.live = false;
		loaded.armedTriggers = 0;

		for (const release of loaded.releases.splice(0)) {
			this.safely<unknown>(release, undefined);
		}
	}

	private teardown(loaded: Loaded, reason: string, status: RunEndStatus = 'cancelled'): void {
		this.disarm(loaded);

		for (const run of [...loaded.active]) {
			run.cancel(reason, status);
		}
	}

	private ownerEnabled(owner: AutomationNodeTypeOwner | undefined): boolean {
		if (!owner || !this.options.isOwnerEnabled) return true;

		return this.safely(() => this.options.isOwnerEnabled?.(owner) === true, false);
	}

	// ---- a trigger fired -------------------------------------------------------------------------------

	private fire(loaded: Loaded, nodeId: string, data: AutomationTriggerData, manual: boolean): TriggerOutcome {
		const plan = loaded.plan;

		if (this.automations.get(loaded.def.id) !== loaded || loaded.status !== 'ok' || !plan) {
			return { outcome: 'refused', code: 'disabled', reason: 'The automation is not running.' };
		}

		const skip = (outcome: 'ignored' | 'dropped', reason: string): TriggerOutcome => {
			loaded.counters[outcome] += 1;
			loaded.lastSkipped = { outcome, reason, nodeId, at: this.wallNow() };

			return { outcome, reason };
		};

		if (!manual) {
			// The plugin may have been disabled since the trigger was armed
			const owner = loaded.compiled.find(({ node }) => node.id === nodeId)?.registered.owner;

			if (!this.ownerEnabled(owner)) {
				return skip('ignored', `The ${owner?.kind ?? 'plugin'} this trigger belongs to is disabled.`);
			}
		}

		const decision = decideRunStart({
			mode: loaded.def.mode,
			activeRuns: loaded.active.size,
			maxParallelRuns: this.limits.maxParallelRuns,
		});

		if (decision.type !== 'start') {
			return skip(decision.type === 'ignore' ? 'ignored' : 'dropped', decision.reason);
		}

		const now = this.clock.now();
		const exceeded = loaded.guard.exceeded(now);

		if (exceeded) {
			const reason = `The automation started ${describeRunRateWindow(exceeded)}.`;

			this.suspend(loaded, reason);

			return { outcome: 'suspended', reason };
		}

		if (decision.cancelActive) {
			for (const run of [...loaded.active]) {
				run.cancel('restarted');
			}
		}

		if (this.activeRuns >= this.limits.maxConcurrentRuns) {
			return skip('dropped', `The limit of ${this.limits.maxConcurrentRuns} concurrent runs is reached.`);
		}

		loaded.guard.record(now);
		loaded.counters.started += 1;
		loaded.lastTriggeredAt = this.wallNow();

		return { outcome: 'started', runId: this.startRun(loaded, plan, nodeId, data, manual) };
	}

	private suspend(loaded: Loaded, reason: string): void {
		const previous = loaded.status;

		loaded.status = 'suspended';
		loaded.suspendedReason = reason;

		this.teardown(loaded, 'suspended');

		this.hook('statusChanged', this.snapshot(loaded), previous);
	}

	private startRun(
		loaded: Loaded,
		plan: RunPlan,
		nodeId: string,
		data: AutomationTriggerData,
		manual: boolean,
	): string {
		const owners = new Map(loaded.compiled.map(({ node, registered }) => [node.id, registered.owner]));

		const walker: RunWalker = new RunWalker({
			plan,
			clock: this.clock,
			wallNow: this.wallNow,
			runId: this.generateRunId(),
			automationId: loaded.def.id,
			revision: loaded.def.revision,
			trigger: { nodeId, data, manual },
			maxSteps: this.limits.maxRunSteps,
			beforeExecute: (node) => this.gate(loaded, node, owners.get(node.id)),
			observer: {
				parked: (record) => this.hook('runParked', record),
				ended: (record) => {
					if (loaded.active.delete(walker)) {
						this.activeRuns -= 1;
					}

					loaded.lastRunStatus = record.status as RunEndStatus;

					this.hook('runEnded', record);
				},
				settled: (record) => this.hook('runSettled', record),
				error: (error) => this.hook('error', error, 'reporting a run'),
			},
		});

		loaded.active.add(walker);
		this.activeRuns += 1;

		this.hook('runStarted', walker.record);

		walker.start();

		return walker.record.id;
	}

	/** Checked before every condition, action and delay (ADR 0003, decision 13) */
	private gate(loaded: Loaded, node: RunPlanGatedNode, owner: AutomationNodeTypeOwner | undefined): RunGate {
		if (!this.ownerEnabled(owner)) {
			return { allow: false, reason: `The ${owner?.kind ?? 'plugin'} this block belongs to is disabled.` };
		}

		if (node.kind === 'action' && this.options.actionPolicy) {
			const policy = this.options.actionPolicy;
			// A policy that fails must not let the action through
			const verdict = this.safely<ActionPolicyVerdict>(
				() => policy({ automationId: loaded.def.id, nodeId: node.id, type: node.type, config: node.config }),
				{ allow: false, reason: 'The safety policy could not be checked.' },
			);

			if (!verdict || verdict.allow !== true) {
				return { allow: false, reason: verdict?.reason ?? 'The action was refused by the safety policy.' };
			}
		}

		return { allow: true };
	}

	// ---- helpers ---------------------------------------------------------------------------------------

	private snapshot(loaded: Loaded): EngineAutomationState {
		return {
			id: loaded.def.id,
			revision: loaded.def.revision,
			enabled: loaded.def.enabled,
			mode: loaded.def.mode,
			status: loaded.status,
			armed: loaded.subscription.live,
			armedTriggers: loaded.armedTriggers,
			activeRuns: loaded.active.size,
			triggers: { ...loaded.counters },
			...(loaded.lastSkipped ? { lastSkipped: { ...loaded.lastSkipped } } : {}),
			...(loaded.lastTriggeredAt !== undefined ? { lastTriggeredAt: loaded.lastTriggeredAt } : {}),
			...(loaded.lastRunStatus !== undefined ? { lastRunStatus: loaded.lastRunStatus } : {}),
			problems: loaded.status === 'invalid' ? loaded.problems.map((problem) => ({ ...problem })) : [],
			...(loaded.status === 'suspended' && loaded.suspendedReason !== undefined
				? { suspendedReason: loaded.suspendedReason }
				: {}),
		};
	}

	private enqueue<T>(operation: () => T | Promise<T>): Promise<T> {
		const result = this.queue.then(operation);

		this.queue = result.catch((error: unknown) => {
			this.hook('error', error, 'applying a change to the engine');
		});

		return result;
	}

	private safely<T>(call: () => T, fallback: T): T {
		try {
			return call();
		} catch (error) {
			this.hook('error', error, 'calling into a node type');

			return fallback;
		}
	}

	private hook<K extends keyof EngineHooks>(name: K, ...args: Parameters<NonNullable<EngineHooks[K]>>): void {
		try {
			(this.hooks[name] as ((...hookArgs: unknown[]) => void) | undefined)?.(...args);
		} catch (error) {
			if (name === 'error') return;

			try {
				this.hooks.error?.(error, `the ${name} hook`);
			} catch {
				// A hook that cannot even report its failure is left alone
			}
		}
	}
}

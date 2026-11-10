// Automation engine: subscriptions, modes, guards and the token walk. Framework-free, in-memory.
import { indexGraph, validateGraph } from './graph.ts';
import type { Graph, GraphEdge, GraphIndex, GraphNode, NodeType, NodeTypeRegistry, ValidationResult } from './graph.ts';
import { MAX_DELAY_SECONDS, watchSpec } from './nodes.ts';
import { holds, systemClock } from './tracker.ts';
import type { Clock, StateTracker } from './tracker.ts';

export type Mode = 'single' | 'restart' | 'parallel';
export type AutomationStatus = 'ok' | 'invalid' | 'suspended';
export type RunStatus = 'running' | 'completed' | 'failed' | 'cancelled';

export interface Automation {
	id: string;
	enabled: boolean;
	mode: Mode;
	revision: number;
	graph: Graph;
}

export interface TraceStep {
	seq: number;
	at: number;
	nodeId: string;
	type: string;
	kind: string;
	via?: string;
	/** output port taken, or a flow marker: parked | waiting | absorbed | cancelled | unsatisfied */
	output?: string;
	observed?: unknown;
	reason?: string;
	result?: { success: boolean; reason?: string };
	refused?: boolean;
	/** the node finished after the run was cancelled; its output was not followed */
	afterCancel?: boolean;
	detail?: Record<string, unknown>;
}

export interface RunRecord {
	id: number;
	automationId: string;
	revision: number;
	triggerNodeId: string;
	triggerData: unknown;
	startedAt: number;
	finishedAt?: number;
	status: RunStatus;
	endReason?: string;
	steps: TraceStep[];
}

export interface SafetyRequest {
	automationId: string;
	nodeId: string;
	type: string;
	config: Record<string, unknown>;
}

export interface EngineOptions {
	registry: NodeTypeRegistry;
	tracker: StateTracker;
	clock?: Clock;
	timezone?: string;
	/** handed to node handlers as ctx.services (device writes etc.) */
	services?: Record<string, unknown>;
	safetyPolicy?: (req: SafetyRequest) => { allow: boolean; reason?: string };
	notify?: (n: { automationId: string; kind: 'suspended'; message: string }) => void;
	/** key design question: what does `restart` cancel? */
	restartScope?: 'automation' | 'trigger';
	maxRunsPerMinute?: number;
	maxParallel?: number;
	maxConcurrentRuns?: number;
	maxNodes?: number;
	historySize?: number;
}

export interface TriggerLogEntry {
	at: number;
	triggerNodeId: string;
	outcome: 'started' | 'ignored' | 'dropped' | 'suspended';
	reason?: string;
}

interface Parked {
	cancel(): void;
}

interface Run {
	record: RunRecord;
	loaded: Loaded;
	tokens: number;
	cancelled: boolean;
	done: boolean;
	unhandledErrors: number;
	parked: Set<Parked>;
	joins: Map<string, { arrived: Set<string>; fired: boolean }>;
	seq: number;
}

interface Loaded {
	def: Automation;
	status: AutomationStatus;
	validation: ValidationResult;
	index: GraphIndex;
	unsubs: (() => void)[];
	active: Set<Run>;
	starts: number[];
	history: RunRecord[];
	triggerLog: TriggerLogEntry[];
	lastTriggeredAt?: number;
	lastRunStatus?: RunStatus;
}

export class AutomationEngine {
	private readonly o: Required<Omit<EngineOptions, 'safetyPolicy' | 'notify'>> & Pick<EngineOptions, 'safetyPolicy' | 'notify'>;
	private readonly automations = new Map<string, Loaded>();
	private runSeq = 0;
	private activeRuns = 0;

	constructor(opts: EngineOptions) {
		this.o = {
			clock: systemClock,
			timezone: 'UTC',
			services: {},
			restartScope: 'automation',
			maxRunsPerMinute: 30,
			maxParallel: 10,
			maxConcurrentRuns: 50,
			maxNodes: 100,
			historySize: 50,
			...opts,
		};
	}

	// ---- lifecycle ---------------------------------------------------------------------------------

	/** Create or replace an automation. A change of graph, mode or enabled cancels its active runs. */
	load(def: Automation): ValidationResult {
		const prev = this.automations.get(def.id);
		if (prev) {
			const same =
				prev.def.enabled === def.enabled &&
				prev.def.mode === def.mode &&
				JSON.stringify(prev.def.graph) === JSON.stringify(def.graph);
			if (same && prev.status !== 'suspended') {
				prev.def = def; // metadata-only save: runs, timers and subscriptions are untouched
				return prev.validation;
			}
			this.teardown(prev, def.enabled ? 'automation_updated' : 'automation_disabled');
		}
		const validation = validateGraph(def.graph, this.o.registry, { maxNodes: this.o.maxNodes });
		const loaded: Loaded = {
			def,
			status: validation.valid ? 'ok' : 'invalid',
			validation,
			index: indexGraph(validation.valid ? def.graph : { version: 1, nodes: [], edges: [] }, this.o.registry),
			unsubs: [],
			active: new Set(),
			starts: [],
			history: prev?.history ?? [],
			triggerLog: prev?.triggerLog ?? [],
			lastTriggeredAt: prev?.lastTriggeredAt,
			lastRunStatus: prev?.lastRunStatus,
		};
		this.automations.set(def.id, loaded);
		if (validation.valid && def.enabled) this.subscribe(loaded);
		return validation;
	}

	remove(id: string): void {
		const a = this.automations.get(id);
		if (!a) return;
		this.teardown(a, 'automation_deleted');
		this.automations.delete(id);
	}

	setEnabled(id: string, enabled: boolean): void {
		const a = this.must(id);
		this.load({ ...a.def, enabled });
	}

	/** Manual start at a trigger node (default: the first trigger). */
	trigger(id: string, nodeId?: string, data: unknown = { manual: true }): boolean {
		const a = this.must(id);
		const start = nodeId ?? [...a.index.reach.keys()][0];
		if (!start || !a.index.reach.has(start)) return false;
		return this.onTrigger(a, start, data);
	}

	status(id: string): AutomationStatus {
		return this.must(id).status;
	}

	runs(id: string): RunRecord[] {
		const a = this.must(id);
		return [...a.history, ...[...a.active].map((r) => r.record)].sort((x, y) => x.id - y.id);
	}

	activeCount(id: string): number {
		return this.must(id).active.size;
	}

	subscriptionCount(id: string): number {
		return this.must(id).unsubs.length;
	}

	triggerLog(id: string): TriggerLogEntry[] {
		return this.must(id).triggerLog;
	}

	info(id: string): { lastTriggeredAt?: number; lastRunStatus?: RunStatus } {
		const a = this.must(id);
		return { lastTriggeredAt: a.lastTriggeredAt, lastRunStatus: a.lastRunStatus };
	}

	private must(id: string): Loaded {
		const a = this.automations.get(id);
		if (!a) throw new Error(`unknown automation ${id}`);
		return a;
	}

	private ctx(a: Loaded, run?: Run): Record<string, unknown> {
		return {
			tracker: this.o.tracker,
			clock: this.o.clock,
			timezone: this.o.timezone,
			services: this.o.services,
			automationId: a.def.id,
			runId: run?.record.id,
		};
	}

	private subscribe(a: Loaded): void {
		for (const node of a.def.graph.nodes) {
			const type = this.o.registry.get(node.type)!;
			if (type.kind === 'trigger') {
				a.unsubs.push(type.subscribe!(node.config, this.ctx(a), (data) => void this.onTrigger(a, node.id, data)));
			} else {
				// Conditions and waits need a last-seen value before the first run reaches them.
				for (const p of type.reads?.(node.config) ?? []) a.unsubs.push(this.o.tracker.reference(p));
			}
		}
	}

	private teardown(a: Loaded, reason: string): void {
		for (const u of a.unsubs.splice(0)) u();
		for (const run of [...a.active]) this.cancel(run, reason);
	}

	// ---- trigger dispatch: mode, guards ------------------------------------------------------------

	private onTrigger(a: Loaded, nodeId: string, data: unknown): boolean {
		if (a.status !== 'ok' || this.automations.get(a.def.id) !== a) return false;
		const wall = this.o.clock.wallNow();
		const log = (outcome: TriggerLogEntry['outcome'], reason?: string): void => {
			a.triggerLog.push({ at: wall, triggerNodeId: nodeId, outcome, reason });
			if (a.triggerLog.length > 200) a.triggerLog.shift();
		};

		if (a.def.mode === 'single' && a.active.size > 0) {
			log('ignored', 'single: a run is active');
			return false;
		}
		if (a.def.mode === 'parallel' && a.active.size >= this.o.maxParallel) {
			log('dropped', `parallel cap ${this.o.maxParallel}`);
			return false;
		}

		// Rate guard: counts started runs in a sliding 60 s window on the monotonic clock.
		const now = this.o.clock.monoNow();
		a.starts = a.starts.filter((t) => now - t < 60_000);
		if (a.starts.length >= this.o.maxRunsPerMinute) {
			log('suspended', `more than ${this.o.maxRunsPerMinute} runs per minute`);
			this.suspend(a);
			return false;
		}

		if (a.def.mode === 'restart') {
			for (const run of [...a.active]) {
				if (this.o.restartScope === 'automation' || run.record.triggerNodeId === nodeId) this.cancel(run, 'restarted');
			}
		}
		if (this.activeRuns >= this.o.maxConcurrentRuns) {
			log('dropped', `global concurrent run cap ${this.o.maxConcurrentRuns}`);
			return false;
		}

		a.starts.push(now);
		a.lastTriggeredAt = wall;
		log('started');
		this.startRun(a, nodeId, data);
		return true;
	}

	private suspend(a: Loaded): void {
		a.status = 'suspended';
		this.teardown(a, 'suspended');
		this.o.notify?.({
			automationId: a.def.id,
			kind: 'suspended',
			message: `Automation ${a.def.id} was suspended: more than ${this.o.maxRunsPerMinute} runs per minute`,
		});
	}

	// ---- token walk --------------------------------------------------------------------------------

	private startRun(a: Loaded, nodeId: string, data: unknown): void {
		const run: Run = {
			record: {
				id: ++this.runSeq,
				automationId: a.def.id,
				revision: a.def.revision,
				triggerNodeId: nodeId,
				triggerData: data,
				startedAt: this.o.clock.wallNow(),
				status: 'running',
				steps: [],
			},
			loaded: a,
			tokens: 0,
			cancelled: false,
			done: false,
			unhandledErrors: 0,
			parked: new Set(),
			joins: new Map(),
			seq: 0,
		};
		a.active.add(run);
		this.activeRuns++;
		this.emit(run, nodeId, 'out');
		this.settle(run);
	}

	/** Put one token on every edge leaving `port`, in graph.edges order. Returns the number of edges. */
	private emit(run: Run, nodeId: string, port: string): number {
		const edges = run.loaded.index.out.get(`${nodeId}:${port}`) ?? [];
		for (const edge of edges) {
			run.tokens++;
			this.process(run, edge)
				.catch((err: unknown) => {
					this.step(run, run.loaded.index.nodes.get(edge.target)!, edge, { output: 'error', reason: `engine error: ${String(err)}` });
					run.unhandledErrors++;
				})
				.finally(() => {
					run.tokens--;
					this.settle(run);
				});
		}
		return edges.length;
	}

	private step(run: Run, node: GraphNode, edge: GraphEdge | undefined, fields: Partial<TraceStep>): TraceStep {
		const type = this.o.registry.get(node.type)!;
		const s: TraceStep = {
			seq: ++run.seq,
			at: this.o.clock.wallNow(),
			nodeId: node.id,
			type: node.type,
			kind: type.kind,
			via: edge?.id,
			...fields,
		};
		run.record.steps.push(s);
		return s;
	}

	private async process(run: Run, edge: GraphEdge): Promise<void> {
		if (run.cancelled) return;
		const node = run.loaded.index.nodes.get(edge.target)!;
		const type = this.o.registry.get(node.type)!;
		switch (type.kind) {
			case 'condition':
				return this.runCondition(run, node, type, edge);
			case 'action':
				return this.runAction(run, node, type, edge);
			case 'flow':
				return this.runFlow(run, node, type, edge);
			default:
				throw new Error(`token reached a ${type.kind} node`);
		}
	}

	private async runCondition(run: Run, node: GraphNode, type: NodeType, edge: GraphEdge): Promise<void> {
		let res;
		try {
			res = await type.evaluate!(node.config, this.ctx(run.loaded, run));
		} catch (err) {
			res = { result: false, reason: `condition failed: ${String(err)}` }; // a broken condition is not true
		}
		const output = res.result ? 'yes' : 'no';
		const s = this.step(run, node, edge, { output, observed: res.observed, reason: res.reason });
		if (run.cancelled) {
			s.afterCancel = true;
			return;
		}
		this.emit(run, node.id, output);
	}

	private async runAction(run: Run, node: GraphNode, type: NodeType, edge: GraphEdge): Promise<void> {
		let result: { success: boolean; reason?: string };
		let refused = false;
		const verdict = this.o.safetyPolicy?.({
			automationId: run.loaded.def.id,
			nodeId: node.id,
			type: node.type,
			config: node.config,
		});
		if (verdict && !verdict.allow) {
			refused = true;
			result = { success: false, reason: verdict.reason ?? 'refused by safety policy' };
		} else {
			try {
				result = await type.execute!(node.config, this.ctx(run.loaded, run));
			} catch (err) {
				result = { success: false, reason: err instanceof Error ? err.message : String(err) };
			}
		}
		const output = result.success ? 'done' : 'error';
		const s = this.step(run, node, edge, { output, result, reason: result.reason });
		if (refused) s.refused = true;
		if (run.cancelled) {
			// The side effect already happened and cannot be recalled; record it, do not continue.
			s.afterCancel = true;
			return;
		}
		const followed = this.emit(run, node.id, output);
		if (output === 'error' && followed === 0) run.unhandledErrors++;
	}

	private async runFlow(run: Run, node: GraphNode, type: NodeType, edge: GraphEdge): Promise<void> {
		switch (type.flow) {
			case 'delay': {
				const ms = Math.min(Number(node.config.seconds), MAX_DELAY_SECONDS) * 1000;
				const s = this.step(run, node, edge, { output: 'parked', detail: { ms } });
				const outcome = await this.park(run, ms);
				if (outcome !== 'timer') {
					s.output = 'cancelled';
					return;
				}
				s.output = 'out';
				s.detail = { ms, resumedAt: this.o.clock.wallNow() };
				this.emit(run, node.id, 'out');
				return;
			}
			case 'wait': {
				const spec = { ...watchSpec(node.config), mode: 'level' as const };
				const now = this.o.tracker.read(spec.propertyId);
				if (now.status === 'ok' && holds(spec, now.value)) {
					this.step(run, node, edge, { output: 'out', observed: now.value, reason: 'already true on arrival' });
					this.emit(run, node.id, 'out');
					return;
				}
				const s = this.step(run, node, edge, { output: 'waiting', observed: now.value, reason: `property is ${now.status}` });
				let seen: unknown;
				const outcome = await this.park(run, Number(node.config.timeout_seconds) * 1000, (resolve) =>
					this.o.tracker.watch(spec, (d) => {
						seen = d.to;
						resolve();
					}),
				);
				if (outcome === 'cancelled') {
					s.output = 'cancelled';
					return;
				}
				s.output = outcome === 'event' ? 'out' : 'timeout';
				s.reason = undefined;
				if (outcome === 'event') s.observed = seen;
				this.emit(run, node.id, s.output);
				return;
			}
			case 'any':
			case 'all': {
				let j = run.joins.get(node.id);
				if (!j) run.joins.set(node.id, (j = { arrived: new Set(), fired: false }));
				j.arrived.add(edge.id);
				if (j.fired) {
					this.step(run, node, edge, { output: 'absorbed', reason: 'join already fired in this run' });
					return;
				}
				const expected = (run.loaded.index.incoming.get(node.id) ?? []).map((e) => e.id);
				if (type.flow === 'all' && !expected.every((id) => j.arrived.has(id))) {
					this.step(run, node, edge, { output: 'waiting', detail: { arrived: j.arrived.size, expected: expected.length } });
					return; // a token resting at a join is not active: the run may end around it
				}
				j.fired = true;
				this.step(run, node, edge, { output: 'out' });
				this.emit(run, node.id, 'out');
				return;
			}
			default:
				throw new Error(`unknown flow behaviour on ${node.type}`);
		}
	}

	/** Park a token on a timer, optionally also on an event subscription. */
	private park(run: Run, ms: number, subscribe?: (resolve: () => void) => () => void): Promise<'timer' | 'event' | 'cancelled'> {
		return new Promise((resolve) => {
			let unsub: (() => void) | undefined;
			const finish = (outcome: 'timer' | 'event' | 'cancelled'): void => {
				if (!run.parked.delete(entry)) return;
				this.o.clock.clearTimeout(handle);
				unsub?.();
				resolve(outcome);
			};
			const entry: Parked = { cancel: () => finish('cancelled') };
			run.parked.add(entry);
			const handle = this.o.clock.setTimeout(() => finish('timer'), ms);
			unsub = subscribe?.(() => finish('event'));
		});
	}

	private cancel(run: Run, reason: string): void {
		if (run.done) return;
		run.cancelled = true;
		for (const p of [...run.parked]) p.cancel();
		this.finish(run, 'cancelled', reason);
	}

	private settle(run: Run): void {
		if (run.done || run.tokens > 0) return;
		for (const [nodeId, j] of run.joins) {
			if (j.fired) continue;
			const node = run.loaded.index.nodes.get(nodeId)!;
			const missing = (run.loaded.index.incoming.get(nodeId) ?? []).map((e) => e.id).filter((id) => !j.arrived.has(id));
			this.step(run, node, undefined, { output: 'unsatisfied', reason: 'run ended before all inputs arrived', detail: { missing } });
		}
		this.finish(run, run.unhandledErrors > 0 ? 'failed' : 'completed');
	}

	private finish(run: Run, status: RunStatus, reason?: string): void {
		run.done = true;
		run.record.status = status;
		run.record.endReason = reason;
		run.record.finishedAt = this.o.clock.wallNow();
		const a = run.loaded;
		a.active.delete(run);
		this.activeRuns--;
		a.lastRunStatus = status;
		a.history.push(run.record);
		while (a.history.length > this.o.historySize) a.history.shift();
	}
}

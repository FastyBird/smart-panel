// Graph model, node type registry and structural validator. Framework-free.

export interface GraphNode {
	id: string;
	type: string;
	config: Record<string, unknown>;
}

export interface GraphEdge {
	id: string;
	source: string;
	source_port: string;
	target: string;
	target_port: string;
}

export interface Graph {
	version: number;
	nodes: GraphNode[];
	edges: GraphEdge[];
}

export type NodeKind = 'trigger' | 'condition' | 'action' | 'flow';
export type FlowBehaviour = 'delay' | 'any' | 'all' | 'wait';

export interface ConditionResult {
	result: boolean;
	observed?: unknown;
	reason?: string;
}

export interface ActionResult {
	success: boolean;
	reason?: string;
}

// `ctx` is typed loosely here so that graph.ts has no dependency on the engine.
export interface NodeType {
	type: string;
	kind: NodeKind;
	ports: { inputs: string[]; outputs: string[] };
	flow?: FlowBehaviour;
	validateConfig?(config: Record<string, unknown>): string[];
	/** property ids this node reads (conditions, triggers, wait-until) */
	reads?(config: Record<string, unknown>): string[];
	/** property ids this node writes (actions) */
	writes?(config: Record<string, unknown>): string[];
	subscribe?(config: any, ctx: any, fire: (data: unknown) => void): () => void;
	evaluate?(config: any, ctx: any): ConditionResult | Promise<ConditionResult>;
	execute?(config: any, ctx: any): ActionResult | Promise<ActionResult>;
}

export class NodeTypeRegistry {
	private readonly types = new Map<string, NodeType>();

	register(nodeType: NodeType): void {
		if (this.types.has(nodeType.type)) throw new Error(`node type ${nodeType.type} already registered`);
		this.types.set(nodeType.type, nodeType);
	}

	get(type: string): NodeType | undefined {
		return this.types.get(type);
	}

	list(): NodeType[] {
		return [...this.types.values()];
	}
}

export interface Issue {
	code: string;
	message: string;
	nodeId?: string;
	edgeId?: string;
}

export interface ValidationResult {
	valid: boolean;
	errors: Issue[];
	warnings: Issue[];
}

export interface GraphIndex {
	nodes: Map<string, GraphNode>;
	/** key `${nodeId}:${port}` → outgoing edges, in graph.edges order */
	out: Map<string, GraphEdge[]>;
	incoming: Map<string, GraphEdge[]>;
	/** trigger id → every node reachable from it (trigger included) */
	reach: Map<string, Set<string>>;
}

export function indexGraph(graph: Graph, registry: NodeTypeRegistry): GraphIndex {
	const nodes = new Map<string, GraphNode>();
	for (const n of graph.nodes) nodes.set(n.id, n);
	const out = new Map<string, GraphEdge[]>();
	const incoming = new Map<string, GraphEdge[]>();
	const succ = new Map<string, string[]>();
	for (const e of graph.edges) {
		const k = `${e.source}:${e.source_port}`;
		if (!out.has(k)) out.set(k, []);
		out.get(k)!.push(e);
		if (!incoming.has(e.target)) incoming.set(e.target, []);
		incoming.get(e.target)!.push(e);
		if (!succ.has(e.source)) succ.set(e.source, []);
		succ.get(e.source)!.push(e.target);
	}
	const reach = new Map<string, Set<string>>();
	for (const n of graph.nodes) {
		if (registry.get(n.type)?.kind !== 'trigger') continue;
		const seen = new Set<string>([n.id]);
		const stack = [n.id];
		while (stack.length) {
			for (const t of succ.get(stack.pop()!) ?? []) {
				if (!seen.has(t)) {
					seen.add(t);
					stack.push(t);
				}
			}
		}
		reach.set(n.id, seen);
	}
	return { nodes, out, incoming, reach };
}

export interface ValidateOptions {
	maxNodes?: number;
}

export function validateGraph(graph: Graph, registry: NodeTypeRegistry, opts: ValidateOptions = {}): ValidationResult {
	const errors: Issue[] = [];
	const warnings: Issue[] = [];
	const maxNodes = opts.maxNodes ?? 100;

	if (graph.version !== 1) errors.push({ code: 'unsupported_version', message: `graph version ${graph.version}` });
	if (graph.nodes.length > maxNodes) {
		errors.push({ code: 'too_many_nodes', message: `${graph.nodes.length} nodes, limit is ${maxNodes}` });
	}

	const nodes = new Map<string, GraphNode>();
	for (const n of graph.nodes) {
		if (nodes.has(n.id)) errors.push({ code: 'duplicate_node_id', nodeId: n.id, message: `duplicate node id ${n.id}` });
		nodes.set(n.id, n);
		const t = registry.get(n.type);
		if (!t) {
			errors.push({ code: 'unknown_node_type', nodeId: n.id, message: `unknown node type ${n.type}` });
			continue;
		}
		for (const m of t.validateConfig?.(n.config) ?? []) {
			errors.push({ code: 'invalid_config', nodeId: n.id, message: m });
		}
	}

	const triggers = graph.nodes.filter((n) => registry.get(n.type)?.kind === 'trigger');
	if (triggers.length === 0) errors.push({ code: 'no_trigger', message: 'at least one trigger is required' });

	const edgeIds = new Set<string>();
	const edgeKeys = new Set<string>();
	const goodEdges: GraphEdge[] = [];
	for (const e of graph.edges) {
		if (edgeIds.has(e.id)) errors.push({ code: 'duplicate_edge_id', edgeId: e.id, message: `duplicate edge id ${e.id}` });
		edgeIds.add(e.id);
		const s = nodes.get(e.source);
		const t = nodes.get(e.target);
		if (!s || !t) {
			errors.push({ code: 'dangling_edge', edgeId: e.id, message: `edge ${e.id} references a missing node` });
			continue;
		}
		const st = registry.get(s.type);
		const tt = registry.get(t.type);
		if (!st || !tt) continue; // already reported as unknown type
		let ok = true;
		if (tt.kind === 'trigger') {
			errors.push({ code: 'edge_into_trigger', edgeId: e.id, nodeId: t.id, message: `edge ${e.id} targets trigger ${t.id}` });
			ok = false;
		} else if (!tt.ports.inputs.includes(e.target_port)) {
			errors.push({
				code: 'unknown_port',
				edgeId: e.id,
				nodeId: t.id,
				message: `${tt.type} has no input port "${e.target_port}"`,
			});
			ok = false;
		}
		if (!st.ports.outputs.includes(e.source_port)) {
			errors.push({
				code: 'unknown_port',
				edgeId: e.id,
				nodeId: s.id,
				message: `${st.type} has no output port "${e.source_port}"`,
			});
			ok = false;
		}
		const key = `${e.source}:${e.source_port}>${e.target}:${e.target_port}`;
		if (edgeKeys.has(key)) {
			errors.push({ code: 'duplicate_edge', edgeId: e.id, message: `edge ${e.id} duplicates another edge` });
			ok = false;
		}
		edgeKeys.add(key);
		if (ok) goodEdges.push(e);
	}

	// Cycles (iterative three-colour DFS over the structurally valid edges).
	const succ = new Map<string, string[]>();
	for (const e of goodEdges) {
		if (!succ.has(e.source)) succ.set(e.source, []);
		succ.get(e.source)!.push(e.target);
	}
	const colour = new Map<string, number>();
	const inCycle = new Set<string>();
	const visit = (start: string): void => {
		const stack: { id: string; i: number }[] = [{ id: start, i: 0 }];
		colour.set(start, 1);
		while (stack.length) {
			const top = stack[stack.length - 1];
			const next = (succ.get(top.id) ?? [])[top.i++];
			if (next === undefined) {
				colour.set(top.id, 2);
				stack.pop();
			} else if (colour.get(next) === 1) {
				const from = stack.findIndex((f) => f.id === next);
				for (const f of stack.slice(from)) inCycle.add(f.id);
			} else if (!colour.has(next)) {
				colour.set(next, 1);
				stack.push({ id: next, i: 0 });
			}
		}
	};
	for (const n of graph.nodes) if (!colour.has(n.id)) visit(n.id);
	if (inCycle.size) {
		errors.push({ code: 'cycle', message: `cycle through nodes: ${[...inCycle].sort().join(', ')}` });
	}

	// Reachability → warnings only, so a half-drawn canvas can be saved.
	const cleaned: Graph = { version: graph.version, nodes: graph.nodes, edges: goodEdges };
	const index = indexGraph(cleaned, registry);
	const reachable = new Set<string>();
	for (const set of index.reach.values()) for (const id of set) reachable.add(id);
	for (const n of graph.nodes) {
		const t = registry.get(n.type);
		if (t && t.kind !== 'trigger' && !reachable.has(n.id)) {
			warnings.push({ code: 'unreachable', nodeId: n.id, message: `node ${n.id} is not reachable from any trigger` });
		}
	}

	// Spike additions (not in the design doc): joins that can never complete, and self-triggering writes.
	for (const n of graph.nodes) {
		if (registry.get(n.type)?.flow !== 'all') continue;
		const sources = (index.incoming.get(n.id) ?? []).map((e) => e.source);
		if (sources.length === 0) continue;
		const reaching = [...index.reach.entries()].filter(([, set]) => set.has(n.id));
		const complete = reaching.filter(([, set]) => sources.every((s) => set.has(s)));
		if (reaching.length > 0 && complete.length === 0) {
			errors.push({
				code: 'all_never_completes',
				nodeId: n.id,
				message: `All node ${n.id} joins branches that no single trigger can reach together`,
			});
		} else {
			for (const [trig] of reaching) {
				if (!complete.some(([c]) => c === trig)) {
					warnings.push({
						code: 'all_partial_trigger',
						nodeId: n.id,
						message: `runs started by trigger ${trig} can never complete All node ${n.id}`,
					});
				}
			}
		}
	}
	const watched = new Map<string, string>();
	for (const n of triggers) for (const p of registry.get(n.type)?.reads?.(n.config) ?? []) watched.set(p, n.id);
	for (const n of graph.nodes) {
		for (const p of registry.get(n.type)?.writes?.(n.config) ?? []) {
			if (watched.has(p)) {
				warnings.push({
					code: 'writes_own_trigger',
					nodeId: n.id,
					message: `node ${n.id} writes property ${p} watched by trigger ${watched.get(p)}`,
				});
			}
		}
	}

	return { valid: errors.length === 0, errors, warnings };
}

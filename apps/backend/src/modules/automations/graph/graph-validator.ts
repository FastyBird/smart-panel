/**
 * Validates an automation graph against the registered node types.
 *
 * Framework-free (ADR 0003, decision 15). The shape of the graph document - unique identifiers, edges that
 * connect existing nodes, the version and the size limits - is checked where the document enters the
 * system, not here. This validator therefore skips whatever it cannot read instead of reporting it, and it
 * never throws, whatever it is given.
 */
import { AutomationNodeConfig, AutomationNodeTypeLookup, RegisteredAutomationNodeType } from './node-type';

export type AutomationGraphIssueSeverity = 'error' | 'warning';

export const AutomationGraphIssueCode = {
	UNKNOWN_NODE_TYPE: 'unknown_node_type',
	INVALID_CONFIG: 'invalid_config',
	UNKNOWN_PORT: 'unknown_port',
	EDGE_INTO_TRIGGER: 'edge_into_trigger',
	CYCLE: 'cycle',
	DUPLICATE_EDGE: 'duplicate_edge',
	NO_TRIGGER: 'no_trigger',
	UNREACHABLE_NODE: 'unreachable_node',
	/** An action would unlock, disarm or open, which an automation may not do */
	SAFETY_REDUCING_ACTION: 'safety_reducing_action',
	/** An All is fed from triggers none of which leads to every one of its incoming edges, so it never continues */
	JOIN_NEVER_COMPLETES: 'join_never_completes',
	/** An All can be completed by a run of some of the triggers leading to it, but not by every one */
	JOIN_PARTLY_COMPLETES: 'join_partly_completes',
} as const;

export type AutomationGraphIssueCode = (typeof AutomationGraphIssueCode)[keyof typeof AutomationGraphIssueCode];

export interface AutomationGraphIssue {
	severity: AutomationGraphIssueSeverity;
	code: AutomationGraphIssueCode;
	message: string;
	/** The node the issue is about */
	node_id?: string;
	/** The edge the issue is about */
	edge_id?: string;
	/** Every node taking part, for an issue that is about several nodes (a cycle) */
	node_ids?: string[];
	/** The configuration field the issue is about, for `invalid_config` */
	field?: string;
}

/**
 * What a safety check found on one node. An `error` is something the node itself would do; a `warning`
 * is something that is checked again when the node runs, such as the present content of a scene.
 */
export interface AutomationGraphSafetyFinding {
	severity: AutomationGraphIssueSeverity;
	message: string;
	field?: string;
}

/** Judges what a configured node would do; may reject when it could not be judged */
export type AutomationGraphSafetyCheck = (
	nodeType: RegisteredAutomationNodeType,
	config: AutomationNodeConfig,
) => AutomationGraphSafetyFinding[] | Promise<AutomationGraphSafetyFinding[]>;

export interface AutomationGraphValidationOptions {
	/** Asked for every action node with a readable configuration */
	safety?: AutomationGraphSafetyCheck;
}

/** At most this many configuration problems are reported for one node */
export const AUTOMATION_GRAPH_MAX_CONFIG_ISSUES_PER_NODE = 20;

const QUOTE_MAX_LENGTH = 100;

interface ParsedNode {
	id: string;
	type: unknown;
	config: unknown;
	nodeType: RegisteredAutomationNodeType | undefined;
}

/** Whether a node is an All: a strict AND over its incoming edges within one run */
const isAllJoin = (nodeType: RegisteredAutomationNodeType | undefined): boolean =>
	nodeType?.kind === 'flow' && (nodeType.definition as { flow?: unknown } | undefined)?.flow === 'all';

/** Whether a node is a join, which continues at most once per run whatever leads into it */
const isJoin = (nodeType: RegisteredAutomationNodeType | undefined): boolean => {
	const flow = nodeType?.kind === 'flow' ? (nodeType.definition as { flow?: unknown } | undefined)?.flow : undefined;

	return flow === 'any' || flow === 'all';
};

/** An edge as seen from its target: where it comes from */
interface Feeder {
	source: ParsedNode;
	sourcePort: unknown;
}

interface ParsedEdge {
	id: string | undefined;
	source: ParsedNode;
	sourcePort: unknown;
	target: ParsedNode;
	targetPort: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? (value as unknown[]) : []);

/** Quotes a submitted name for a message, shortened so a message cannot grow with the input */
const quote = (value: unknown): string => {
	if (typeof value !== 'string') {
		return '(not a string)';
	}

	return `"${value.length > QUOTE_MAX_LENGTH ? `${value.slice(0, QUOTE_MAX_LENGTH)}…` : value}"`;
};

const resolveNodeType = (lookup: AutomationNodeTypeLookup, type: unknown): RegisteredAutomationNodeType | undefined => {
	if (typeof type !== 'string') {
		return undefined;
	}

	try {
		return lookup(type);
	} catch {
		return undefined;
	}
};

const validateNodeConfig = async (node: ParsedNode, nodeType: RegisteredAutomationNodeType) => {
	const issues: AutomationGraphIssue[] = [];

	const report = (reason: string, field?: string): void => {
		issues.push({
			severity: 'error',
			code: AutomationGraphIssueCode.INVALID_CONFIG,
			message: reason,
			node_id: node.id,
			...(field !== undefined ? { field } : {}),
		});
	};

	if (!isRecord(node.config)) {
		report('The configuration must be an object.');

		return issues;
	}

	try {
		const problems: unknown = await nodeType.validateConfig(node.config as AutomationNodeConfig);

		for (const problem of asArray(problems).slice(0, AUTOMATION_GRAPH_MAX_CONFIG_ISSUES_PER_NODE)) {
			if (isRecord(problem) && typeof problem.reason === 'string') {
				report(problem.reason, typeof problem.field === 'string' ? problem.field : undefined);
			} else {
				report('The configuration is not valid.');
			}
		}
	} catch {
		// What a validation hook throws may quote the configuration, so it is not passed on
		report('The configuration could not be validated.');
	}

	return issues;
};

const validateNodeSafety = async (
	node: ParsedNode,
	nodeType: RegisteredAutomationNodeType,
	check: AutomationGraphSafetyCheck,
): Promise<AutomationGraphIssue[]> => {
	if (nodeType.kind !== 'action' || !isRecord(node.config)) {
		return [];
	}

	const issues: AutomationGraphIssue[] = [];

	const report = (severity: AutomationGraphIssueSeverity, message: string, field?: string): void => {
		issues.push({
			severity,
			code: AutomationGraphIssueCode.SAFETY_REDUCING_ACTION,
			message,
			node_id: node.id,
			...(field !== undefined ? { field } : {}),
		});
	};

	try {
		const findings: unknown = await check(nodeType, node.config as AutomationNodeConfig);

		for (const finding of asArray(findings).slice(0, AUTOMATION_GRAPH_MAX_CONFIG_ISSUES_PER_NODE)) {
			if (isRecord(finding) && typeof finding.message === 'string') {
				report(
					finding.severity === 'warning' ? 'warning' : 'error',
					finding.message,
					typeof finding.field === 'string' ? finding.field : undefined,
				);
			} else {
				report('error', 'This action is not safe for an automation.');
			}
		}
	} catch {
		// What could not be checked is not let through
		report('error', 'The safety of this action could not be checked.');
	}

	return issues;
};

/**
 * Finds the groups of nodes that lie on a cycle: the strongly connected components with more than one
 * node, and single nodes with an edge to themselves. Tarjan's algorithm, without recursion so the depth of
 * a graph cannot exhaust the stack.
 */
const findCycles = (nodes: ParsedNode[], successors: Map<ParsedNode, Set<ParsedNode>>): ParsedNode[][] => {
	const order = new Map<ParsedNode, number>();
	const low = new Map<ParsedNode, number>();
	const onStack = new Set<ParsedNode>();
	const stack: ParsedNode[] = [];
	const cycles: ParsedNode[][] = [];
	let counter = 0;

	for (const root of nodes) {
		if (order.has(root)) {
			continue;
		}

		const work: { node: ParsedNode; next: Iterator<ParsedNode> }[] = [];

		const enter = (node: ParsedNode): void => {
			order.set(node, counter);
			low.set(node, counter);
			counter += 1;
			stack.push(node);
			onStack.add(node);
			work.push({ node, next: (successors.get(node) ?? new Set<ParsedNode>()).values() });
		};

		enter(root);

		while (work.length > 0) {
			const frame = work[work.length - 1];
			const step = frame.next.next();

			if (step.done !== true) {
				const successor = step.value;

				if (!order.has(successor)) {
					enter(successor);
				} else if (onStack.has(successor)) {
					low.set(frame.node, Math.min(low.get(frame.node) ?? 0, order.get(successor) ?? 0));
				}

				continue;
			}

			work.pop();

			if (work.length > 0) {
				const parent = work[work.length - 1].node;

				low.set(parent, Math.min(low.get(parent) ?? 0, low.get(frame.node) ?? 0));
			}

			if (low.get(frame.node) === order.get(frame.node)) {
				const component: ParsedNode[] = [];
				let member: ParsedNode | undefined;

				do {
					member = stack.pop();

					if (member !== undefined) {
						onStack.delete(member);
						component.push(member);
					}
				} while (member !== undefined && member !== frame.node);

				if (component.length > 1 || successors.get(frame.node)?.has(frame.node) === true) {
					cycles.push(component);
				}
			}
		}
	}

	return cycles;
};

/** Token counts are kept exactly up to this many; anything above is "more" */
const EXACT_RUNS = 3;

/** More tokens than EXACT_RUNS: assumed to reach every output as often as needed */
const MORE = EXACT_RUNS + 1;

/** One run of one trigger is simulated for at most this many combinations of outputs taken */
export const AUTOMATION_GRAPH_MAX_JOIN_CHOICES = 4096;

/** Every step of the simulation of one trigger's run - each output choice tried - counts against this */
export const AUTOMATION_GRAPH_MAX_JOIN_STEPS = AUTOMATION_GRAPH_MAX_JOIN_CHOICES * 8;

/**
 * Every way to spread `count` runs over `ports` outputs, one at a time and only as far as they are asked
 * for: each is the output taken by each run, in non-decreasing order. The array yielded is reused, so it
 * must be read before asking for the next one.
 */
function* spreads(count: number, ports: number): Generator<readonly number[]> {
	const picks = new Array<number>(ports === 0 ? 0 : count).fill(0);

	for (;;) {
		yield picks;

		let index = picks.length - 1;

		while (index >= 0 && picks[index] === ports - 1) index -= 1;

		if (index < 0) return;

		picks[index] += 1;

		for (let next = index + 1; next < picks.length; next += 1) picks[next] = picks[index];
	}
}

/**
 * Decides, for every All, which triggers start a run in which it can continue (ADR 0003, decision 4): a
 * run starts at one trigger, and an All continues only once a token has arrived on every edge leading into
 * it.
 *
 * Each trigger's run is simulated on its own, block by block in the order of the graph, counting the tokens
 * exactly up to EXACT_RUNS and as "more" above:
 *
 * - the trigger of the run is run once, every other trigger never;
 * - a block is run once per token arriving, an Any at most once, and an All once when every incoming edge
 *   carries a token (its state absorbs the rest);
 * - each run of a block takes one of its outputs, and a token goes along every edge of the output taken.
 *   How the runs of a block spread over its outputs is a choice, and every combination of choices is tried.
 *   Only outputs with an edge are offered: an output with no edge carries nothing, and a token more never
 *   stops an All. A block run "more" times is assumed to take every output "more" times.
 *
 * Every token of a real run is counted by the combination of choices that run made, so an All this finds no
 * way to complete can never continue. A run with too much to try - more than AUTOMATION_GRAPH_MAX_JOIN_CHOICES
 * combinations or AUTOMATION_GRAPH_MAX_JOIN_STEPS choices - or that walks a cycle (which is refused on its
 * own), is assumed to complete every All it reaches. The choices are made one at a time, so a block with
 * many outputs costs only what is tried. Edges on ports that are not declared, refused on their own, are
 * left out.
 *
 * An All no trigger can complete is an error; one that only some of the triggers leading to it can complete
 * is a warning, naming the triggers whose runs stop there. An All with an input no trigger leads to is left
 * to the unreachable-node warning.
 */
const validateAllJoins = (
	nodes: ParsedNode[],
	triggers: ParsedNode[],
	successors: Map<ParsedNode, Set<ParsedNode>>,
	feeders: Map<ParsedNode, Feeder[]>,
): AutomationGraphIssue[] => {
	const joins = nodes.filter((node) => isAllJoin(node.nodeType) && (feeders.get(node)?.length ?? 0) > 1);

	if (joins.length === 0) {
		return [];
	}

	const starts = nodes.filter((node) => triggers.some((trigger) => trigger.id === node.id));

	// The outputs of every block that carry an edge
	const usedPorts = new Map<ParsedNode, unknown[]>();

	for (const node of nodes) {
		for (const { source, sourcePort } of feeders.get(node) ?? []) {
			const ports = usedPorts.get(source) ?? [];

			if (!ports.includes(sourcePort)) ports.push(sourcePort);

			usedPorts.set(source, ports);
		}
	}

	const reachFrom = (start: ParsedNode): Set<ParsedNode> => {
		const reached = new Set<ParsedNode>([start]);
		const queue = [start];

		for (let index = 0; index < queue.length; index += 1) {
			for (const successor of successors.get(queue[index]) ?? []) {
				if (!reached.has(successor)) {
					reached.add(successor);
					queue.push(successor);
				}
			}
		}

		return reached;
	};

	/** The reached blocks with every block after those leading into it; null when they form a cycle */
	const orderOf = (reached: Set<ParsedNode>): ParsedNode[] | null => {
		const waiting = new Map<ParsedNode, number>();
		const order: ParsedNode[] = [];

		for (const node of reached) {
			waiting.set(node, (feeders.get(node) ?? []).filter(({ source }) => reached.has(source)).length);
		}

		const ready = [...reached].filter((node) => waiting.get(node) === 0);

		for (let node = ready.shift(); node !== undefined; node = ready.shift()) {
			order.push(node);

			for (const [target, count] of waiting) {
				const from = (feeders.get(target) ?? []).filter(({ source }) => source === node).length;

				if (from > 0) {
					waiting.set(target, count - from);

					if (count - from === 0) ready.push(target);
				}
			}
		}

		return order.length === reached.size ? order : null;
	};

	/**
	 * Tries the combinations of choices of one trigger's run and marks the Alls they complete. Returns false
	 * when there were too many to try.
	 */
	const explore = (start: ParsedNode, order: ParsedNode[], pending: ParsedNode[]): boolean => {
		/** Tokens taken by each output of each block, keyed by block, then port */
		const taken = new Map<ParsedNode, Map<unknown, number>>();
		const runs = new Map<ParsedNode, number>();
		let tried = 0;
		let steps = 0;

		const carried = ({ source, sourcePort }: Feeder): number => taken.get(source)?.get(sourcePort) ?? 0;
		const done = (): boolean => pending.every((join) => completedBy.get(join)?.has(start) === true);

		const step = (index: number): boolean => {
			if (index === order.length) {
				tried += 1;

				if (tried > AUTOMATION_GRAPH_MAX_JOIN_CHOICES) return false;

				for (const join of pending) {
					if ((runs.get(join) ?? 0) > 0) completedBy.get(join)?.add(start);
				}

				return true;
			}

			const node = order[index];
			const counts = (feeders.get(node) ?? []).map(carried);
			const total = Math.min(
				MORE,
				counts.reduce((sum, count) => sum + count, 0),
			);
			const count =
				node === start
					? 1
					: node.nodeType?.kind === 'trigger'
						? 0
						: isAllJoin(node.nodeType)
							? counts.every((arrived) => arrived > 0)
								? 1
								: 0
							: isJoin(node.nodeType)
								? Math.min(1, total)
								: total;
			const ports = usedPorts.get(node) ?? [];

			runs.set(node, count);

			if (count === MORE) {
				taken.set(node, new Map(ports.map((port) => [port, MORE])));

				return step(index + 1);
			}

			for (const picks of spreads(count, ports.length)) {
				steps += 1;

				if (steps > AUTOMATION_GRAPH_MAX_JOIN_STEPS) return false;

				const tally = new Map<unknown, number>();

				for (const pick of picks) tally.set(ports[pick], (tally.get(ports[pick]) ?? 0) + 1);

				taken.set(node, tally);

				if (!step(index + 1)) return false;
				if (done()) return true;
			}

			return true;
		};

		return step(0);
	};

	/** The triggers whose runs can complete each All */
	const completedBy = new Map<ParsedNode, Set<ParsedNode>>(joins.map((join) => [join, new Set<ParsedNode>()]));
	/** The triggers whose runs reach each All at all */
	const reachedBy = new Map<ParsedNode, Set<ParsedNode>>(joins.map((join) => [join, new Set<ParsedNode>()]));
	const reachable = new Set<ParsedNode>();

	for (const start of starts) {
		const reached = reachFrom(start);
		const pending = joins.filter((join) => reached.has(join));

		reached.forEach((node) => reachable.add(node));
		pending.forEach((join) => reachedBy.get(join)?.add(start));

		if (pending.length === 0) continue;

		const order = orderOf(reached);

		if (order === null || !explore(start, order, pending)) {
			// A cycle, or too many combinations: nothing is concluded, so nothing is refused
			pending.forEach((join) => completedBy.get(join)?.add(start));
		}
	}

	const issues: AutomationGraphIssue[] = [];

	for (const join of joins) {
		if ((feeders.get(join) ?? []).some(({ source }) => !reachable.has(source))) {
			continue;
		}

		const leading = reachedBy.get(join) ?? new Set<ParsedNode>();
		const completing = completedBy.get(join) ?? new Set<ParsedNode>();

		if (completing.size === 0) {
			issues.push({
				severity: 'error',
				code: AutomationGraphIssueCode.JOIN_NEVER_COMPLETES,
				message:
					'This All can never continue: no run brings a token to every one of its inputs. A run starts from one trigger and a block takes one output each time it runs; to combine two events, use Wait until.',
				node_id: join.id,
			});
		} else if (completing.size < leading.size) {
			const stopped = nodes.filter((node) => leading.has(node) && !completing.has(node));

			issues.push({
				severity: 'warning',
				code: AutomationGraphIssueCode.JOIN_PARTLY_COMPLETES,
				message: `This All continues only in runs of some of the triggers that lead to it; a run of ${stopped.length} other trigger(s) stops here.`,
				node_id: join.id,
				node_ids: stopped.map((trigger) => trigger.id),
			});
		}
	}

	return issues;
};

/**
 * Returns every issue of a graph. An empty list means the graph is complete and runnable.
 *
 * Whether an issue stops a save is not decided here; see `save-policy.ts`.
 */
export const validateGraph = async (
	graph: unknown,
	lookup: AutomationNodeTypeLookup,
	options: AutomationGraphValidationOptions = {},
): Promise<AutomationGraphIssue[]> => {
	const issues: AutomationGraphIssue[] = [];
	const document = isRecord(graph) ? graph : {};

	// Nodes
	const nodes: ParsedNode[] = [];
	const nodesById = new Map<string, ParsedNode>();

	for (const raw of asArray(document.nodes)) {
		if (!isRecord(raw) || typeof raw.id !== 'string') {
			continue;
		}

		const node: ParsedNode = { id: raw.id, type: raw.type, config: raw.config, nodeType: undefined };

		node.nodeType = resolveNodeType(lookup, node.type);

		nodes.push(node);

		// Of nodes sharing one identifier the first is the one edges are resolved to
		if (!nodesById.has(node.id)) {
			nodesById.set(node.id, node);
		}

		if (node.nodeType === undefined) {
			issues.push({
				severity: 'error',
				code: AutomationGraphIssueCode.UNKNOWN_NODE_TYPE,
				message: `Node type ${quote(node.type)} is not available.`,
				node_id: node.id,
			});

			continue;
		}

		issues.push(...(await validateNodeConfig(node, node.nodeType)));

		if (options.safety !== undefined) {
			issues.push(...(await validateNodeSafety(node, node.nodeType, options.safety)));
		}
	}

	// Edges
	const seenConnections = new Set<string>();
	const successors = new Map<ParsedNode, Set<ParsedNode>>();
	/** The edges into each node, by where they come from */
	const feeders = new Map<ParsedNode, Feeder[]>();

	for (const raw of asArray(document.edges)) {
		if (!isRecord(raw)) {
			continue;
		}

		const source = typeof raw.source === 'string' ? nodesById.get(raw.source) : undefined;
		const target = typeof raw.target === 'string' ? nodesById.get(raw.target) : undefined;

		if (source === undefined || target === undefined) {
			continue;
		}

		const edge: ParsedEdge = {
			id: typeof raw.id === 'string' ? raw.id : undefined,
			source,
			sourcePort: raw.source_port,
			target,
			targetPort: raw.target_port,
		};
		const edgeRef = edge.id !== undefined ? { edge_id: edge.id } : {};

		if (!successors.has(source)) {
			successors.set(source, new Set());
		}

		successors.get(source)?.add(target);

		if (!feeders.has(target)) {
			feeders.set(target, []);
		}

		// Only an edge between declared ports takes part in the join check: any other is refused on its own
		if (
			source.nodeType?.ports.outputs.includes(edge.sourcePort as string) === true &&
			target.nodeType?.kind !== 'trigger' &&
			target.nodeType?.ports.inputs.includes(edge.targetPort as string) === true
		) {
			feeders.get(target)?.push({ source, sourcePort: edge.sourcePort });
		}

		if (source.nodeType !== undefined && !source.nodeType.ports.outputs.includes(edge.sourcePort as string)) {
			issues.push({
				severity: 'error',
				code: AutomationGraphIssueCode.UNKNOWN_PORT,
				message: `Node type ${quote(source.nodeType.type)} has no output port ${quote(edge.sourcePort)}.`,
				node_id: source.id,
				...edgeRef,
			});
		}

		if (target.nodeType?.kind === 'trigger') {
			issues.push({
				severity: 'error',
				code: AutomationGraphIssueCode.EDGE_INTO_TRIGGER,
				message: 'A trigger starts a run, so no edge can lead into it.',
				node_id: target.id,
				...edgeRef,
			});
		} else if (target.nodeType !== undefined && !target.nodeType.ports.inputs.includes(edge.targetPort as string)) {
			issues.push({
				severity: 'error',
				code: AutomationGraphIssueCode.UNKNOWN_PORT,
				message: `Node type ${quote(target.nodeType.type)} has no input port ${quote(edge.targetPort)}.`,
				node_id: target.id,
				...edgeRef,
			});
		}

		const connection = JSON.stringify([source.id, edge.sourcePort, target.id, edge.targetPort]);

		if (seenConnections.has(connection)) {
			issues.push({
				severity: 'error',
				code: AutomationGraphIssueCode.DUPLICATE_EDGE,
				message: 'Another edge already connects the same two ports.',
				...edgeRef,
			});
		}

		seenConnections.add(connection);
	}

	// Cycles, each reported once with the nodes taking part in graph order
	const position = new Map<ParsedNode, number>(nodes.map((node, index) => [node, index]));

	const cycles = findCycles([...nodesById.values()], successors)
		.map((cycle) => cycle.sort((a, b) => (position.get(a) ?? 0) - (position.get(b) ?? 0)))
		.sort((a, b) => (position.get(a[0]) ?? 0) - (position.get(b[0]) ?? 0));

	for (const cycle of cycles) {
		issues.push({
			severity: 'error',
			code: AutomationGraphIssueCode.CYCLE,
			message: `The graph must not loop back on itself; ${cycle.length} node(s) form a cycle.`,
			node_ids: cycle.map((node) => node.id),
		});
	}

	// Triggers. A node of an unknown type may be one, so while such a node is there the graph is neither
	// said to have no trigger nor are the nodes behind it said to be unreachable.
	const triggers = nodes.filter((node) => node.nodeType?.kind === 'trigger');
	const unknown = nodes.filter((node) => node.nodeType === undefined);

	if (triggers.length === 0 && unknown.length === 0) {
		issues.push({
			severity: 'error',
			code: AutomationGraphIssueCode.NO_TRIGGER,
			message: 'An automation needs at least one trigger to start it.',
		});
	}

	// Reachability
	const reached = new Set<ParsedNode>();
	const queue: ParsedNode[] = [];

	for (const start of [...triggers, ...unknown]) {
		const node = nodesById.get(start.id);

		if (node !== undefined && !reached.has(node)) {
			reached.add(node);
			queue.push(node);
		}
	}

	for (let index = 0; index < queue.length; index += 1) {
		for (const successor of successors.get(queue[index]) ?? []) {
			if (!reached.has(successor)) {
				reached.add(successor);
				queue.push(successor);
			}
		}
	}

	for (const node of nodes) {
		if (
			node.nodeType !== undefined &&
			node.nodeType.kind !== 'trigger' &&
			!reached.has(nodesById.get(node.id) ?? node)
		) {
			issues.push({
				severity: 'warning',
				code: AutomationGraphIssueCode.UNREACHABLE_NODE,
				message: 'No trigger leads to this node, so it never runs.',
				node_id: node.id,
			});
		}
	}

	// Joins. A node of an unknown type may be a trigger, so while one is there nothing is said about them.
	if (unknown.length === 0) {
		issues.push(...validateAllJoins([...nodesById.values()], triggers, successors, feeders));
	}

	return issues;
};

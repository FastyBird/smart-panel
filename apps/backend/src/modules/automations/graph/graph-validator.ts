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

/**
 * A run starts at one trigger, so an All - a strict AND over its incoming edges within one run - can
 * continue only in a run of a trigger that brings a token to every one of those edges (ADR 0003, decision 4);
 * a token gets past an All upstream only in a run of a trigger that completes that All. An
 * All no trigger can complete is an error; one that only some of the triggers leading to it can complete
 * is a warning, naming the triggers whose runs stop there. An edge no trigger leads to is left to the
 * unreachable-node warning.
 */
const validateAllJoins = (
	nodes: ParsedNode[],
	triggers: ParsedNode[],
	feeders: Map<ParsedNode, Feeder[]>,
): AutomationGraphIssue[] => {
	const joins = nodes.filter((node) => isAllJoin(node.nodeType) && (feeders.get(node)?.length ?? 0) > 1);

	if (joins.length === 0) {
		return [];
	}

	// The triggers whose runs can bring a token to every node, a trigger to itself. A token leaves an All
	// only in a run of a trigger that brings one to every input of the All, so an All passes on the triggers
	// all of its inputs share; any other node those of any input. The sets only grow, so this ends.
	const canonical = new Set(triggers.map((trigger) => nodes.find((node) => node.id === trigger.id)));
	const startedBy = new Map<ParsedNode, Set<ParsedNode>>(nodes.map((node) => [node, new Set<ParsedNode>()]));

	for (const node of nodes) {
		if (canonical.has(node)) startedBy.get(node)?.add(node);
	}

	for (let changed = true; changed; ) {
		changed = false;

		for (const node of nodes) {
			if (canonical.has(node)) continue;

			const sets = (feeders.get(node) ?? []).map(({ source }) => startedBy.get(source) ?? new Set<ParsedNode>());
			const known = startedBy.get(node) ?? new Set<ParsedNode>();
			const reaching = isAllJoin(node.nodeType)
				? [...(sets[0] ?? [])].filter((trigger) => sets.every((set) => set.has(trigger)))
				: sets.flatMap((set) => [...set]);

			for (const trigger of reaching) {
				if (!known.has(trigger)) {
					known.add(trigger);
					changed = true;
				}
			}
		}
	}

	const issues: AutomationGraphIssue[] = [];
	const choices = createChoiceTracer(feeders);

	for (const join of joins) {
		const incoming = feeders.get(join) ?? [];
		const perEdge = incoming.map(({ source }) => startedBy.get(source) ?? new Set<ParsedNode>());

		if (perEdge.some((set) => set.size === 0)) {
			continue;
		}

		const leading = new Set<ParsedNode>(perEdge.flatMap((set) => [...set]));
		const completing = [...leading].filter((trigger) => perEdge.every((set) => set.has(trigger)));

		if (completing.length > 0 && excludeEachOther(incoming.map(choices))) {
			issues.push({
				severity: 'error',
				code: AutomationGraphIssueCode.JOIN_NEVER_COMPLETES,
				message:
					'This All can never continue: two of its inputs come from different outputs of one block, and a block that runs once in a run takes only one of its outputs.',
				node_id: join.id,
			});
		} else if (completing.length === 0) {
			issues.push({
				severity: 'error',
				code: AutomationGraphIssueCode.JOIN_NEVER_COMPLETES,
				message:
					'This All can never continue: a run starts from one trigger, and no trigger leads to every one of its inputs. To combine two events, use Wait until.',
				node_id: join.id,
			});
		} else if (completing.length < leading.size) {
			const stopped = nodes.filter((node) => leading.has(node) && !completing.includes(node));

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
 * Traces the outputs that must have been taken for a token to come along an edge: the output of its source,
 * and further up as long as the source is reached by a single edge from a block that runs at most once in a
 * run, also through a join with a single input. Every block takes exactly one output each time it runs, so two edges whose traces need different
 * outputs of one block that runs at most once can never both carry a token in the same run.
 *
 * A block runs at most once in a run when it is a trigger or a join, or when exactly one edge leads into it
 * from a block that runs at most once. Anything else - a block several edges lead into - may run more than
 * once, and nothing is concluded from it.
 */
const createChoiceTracer = (feeders: Map<ParsedNode, Feeder[]>): ((feeder: Feeder) => Map<ParsedNode, unknown>) => {
	const once = new Map<ParsedNode, boolean>();

	const runsOnce = (node: ParsedNode): boolean => {
		const known = once.get(node);

		if (known !== undefined) return known;

		// Until it is worked out - or when it lies on a cycle - it is not known to run once
		once.set(node, false);

		const into = feeders.get(node) ?? [];
		const result =
			node.nodeType?.kind === 'trigger' || isJoin(node.nodeType) || (into.length === 1 && runsOnce(into[0].source));

		once.set(node, result);

		return result;
	};

	return (feeder) => {
		const taken = new Map<ParsedNode, unknown>();
		let current: Feeder | undefined = feeder;

		while (current !== undefined && runsOnce(current.source) && !taken.has(current.source)) {
			const { source } = current;

			taken.set(source, current.sourcePort);

			const into = feeders.get(source) ?? [];

			// A join with a single input brings nothing new: what reached it had to come along that input
			current = source.nodeType?.kind === 'trigger' || into.length !== 1 ? undefined : into[0];
		}

		return taken;
	};
};

/** Whether two of the traces need different outputs of the same block */
const excludeEachOther = (traces: Map<ParsedNode, unknown>[]): boolean =>
	traces.some((first, index) =>
		traces
			.slice(index + 1)
			.some((second) => [...first].some(([node, port]) => second.has(node) && second.get(node) !== port)),
	);

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

		feeders.get(target)?.push({ source, sourcePort: edge.sourcePort });

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
		issues.push(...validateAllJoins([...nodesById.values()], triggers, feeders));
	}

	return issues;
};

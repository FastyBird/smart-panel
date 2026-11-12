/*
 * Pure helpers over the automation graph document. No Vue and no canvas library in here: the editor, the
 * canvas wrapper and the tests all talk plain graph JSON through these.
 */
import {
	AUTOMATION_GRAPH_MAX_EDGES,
	AUTOMATION_GRAPH_POSITION_LIMIT,
	AUTOMATION_GRAPH_VERSION,
	type AutomationConnectionRejection,
	AutomationNodeKind,
} from './automations.constants';
import type { IAutomationGraph, IAutomationGraphEdge, IAutomationGraphIssue, IAutomationGraphNode } from './store/automations.store.types';
import type { AutomationNodeTypeLookup, IAutomationNodeTypePorts } from './store/node-types.store.types';

export type IAutomationConnectionCandidate = Pick<IAutomationGraphEdge, 'source' | 'source_port' | 'target' | 'target_port'>;

export type AutomationIssueSeverity = IAutomationGraphIssue['severity'];

export const createEmptyGraph = (): IAutomationGraph => ({ version: AUTOMATION_GRAPH_VERSION, nodes: [], edges: [] });

export const cloneGraph = (graph: IAutomationGraph): IAutomationGraph => JSON.parse(JSON.stringify(graph)) as IAutomationGraph;

const clampPosition = (value: number): number => {
	if (!Number.isFinite(value)) {
		return 0;
	}

	return Math.max(-AUTOMATION_GRAPH_POSITION_LIMIT, Math.min(AUTOMATION_GRAPH_POSITION_LIMIT, Math.round(value)));
};

/**
 * A position as the backend accepts it: whole numbers inside the limit.
 */
export const normalizePosition = (position: { x: number; y: number }): { x: number; y: number } => ({
	x: clampPosition(position.x),
	y: clampPosition(position.y),
});

export interface IAutomationOccupiedArea {
	x: number;
	y: number;
	width: number;
	height: number;
}

// How far a card is moved at a time to find room for it
const FREE_POSITION_STEP = 80;

/**
 * Where a card added at `position` does not land on top of another one: further down, or - once the
 * bottom of the positions the backend accepts is reached - further up. Always a position as the backend
 * accepts it, so what is shown is what is saved.
 */
export const findFreePosition = (position: { x: number; y: number }, occupied: IAutomationOccupiedArea[]): { x: number; y: number } => {
	const start = normalizePosition(position);

	const isFree = (y: number): boolean =>
		!occupied.some((area) => Math.abs(area.x - start.x) < area.width + 20 && Math.abs(area.y - y) < area.height + 20);

	for (const step of [FREE_POSITION_STEP, -FREE_POSITION_STEP]) {
		for (let y = start.y; Math.abs(y) <= AUTOMATION_GRAPH_POSITION_LIMIT; y += step) {
			if (isFree(y)) {
				return { x: start.x, y };
			}
		}
	}

	return start;
};

const sortKeys = (value: unknown): unknown => {
	if (Array.isArray(value)) {
		return value.map(sortKeys);
	}

	if (value !== null && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([key, item]) => [key, sortKeys(item)])
		);
	}

	return value;
};

/**
 * A serialisation that is the same for two graphs meaning the same thing: nodes and edges ordered by id,
 * configuration keys ordered, positions rounded. Used to tell whether anything was changed.
 */
export const canonicalGraph = (graph: IAutomationGraph): string => {
	const nodes = [...graph.nodes]
		.sort((a, b) => a.id.localeCompare(b.id))
		.map((node) => ({ id: node.id, type: node.type, position: normalizePosition(node.position), config: sortKeys(node.config) }));

	const edges = [...graph.edges]
		.sort((a, b) => a.id.localeCompare(b.id))
		.map((edge) => ({ id: edge.id, source: edge.source, source_port: edge.source_port, target: edge.target, target_port: edge.target_port }));

	return JSON.stringify({ version: graph.version, nodes, edges });
};

export const isSameGraph = (a: IAutomationGraph, b: IAutomationGraph): boolean => canonicalGraph(a) === canonicalGraph(b);

/**
 * A short identifier that is not taken yet. Identifiers only have to be unique within one graph.
 */
export const createGraphId = (prefix: 'n' | 'e', taken: Iterable<string>): string => {
	const used = new Set(taken);

	for (;;) {
		const id = `${prefix}_${Math.random().toString(36).slice(2, 10).padEnd(8, '0')}`;

		if (!used.has(id)) {
			return id;
		}
	}
};

/**
 * The ports of a node. A node whose card is not offered any more (its plugin is gone) still has to be
 * drawn with its connections, so its ports are read from the edges that use them.
 */
export const resolveNodePorts = (
	node: Pick<IAutomationGraphNode, 'id' | 'type'>,
	edges: IAutomationGraphEdge[],
	lookup: AutomationNodeTypeLookup
): IAutomationNodeTypePorts => {
	const nodeType = lookup(node.type);

	if (nodeType !== null) {
		return { inputs: [...nodeType.ports.inputs], outputs: [...nodeType.ports.outputs] };
	}

	const inputs = new Set<string>();
	const outputs = new Set<string>();

	for (const edge of edges) {
		if (edge.target === node.id) inputs.add(edge.target_port);
		if (edge.source === node.id) outputs.add(edge.source_port);
	}

	return { inputs: [...inputs], outputs: [...outputs] };
};

/**
 * True when `to` can already reach `from`, i.e. an edge from → to would close a loop.
 */
export const wouldCreateCycle = (edges: Pick<IAutomationGraphEdge, 'source' | 'target'>[], from: string, to: string): boolean => {
	if (from === to) {
		return true;
	}

	const successors = new Map<string, string[]>();

	for (const edge of edges) {
		successors.set(edge.source, [...(successors.get(edge.source) ?? []), edge.target]);
	}

	const stack = [to];
	const seen = new Set<string>();

	while (stack.length > 0) {
		const current = stack.pop() as string;

		if (current === from) {
			return true;
		}

		if (seen.has(current)) {
			continue;
		}

		seen.add(current);
		stack.push(...(successors.get(current) ?? []));
	}

	return false;
};

/**
 * Says why a connection cannot be drawn, or null when it can. It refuses what the backend would refuse on
 * save - an edge into a trigger, a port the card does not have, a loop, a second edge between the same two
 * ports - so such an edge never gets onto the canvas.
 */
export const validateConnection = (
	graph: Pick<IAutomationGraph, 'nodes' | 'edges'>,
	candidate: IAutomationConnectionCandidate,
	lookup: AutomationNodeTypeLookup
): AutomationConnectionRejection | null => {
	const source = graph.nodes.find((node) => node.id === candidate.source);
	const target = graph.nodes.find((node) => node.id === candidate.target);

	if (!source || !target) {
		return 'unknown_node';
	}

	const sourceType = lookup(source.type);
	const targetType = lookup(target.type);

	// A card that is not offered any more cannot be judged, and the backend refuses a graph holding one
	if (sourceType === null || targetType === null) {
		return 'unknown_node';
	}

	if (targetType.kind === AutomationNodeKind.trigger) {
		return 'into_trigger';
	}

	if (!sourceType.ports.outputs.includes(candidate.source_port) || !targetType.ports.inputs.includes(candidate.target_port)) {
		return 'unknown_port';
	}

	if (candidate.source === candidate.target) {
		return 'self';
	}

	if (
		graph.edges.some(
			(edge) =>
				edge.source === candidate.source &&
				edge.source_port === candidate.source_port &&
				edge.target === candidate.target &&
				edge.target_port === candidate.target_port
		)
	) {
		return 'duplicate';
	}

	if (wouldCreateCycle(graph.edges, candidate.source, candidate.target)) {
		return 'cycle';
	}

	if (graph.edges.length >= AUTOMATION_GRAPH_MAX_EDGES) {
		return 'limit';
	}

	return null;
};

/**
 * The flows of a graph that have nothing to do with each other: groups of connected nodes, each holding at
 * least one trigger. Under the `restart` mode a trigger of one flow cancels the runs of all the others, so
 * more than one flow on a canvas is worth a warning. Loose nodes without a trigger are not a flow.
 */
export const findSeparateFlows = (graph: Pick<IAutomationGraph, 'nodes' | 'edges'>, lookup: AutomationNodeTypeLookup): string[][] => {
	const neighbours = new Map<string, string[]>(graph.nodes.map((node) => [node.id, []]));

	for (const edge of graph.edges) {
		if (!neighbours.has(edge.source) || !neighbours.has(edge.target)) {
			continue;
		}

		neighbours.get(edge.source)?.push(edge.target);
		neighbours.get(edge.target)?.push(edge.source);
	}

	const kinds = new Map<string, AutomationNodeKind | null>(graph.nodes.map((node) => [node.id, lookup(node.type)?.kind ?? null]));

	const seen = new Set<string>();
	const flows: string[][] = [];

	for (const node of graph.nodes) {
		if (seen.has(node.id)) {
			continue;
		}

		const group: string[] = [];
		const stack = [node.id];

		seen.add(node.id);

		while (stack.length > 0) {
			const current = stack.pop() as string;

			group.push(current);

			for (const next of neighbours.get(current) ?? []) {
				if (!seen.has(next)) {
					seen.add(next);
					stack.push(next);
				}
			}
		}

		if (group.some((id) => kinds.get(id) === AutomationNodeKind.trigger)) {
			flows.push(group);
		}
	}

	return flows;
};

/**
 * The nodes an issue is about: its node, or every node taking part in it (a cycle).
 */
export const issueNodeIds = (issue: IAutomationGraphIssue): string[] => {
	const ids = new Set<string>(issue.node_ids ?? []);

	if (typeof issue.node_id === 'string') {
		ids.add(issue.node_id);
	}

	return [...ids];
};

const worse = (current: AutomationIssueSeverity | undefined, next: AutomationIssueSeverity): AutomationIssueSeverity =>
	current === 'error' || next === 'error' ? 'error' : 'warning';

/**
 * The worst severity reported for each node and each edge, for outlining them on the canvas.
 */
export const mapIssueSeverities = (
	issues: IAutomationGraphIssue[]
): { nodes: Map<string, AutomationIssueSeverity>; edges: Map<string, AutomationIssueSeverity> } => {
	const nodes = new Map<string, AutomationIssueSeverity>();
	const edges = new Map<string, AutomationIssueSeverity>();

	for (const issue of issues) {
		for (const id of issueNodeIds(issue)) {
			nodes.set(id, worse(nodes.get(id), issue.severity));
		}

		if (typeof issue.edge_id === 'string') {
			edges.set(issue.edge_id, worse(edges.get(issue.edge_id), issue.severity));
		}
	}

	return { nodes, edges };
};

/**
 * Drops the issues that speak of nodes and edges the graph no longer has, so a problem that was deleted
 * does not stay listed until the next save.
 */
export const pruneIssues = (issues: IAutomationGraphIssue[], graph: Pick<IAutomationGraph, 'nodes' | 'edges'>): IAutomationGraphIssue[] => {
	const nodeIds = new Set(graph.nodes.map((node) => node.id));
	const edgeIds = new Set(graph.edges.map((edge) => edge.id));

	return issues.filter(
		(issue) => issueNodeIds(issue).every((id) => nodeIds.has(id)) && (typeof issue.edge_id !== 'string' || edgeIds.has(issue.edge_id))
	);
};

// `id`, `device_id`, `space_ids`, `deviceId`: what such a key holds points at something, it says nothing itself
const IDENTIFIER_KEY_PATTERNS = [/(?:^|[_-])ids?$/i, /[a-z0-9]Ids?$/];

const isIdentifierKey = (key: string): boolean => IDENTIFIER_KEY_PATTERNS.some((pattern) => pattern.test(key));

export const humanizeKey = (key: string): string => {
	const words = key.replace(/[_-]+/g, ' ').trim();

	return words.charAt(0).toUpperCase() + words.slice(1);
};

/**
 * A one-line reading of a configuration for a card that brings no summary of its own: its plain values,
 * in the order they were written. Identifiers say nothing to a person and are left out.
 */
export const summarizeConfig = (config: Record<string, unknown>): string => {
	const parts: string[] = [];

	for (const [key, value] of Object.entries(config)) {
		if (value === null || typeof value === 'undefined' || value === '' || isIdentifierKey(key)) {
			continue;
		}

		const label = humanizeKey(key).toLowerCase();

		if (typeof value === 'string') {
			parts.push(`${label}: ${value}`);
		} else if (typeof value === 'number' || typeof value === 'boolean') {
			parts.push(`${label}: ${String(value)}`);
		} else if (Array.isArray(value)) {
			const plain = value.every((item) => typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean');

			parts.push(plain && value.length <= 7 ? `${label}: ${value.join(', ')}` : `${label}: ${value.length}×`);
		}
	}

	return parts.join(' · ');
};

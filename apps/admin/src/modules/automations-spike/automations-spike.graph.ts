// THROWAWAY SPIKE (AU-0). Pure graph helpers: no Vue, no canvas library.
import { getNodeType } from './automations-spike.catalogue';
import type {
	AutomationConnectionRejection,
	IAutomationConnectionCandidate,
	IAutomationGraph,
	IAutomationGraphEdge,
	IAutomationGraphNode,
} from './automations-spike.types';

export const REFERENCE_SCENARIO: IAutomationGraph = {
	version: 1,
	nodes: [
		{ id: 't1', type: 'device.property.changed', position: { x: 40, y: 60 }, config: { property: 'occupancy', to: 'detected', for_minutes: 0 } },
		{ id: 'c1', type: 'device.property.compare', position: { x: 340, y: 60 }, config: { property: 'illuminance', operator: 'lt', value: 50 } },
		{ id: 'c2', type: 'time.window', position: { x: 640, y: 20 }, config: { from: '22:00', to: '06:00' } },
		{ id: 'a1', type: 'light.set', position: { x: 940, y: -40 }, config: { on: true, brightness: 20 } },
		{ id: 'a2', type: 'light.set', position: { x: 940, y: 100 }, config: { on: true, brightness: 100 } },
		{ id: 't2', type: 'device.property.changed', position: { x: 40, y: 300 }, config: { property: 'occupancy', to: 'clear', for_minutes: 2 } },
		{ id: 'a3', type: 'light.set', position: { x: 340, y: 300 }, config: { on: false, brightness: 100 } },
	],
	edges: [
		{ id: 'e1', source: 't1', source_port: 'out', target: 'c1', target_port: 'in' },
		{ id: 'e2', source: 'c1', source_port: 'yes', target: 'c2', target_port: 'in' },
		{ id: 'e3', source: 'c2', source_port: 'yes', target: 'a1', target_port: 'in' },
		{ id: 'e4', source: 'c2', source_port: 'no', target: 'a2', target_port: 'in' },
		{ id: 'e5', source: 't2', source_port: 'out', target: 'a3', target_port: 'in' },
	],
};

export const cloneGraph = (graph: IAutomationGraph): IAutomationGraph => JSON.parse(JSON.stringify(graph)) as IAutomationGraph;

// Stable serialisation used for the round-trip check: nodes and edges sorted by id, positions rounded.
export const canonicalGraph = (graph: IAutomationGraph): string => {
	const nodes = [...graph.nodes]
		.sort((a, b) => a.id.localeCompare(b.id))
		.map((node) => ({
			id: node.id,
			type: node.type,
			position: { x: Math.round(node.position.x), y: Math.round(node.position.y) },
			config: Object.fromEntries(Object.entries(node.config).sort(([a], [b]) => a.localeCompare(b))),
		}));
	const edges = [...graph.edges]
		.sort((a, b) => a.id.localeCompare(b.id))
		.map((edge) => ({ id: edge.id, source: edge.source, source_port: edge.source_port, target: edge.target, target_port: edge.target_port }));

	return JSON.stringify({ version: graph.version, nodes, edges });
};

// True when `to` can already reach `from`, i.e. adding from → to would close a loop.
export const wouldCreateCycle = (edges: Pick<IAutomationGraphEdge, 'source' | 'target'>[], from: string, to: string): boolean => {
	if (from === to) {
		return true;
	}

	const adjacency = new Map<string, string[]>();

	for (const edge of edges) {
		adjacency.set(edge.source, [...(adjacency.get(edge.source) ?? []), edge.target]);
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
		stack.push(...(adjacency.get(current) ?? []));
	}

	return false;
};

export const validateConnection = (
	nodes: Pick<IAutomationGraphNode, 'id' | 'type'>[],
	edges: IAutomationConnectionCandidate[],
	candidate: IAutomationConnectionCandidate
): AutomationConnectionRejection | null => {
	const source = nodes.find((node) => node.id === candidate.source);
	const target = nodes.find((node) => node.id === candidate.target);
	const sourceType = source ? getNodeType(source.type) : undefined;
	const targetType = target ? getNodeType(target.type) : undefined;

	if (!sourceType || !targetType) {
		return 'unknown_port';
	}

	if (targetType.kind === 'trigger') {
		return 'into_trigger';
	}

	if (!sourceType.outputs.includes(candidate.source_port) || !targetType.inputs.includes(candidate.target_port)) {
		return 'unknown_port';
	}

	if (candidate.source === candidate.target) {
		return 'self';
	}

	if (
		edges.some(
			(edge) =>
				edge.source === candidate.source &&
				edge.source_port === candidate.source_port &&
				edge.target === candidate.target &&
				edge.target_port === candidate.target_port
		)
	) {
		return 'duplicate';
	}

	if (wouldCreateCycle(edges, candidate.source, candidate.target)) {
		return 'cycle';
	}

	return null;
};

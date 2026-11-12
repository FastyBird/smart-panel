import { describe, expect, it } from 'vitest';

import { AUTOMATION_GRAPH_MAX_EDGES, AutomationNodeKind } from './automations.constants';
import {
	canonicalGraph,
	cloneGraph,
	createEmptyGraph,
	createGraphId,
	findSeparateFlows,
	isSameGraph,
	issueNodeIds,
	mapIssueSeverities,
	normalizePosition,
	pruneIssues,
	resolveNodePorts,
	summarizeConfig,
	validateConnection,
	wouldCreateCycle,
} from './automations.graph';
import type { IAutomationGraph, IAutomationGraphIssue } from './store/automations.store.types';
import type { IAutomationNodeType } from './store/node-types.store.types';

const nodeType = (type: string, kind: AutomationNodeKind, inputs: string[], outputs: string[]): IAutomationNodeType => ({
	type,
	kind,
	name: type,
	description: '',
	ports: { inputs, outputs },
	configSchema: { type: 'object' },
});

const NODE_TYPES: IAutomationNodeType[] = [
	nodeType('trigger', AutomationNodeKind.trigger, [], ['out']),
	nodeType('condition', AutomationNodeKind.condition, ['in'], ['yes', 'no']),
	nodeType('action', AutomationNodeKind.action, ['in'], ['done', 'error']),
	nodeType('delay', AutomationNodeKind.flow, ['in'], ['out']),
];

const lookup = (type: string): IAutomationNodeType | null => NODE_TYPES.find((item) => item.type === type) ?? null;

const node = (id: string, type: string, config: Record<string, unknown> = {}): IAutomationGraph['nodes'][number] => ({
	id,
	type,
	position: { x: 0, y: 0 },
	config,
});

const edge = (id: string, source: string, sourcePort: string, target: string, targetPort: string = 'in'): IAutomationGraph['edges'][number] => ({
	id,
	source,
	source_port: sourcePort,
	target,
	target_port: targetPort,
});

// The reference scenario of the design: two flows on one canvas
const reference: IAutomationGraph = {
	version: 1,
	nodes: [
		node('t1', 'trigger'),
		node('c1', 'condition'),
		node('c2', 'condition'),
		node('a1', 'action'),
		node('a2', 'action'),
		node('t2', 'trigger'),
		node('a3', 'action'),
	],
	edges: [
		edge('e1', 't1', 'out', 'c1'),
		edge('e2', 'c1', 'yes', 'c2'),
		edge('e3', 'c2', 'yes', 'a1'),
		edge('e4', 'c2', 'no', 'a2'),
		edge('e5', 't2', 'out', 'a3'),
	],
};

const issue = (overrides: Partial<IAutomationGraphIssue>): IAutomationGraphIssue => ({
	severity: 'error',
	code: 'invalid_config',
	message: 'Not valid.',
	blocking: true,
	...overrides,
});

describe('automations.graph', (): void => {
	describe('validateConnection', (): void => {
		it('accepts a connection the backend would accept', (): void => {
			expect(validateConnection(reference, { source: 'c1', source_port: 'no', target: 'a3', target_port: 'in' }, lookup)).toBeNull();
		});

		it('refuses an edge into a trigger', (): void => {
			expect(validateConnection(reference, { source: 'c1', source_port: 'no', target: 't2', target_port: 'in' }, lookup)).toBe('into_trigger');
		});

		it('refuses a port the node type does not have', (): void => {
			expect(validateConnection(reference, { source: 'c1', source_port: 'done', target: 'a3', target_port: 'in' }, lookup)).toBe('unknown_port');
			expect(validateConnection(reference, { source: 'c1', source_port: 'no', target: 'a3', target_port: 'other' }, lookup)).toBe('unknown_port');
		});

		it('refuses a connection that would close a loop', (): void => {
			expect(validateConnection(reference, { source: 'a1', source_port: 'done', target: 'c1', target_port: 'in' }, lookup)).toBe('cycle');
		});

		it('refuses a node connected to itself', (): void => {
			expect(validateConnection(reference, { source: 'c1', source_port: 'no', target: 'c1', target_port: 'in' }, lookup)).toBe('self');
		});

		it('refuses a second edge between the same two ports, but not another output to the same input', (): void => {
			expect(validateConnection(reference, { source: 'c2', source_port: 'yes', target: 'a1', target_port: 'in' }, lookup)).toBe('duplicate');
			expect(validateConnection(reference, { source: 'c2', source_port: 'no', target: 'a1', target_port: 'in' }, lookup)).toBeNull();
		});

		it('refuses nodes that are missing or of a type that is not offered', (): void => {
			const graph: IAutomationGraph = { ...reference, nodes: [...reference.nodes, node('x', 'plugin.gone')] };

			expect(validateConnection(graph, { source: 'c1', source_port: 'no', target: 'nope', target_port: 'in' }, lookup)).toBe('unknown_node');
			expect(validateConnection(graph, { source: 'c1', source_port: 'no', target: 'x', target_port: 'in' }, lookup)).toBe('unknown_node');
		});

		it('refuses an edge beyond the limit of the backend', (): void => {
			const edges = Array.from({ length: AUTOMATION_GRAPH_MAX_EDGES }, (_, index) => edge(`x${index}`, 't1', 'out', 'c1'));

			expect(
				validateConnection({ nodes: reference.nodes, edges }, { source: 'c1', source_port: 'no', target: 'a3', target_port: 'in' }, lookup)
			).toBe('limit');
		});
	});

	describe('wouldCreateCycle', (): void => {
		it('follows the edges transitively', (): void => {
			expect(wouldCreateCycle(reference.edges, 'a1', 't1')).toBe(true);
			expect(wouldCreateCycle(reference.edges, 'a3', 't1')).toBe(false);
			expect(wouldCreateCycle(reference.edges, 'c1', 'c1')).toBe(true);
		});

		it('ends on a graph that already loops', (): void => {
			const looping = [
				{ source: 'a', target: 'b' },
				{ source: 'b', target: 'a' },
			];

			expect(wouldCreateCycle(looping, 'c', 'a')).toBe(false);
		});
	});

	describe('findSeparateFlows', (): void => {
		it('finds the two flows of the reference scenario', (): void => {
			const flows = findSeparateFlows(reference, lookup);

			expect(flows).toHaveLength(2);
			expect(flows.map((flow) => [...flow].sort())).toEqual([
				['a1', 'a2', 'c1', 'c2', 't1'],
				['a3', 't2'],
			]);
		});

		it('counts one flow when the triggers lead to the same node', (): void => {
			const joined: IAutomationGraph = { ...reference, edges: [...reference.edges, edge('e6', 't2', 'out', 'c1')] };

			expect(findSeparateFlows(joined, lookup)).toHaveLength(1);
		});

		it('does not count loose nodes without a trigger', (): void => {
			const graph: IAutomationGraph = { ...reference, nodes: [...reference.nodes, node('loose', 'action'), node('unknown', 'plugin.gone')] };

			expect(findSeparateFlows(graph, lookup)).toHaveLength(2);
		});
	});

	describe('canonicalGraph', (): void => {
		it('is the same for the same graph written in another order', (): void => {
			const a: IAutomationGraph = {
				version: 1,
				nodes: [
					{ id: 'n1', type: 'trigger', position: { x: 10.2, y: 20 }, config: { b: 1, a: { d: 1, c: 2 } } },
					{ id: 'n2', type: 'action', position: { x: 0, y: 0 }, config: {} },
				],
				edges: [edge('e2', 'n1', 'out', 'n2'), edge('e1', 'n1', 'out', 'n2', 'other')],
			};
			const b: IAutomationGraph = {
				version: 1,
				nodes: [
					{ id: 'n2', type: 'action', position: { x: 0, y: 0 }, config: {} },
					{ id: 'n1', type: 'trigger', position: { x: 10, y: 20 }, config: { a: { c: 2, d: 1 }, b: 1 } },
				],
				edges: [edge('e1', 'n1', 'out', 'n2', 'other'), edge('e2', 'n1', 'out', 'n2')],
			};

			expect(canonicalGraph(a)).toBe(canonicalGraph(b));
			expect(isSameGraph(a, b)).toBe(true);
		});

		it('tells a changed configuration, position or edge', (): void => {
			const moved = cloneGraph(reference);
			moved.nodes[0]!.position.x = 50;

			const configured = cloneGraph(reference);
			configured.nodes[0]!.config = { to: true };

			const rewired = cloneGraph(reference);
			rewired.edges[1]!.source_port = 'no';

			expect(isSameGraph(reference, moved)).toBe(false);
			expect(isSameGraph(reference, configured)).toBe(false);
			expect(isSameGraph(reference, rewired)).toBe(false);
			expect(isSameGraph(reference, cloneGraph(reference))).toBe(true);
		});

		it('keeps the order of arrays inside a configuration', (): void => {
			const a = { ...createEmptyGraph(), nodes: [node('n', 'action', { writes: [1, 2] })] };
			const b = { ...createEmptyGraph(), nodes: [node('n', 'action', { writes: [2, 1] })] };

			expect(isSameGraph(a, b)).toBe(false);
		});
	});

	describe('normalizePosition', (): void => {
		it('rounds and keeps the position inside what the backend accepts', (): void => {
			expect(normalizePosition({ x: 10.6, y: -3.2 })).toEqual({ x: 11, y: -3 });
			expect(normalizePosition({ x: 5e9, y: -5e9 })).toEqual({ x: 1_000_000, y: -1_000_000 });
			expect(normalizePosition({ x: Number.NaN, y: Number.POSITIVE_INFINITY })).toEqual({ x: 0, y: 0 });
		});
	});

	describe('createGraphId', (): void => {
		it('creates an identifier with the prefix that is not taken', (): void => {
			const taken = new Set<string>();

			for (let index = 0; index < 50; index += 1) {
				const id = createGraphId('n', taken);

				expect(id).toMatch(/^n_[a-z0-9]{8}$/);
				expect(taken.has(id)).toBe(false);

				taken.add(id);
			}

			expect(createGraphId('e', [])).toMatch(/^e_/);
		});
	});

	describe('resolveNodePorts', (): void => {
		it('takes the ports of a known type from the catalogue', (): void => {
			expect(resolveNodePorts({ id: 'c1', type: 'condition' }, reference.edges, lookup)).toEqual({ inputs: ['in'], outputs: ['yes', 'no'] });
		});

		it('reads the ports of an unknown type from the edges that use them', (): void => {
			const edges = [
				edge('e1', 't1', 'out', 'x', 'in'),
				edge('e2', 'x', 'left', 'a1'),
				edge('e3', 'x', 'right', 'a2'),
				edge('e4', 'x', 'left', 'a3'),
			];

			expect(resolveNodePorts({ id: 'x', type: 'plugin.gone' }, edges, lookup)).toEqual({ inputs: ['in'], outputs: ['left', 'right'] });
		});
	});

	describe('issues', (): void => {
		const issues: IAutomationGraphIssue[] = [
			issue({ node_id: 'a1', severity: 'warning', code: 'unreachable_node' }),
			issue({ node_id: 'a1', field: 'writes.0.value' }),
			issue({ code: 'cycle', node_ids: ['c1', 'c2'] }),
			issue({ code: 'duplicate_edge', edge_id: 'e3', severity: 'warning' }),
			issue({ code: 'no_trigger' }),
		];

		it('names the nodes an issue is about', (): void => {
			expect(issueNodeIds(issues[0]!)).toEqual(['a1']);
			expect(issueNodeIds(issues[2]!)).toEqual(['c1', 'c2']);
			expect(issueNodeIds(issues[4]!)).toEqual([]);
		});

		it('maps the worst severity to each node and edge', (): void => {
			const { nodes, edges } = mapIssueSeverities(issues);

			expect(Object.fromEntries(nodes)).toEqual({ a1: 'error', c1: 'error', c2: 'error' });
			expect(Object.fromEntries(edges)).toEqual({ e3: 'warning' });
		});

		it('drops the issues of nodes and edges that are gone and keeps those about the graph', (): void => {
			const graph: IAutomationGraph = {
				...reference,
				nodes: reference.nodes.filter((item) => item.id !== 'a1'),
				edges: reference.edges.filter((item) => item.id !== 'e3'),
			};

			expect(pruneIssues(issues, graph).map((item) => item.code)).toEqual(['cycle', 'no_trigger']);
			expect(pruneIssues(issues, reference)).toHaveLength(5);
		});
	});

	describe('summarizeConfig', (): void => {
		it('reads the plain values in the order they were written and leaves identifiers out', (): void => {
			expect(
				summarizeConfig({
					device_id: 'b5f5f9a2-6a6c-4c0e-9d7f-1c1d3f1b2a01',
					to: 'detected',
					for_seconds: 120,
					enabled: false,
					weekdays: [1, 2, 3],
					writes: [{ value: true }, { value: false }],
					nothing: null,
					empty: '',
				})
			).toBe('to: detected · for seconds: 120 · enabled: false · weekdays: 1, 2, 3 · writes: 2×');
		});

		it('is empty for a configuration without plain values', (): void => {
			expect(summarizeConfig({})).toBe('');
			expect(summarizeConfig({ property_id: 'b5f5f9a2-6a6c-4c0e-9d7f-1c1d3f1b2a01' })).toBe('');
		});
	});
});

import { describe, expect, it } from 'vitest';

import { canonicalGraph } from '../../automations.graph';
import type { IAutomationGraph } from '../../store/automations.store.types';

import {
	AUTOMATION_CANVAS_NODE_TYPE,
	type IAutomationCanvasEdgeState,
	type IAutomationCanvasNodeState,
	edgeTone,
	graphStructure,
	toCanvasEdge,
	toCanvasElements,
	toCanvasNode,
	toGraph,
	toGraphEdge,
	toGraphNode,
} from './automation-canvas.mapping';

const propertyId = 'b5f5f9a2-6a6c-4c0e-9d7f-1c1d3f1b2a03';

// The graph document exactly as the API returns and accepts it
const graph: IAutomationGraph = {
	version: 1,
	nodes: [
		{ id: 't1', type: 'device.property.changed', position: { x: 40, y: 60 }, config: { property_id: propertyId, to: 'detected', for_seconds: 120 } },
		{ id: 'c1', type: 'device.property.compare', position: { x: 400, y: 60 }, config: { property_id: propertyId, operator: 'lt', value: 50 } },
		{ id: 'a1', type: 'device.property.set', position: { x: 760, y: -40 }, config: { writes: [{ property_id: propertyId, value: true }] } },
		{ id: 'a2', type: 'notification.send', position: { x: 760, y: 100 }, config: {} },
	],
	edges: [
		{ id: 'e1', source: 't1', source_port: 'out', target: 'c1', target_port: 'in' },
		{ id: 'e2', source: 'c1', source_port: 'yes', target: 'a1', target_port: 'in' },
		{ id: 'e3', source: 'c1', source_port: 'no', target: 'a2', target_port: 'in' },
	],
};

describe('automation-canvas.mapping', (): void => {
	describe('graph → canvas', (): void => {
		it('maps a node to a canvas node of the automation type, with type and config as its data', (): void => {
			expect(toCanvasNode(graph.nodes[0]!)).toEqual({
				id: 't1',
				type: AUTOMATION_CANVAS_NODE_TYPE,
				position: { x: 40, y: 60 },
				data: { type: 'device.property.changed', config: { property_id: propertyId, to: 'detected', for_seconds: 120 } },
			});
		});

		it('maps the ports of an edge to the handles of the canvas', (): void => {
			expect(toCanvasEdge(graph.edges[1]!)).toEqual({ id: 'e2', source: 'c1', target: 'a1', sourceHandle: 'yes', targetHandle: 'in' });
		});

		it('hands the canvas copies, so nothing it does can change the document', (): void => {
			const canvasNode = toCanvasNode(graph.nodes[2]!);

			canvasNode.position.x = 999;
			(canvasNode.data.config.writes as { value: boolean }[])[0]!.value = false;

			expect(graph.nodes[2]!.position.x).toBe(760);
			expect(graph.nodes[2]!.config).toEqual({ writes: [{ property_id: propertyId, value: true }] });
		});

		it('maps every node and edge', (): void => {
			const { nodes, edges } = toCanvasElements(graph);

			expect(nodes.map((node) => node.id)).toEqual(['t1', 'c1', 'a1', 'a2']);
			expect(edges.map((edge) => edge.id)).toEqual(['e1', 'e2', 'e3']);
		});
	});

	describe('canvas → graph', (): void => {
		it('reads a node back, leaving behind what the library added to it', (): void => {
			// What the library holds for a node is much more than was given to it
			const state = {
				id: 'c1',
				type: AUTOMATION_CANVAS_NODE_TYPE,
				position: { x: 400, y: 60 },
				computedPosition: { x: 400, y: 60, z: 0 },
				dimensions: { width: 280, height: 56 },
				selected: true,
				dragging: false,
				data: { type: 'device.property.compare', config: { operator: 'lt', value: 50 } },
			} as IAutomationCanvasNodeState;

			expect(toGraphNode(state)).toEqual({
				id: 'c1',
				type: 'device.property.compare',
				position: { x: 400, y: 60 },
				config: { operator: 'lt', value: 50 },
			});
		});

		it('rounds a position the canvas reports between pixels', (): void => {
			expect(toGraphNode({ id: 'n', position: { x: 12.4, y: -7.6 }, data: { type: 'flow.delay', config: {} } }).position).toEqual({ x: 12, y: -8 });
		});

		it('reads an edge back with its ports', (): void => {
			const state = {
				id: 'e3',
				source: 'c1',
				target: 'a2',
				sourceHandle: 'no',
				targetHandle: 'in',
				selected: false,
				markerEnd: { type: 'arrowclosed' },
				class: 'automation-canvas__edge',
			} as IAutomationCanvasEdgeState;

			expect(toGraphEdge(state)).toEqual({ id: 'e3', source: 'c1', source_port: 'no', target: 'a2', target_port: 'in' });
		});

		it('reads an edge without handles as running between the default ports', (): void => {
			expect(toGraphEdge({ id: 'e', source: 'a', target: 'b', sourceHandle: null })).toEqual({
				id: 'e',
				source: 'a',
				source_port: 'out',
				target: 'b',
				target_port: 'in',
			});
		});
	});

	describe('round trip', (): void => {
		it('gives back the graph it was given, unchanged', (): void => {
			const { nodes, edges } = toCanvasElements(graph);

			expect(toGraph(graph.version, nodes, edges)).toEqual(graph);
		});

		it('gives back an empty graph', (): void => {
			const empty: IAutomationGraph = { version: 1, nodes: [], edges: [] };
			const { nodes, edges } = toCanvasElements(empty);

			expect(toGraph(1, nodes, edges)).toEqual(empty);
		});

		it('keeps configuration keys exactly as written, whatever their case', (): void => {
			const odd: IAutomationGraph = {
				version: 1,
				nodes: [
					{
						id: 'n',
						type: 'plugin.card',
						position: { x: 0, y: 0 },
						config: { snake_case: 1, camelCase: 2, 'kebab-case': 3, nested: { inner_key: [null, { deepKey: true }] } },
					},
				],
				edges: [],
			};
			const { nodes, edges } = toCanvasElements(odd);

			expect(toGraph(1, nodes, edges)).toEqual(odd);
			expect(Object.keys(toGraph(1, nodes, edges).nodes[0]!.config)).toEqual(['snake_case', 'camelCase', 'kebab-case', 'nested']);
		});

		it('reflects what was changed on the canvas', (): void => {
			const { nodes, edges } = toCanvasElements(graph);

			// A node was dragged, a node was removed with its edge, an edge was drawn
			nodes[0]!.position = { x: 100, y: 200 };

			const remainingNodes = nodes.filter((node) => node.id !== 'a2');
			const remainingEdges: IAutomationCanvasEdgeState[] = [
				...edges.filter((edge) => edge.target !== 'a2'),
				{ id: 'e4', source: 'c1', target: 'a1', sourceHandle: 'no', targetHandle: 'in' },
			];

			const next = toGraph(graph.version, remainingNodes, remainingEdges);

			expect(next.nodes.map((node) => node.id)).toEqual(['t1', 'c1', 'a1']);
			expect(next.nodes[0]!.position).toEqual({ x: 100, y: 200 });
			expect(next.edges).toEqual([
				{ id: 'e1', source: 't1', source_port: 'out', target: 'c1', target_port: 'in' },
				{ id: 'e2', source: 'c1', source_port: 'yes', target: 'a1', target_port: 'in' },
				{ id: 'e4', source: 'c1', source_port: 'no', target: 'a1', target_port: 'in' },
			]);
			expect(canonicalGraph(next)).not.toBe(canonicalGraph(graph));
		});
	});

	describe('graphStructure', (): void => {
		it('is the same when only positions and configurations differ', (): void => {
			const edited: IAutomationGraph = {
				...graph,
				nodes: graph.nodes.map((node) => ({ ...node, position: { x: node.position.x + 10, y: 0 }, config: { changed: true } })),
			};

			expect(graphStructure(edited)).toBe(graphStructure(graph));
		});

		it('differs when a node or an edge was added, removed or rewired', (): void => {
			expect(graphStructure({ ...graph, nodes: graph.nodes.slice(0, 3) })).not.toBe(graphStructure(graph));
			expect(graphStructure({ ...graph, edges: graph.edges.slice(0, 2) })).not.toBe(graphStructure(graph));
			expect(graphStructure({ ...graph, edges: graph.edges.map((edge) => (edge.id === 'e3' ? { ...edge, source_port: 'yes' } : edge)) })).not.toBe(
				graphStructure(graph)
			);
		});
	});

	describe('edgeTone', (): void => {
		it('colours an edge by the output it leaves', (): void => {
			expect(edgeTone('yes')).toBe('positive');
			expect(edgeTone('done')).toBe('positive');
			expect(edgeTone('error')).toBe('negative');
			expect(edgeTone('no')).toBe('muted');
			expect(edgeTone('out')).toBe('default');
			expect(edgeTone('anything')).toBe('default');
		});
	});
});

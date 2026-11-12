/*
 * The mapping between the automation graph document and what the canvas draws. It belongs to
 * `automation-canvas.vue`, which is its only user, and is kept in a file of its own so it can be tested
 * without mounting a canvas. It does not import the canvas library: the shapes below are the part of the
 * library's node and edge the mapping relies on.
 */
import { normalizePosition } from '../../automations.graph';
import type { IAutomationGraph, IAutomationGraphEdge, IAutomationGraphNode } from '../../store/automations.store.types';

export const AUTOMATION_CANVAS_NODE_TYPE = 'automation';

// The ports of the three card kinds; an edge that names no handle is read as running between these
export const DEFAULT_SOURCE_PORT = 'out';
export const DEFAULT_TARGET_PORT = 'in';

export type AutomationEdgeTone = 'default' | 'positive' | 'negative' | 'muted';

export interface IAutomationCanvasNodeData {
	type: IAutomationGraphNode['type'];
	config: IAutomationGraphNode['config'];
}

export interface IAutomationCanvasNode {
	id: string;
	type: typeof AUTOMATION_CANVAS_NODE_TYPE;
	position: { x: number; y: number };
	data: IAutomationCanvasNodeData;
}

export interface IAutomationCanvasEdge {
	id: string;
	source: string;
	target: string;
	sourceHandle: string;
	targetHandle: string;
}

// What is read back from the canvas: the library adds much more to its nodes and edges, none of it stored
export interface IAutomationCanvasNodeState {
	id: string;
	position: { x: number; y: number };
	data: IAutomationCanvasNodeData;
}

export interface IAutomationCanvasEdgeState {
	id: string;
	source: string;
	target: string;
	sourceHandle?: string | null;
	targetHandle?: string | null;
}

const cloneConfig = (config: IAutomationGraphNode['config']): IAutomationGraphNode['config'] =>
	JSON.parse(JSON.stringify(config)) as IAutomationGraphNode['config'];

export const toCanvasNode = (node: IAutomationGraphNode): IAutomationCanvasNode => ({
	id: node.id,
	type: AUTOMATION_CANVAS_NODE_TYPE,
	position: { x: node.position.x, y: node.position.y },
	// A copy: the canvas must never be able to change the document it was given
	data: { type: node.type, config: cloneConfig(node.config) },
});

export const toCanvasEdge = (edge: IAutomationGraphEdge): IAutomationCanvasEdge => ({
	id: edge.id,
	source: edge.source,
	target: edge.target,
	sourceHandle: edge.source_port,
	targetHandle: edge.target_port,
});

export const toGraphNode = (node: IAutomationCanvasNodeState): IAutomationGraphNode => ({
	id: node.id,
	type: node.data.type,
	position: normalizePosition(node.position),
	config: cloneConfig(node.data.config),
});

export const toGraphEdge = (edge: IAutomationCanvasEdgeState): IAutomationGraphEdge => ({
	id: edge.id,
	source: edge.source,
	source_port: edge.sourceHandle ?? DEFAULT_SOURCE_PORT,
	target: edge.target,
	target_port: edge.targetHandle ?? DEFAULT_TARGET_PORT,
});

export const toCanvasElements = (graph: IAutomationGraph): { nodes: IAutomationCanvasNode[]; edges: IAutomationCanvasEdge[] } => ({
	nodes: graph.nodes.map(toCanvasNode),
	edges: graph.edges.map(toCanvasEdge),
});

export const toGraph = (version: number, nodes: IAutomationCanvasNodeState[], edges: IAutomationCanvasEdgeState[]): IAutomationGraph => ({
	version,
	nodes: nodes.map(toGraphNode),
	edges: edges.map(toGraphEdge),
});

/**
 * What decides whether the canvas has to be rebuilt: which nodes and edges there are. Two graphs with the
 * same structure differ only in positions and configurations, which can be patched in place - keeping the
 * selection and the measured sizes.
 */
export const graphStructure = (graph: Pick<IAutomationGraph, 'nodes' | 'edges'>): string =>
	JSON.stringify([
		graph.nodes.map((node) => [node.id, node.type]),
		graph.edges.map((edge) => [edge.id, edge.source, edge.source_port, edge.target, edge.target_port]),
	]);

/**
 * How an edge is coloured, by the output it leaves: the good outcome, the bad one, the "no" branch.
 */
export const edgeTone = (sourcePort: string): AutomationEdgeTone => {
	switch (sourcePort) {
		case 'yes':
		case 'done':
			return 'positive';
		case 'error':
		case 'timeout':
			return 'negative';
		case 'no':
			return 'muted';
		default:
			return 'default';
	}
};

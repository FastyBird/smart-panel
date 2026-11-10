// THROWAWAY SPIKE (AU-0). Not production code — nothing outside this folder may import from it.

export type AutomationNodeKind = 'trigger' | 'condition' | 'action' | 'flow';

export interface IAutomationGraphNode {
	id: string;
	type: string;
	position: { x: number; y: number };
	config: Record<string, unknown>;
}

export interface IAutomationGraphEdge {
	id: string;
	source: string;
	source_port: string;
	target: string;
	target_port: string;
}

export interface IAutomationGraph {
	version: number;
	nodes: IAutomationGraphNode[];
	edges: IAutomationGraphEdge[];
}

export interface IAutomationNodeTypeDefinition {
	type: string;
	kind: AutomationNodeKind;
	label: string;
	icon: string;
	inputs: string[];
	outputs: string[];
	defaultConfig: Record<string, unknown>;
	summary: (config: Record<string, unknown>) => string;
}

export type AutomationConnectionRejection = 'into_trigger' | 'cycle' | 'duplicate' | 'unknown_port' | 'self';

export interface IAutomationConnectionCandidate {
	source: string;
	source_port: string;
	target: string;
	target_port: string;
}

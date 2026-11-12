import type { AutomationIssueSeverity } from '../../automations.graph';
import type { IAutomationGraph, IAutomationGraphIssue } from '../../store/automations.store.types';
import type { IAutomationNodeType } from '../../store/node-types.store.types';

import type { AutomationEdgeTone } from './automation-canvas.mapping';

// `fit` shows the whole graph; `first-trigger` starts at the first trigger at full size (phone width)
export type AutomationCanvasInitialView = 'fit' | 'first-trigger';

export interface IAutomationCanvasProps {
	graph: IAutomationGraph;
	// The catalogue of cards: what a node of a type looks like and which ports it has
	nodeTypes: IAutomationNodeType[];
	// What the backend found wrong with the graph; the nodes and edges named are outlined
	issues?: IAutomationGraphIssue[];
	readonly?: boolean;
	initialView?: AutomationCanvasInitialView;
}

export interface IAutomationCanvasColors {
	background: string;
	edges: Record<AutomationEdgeTone, string>;
	issues: Record<AutomationIssueSeverity, string>;
}

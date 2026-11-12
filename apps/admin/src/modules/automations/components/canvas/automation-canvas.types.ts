import type { Component } from 'vue';

import type { AutomationIssueSeverity } from '../../automations.graph';
import type { IAutomationRunOverlay } from '../../automations.trace';
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
	// The summary component of a card that brings one (`automationNodeCard`), null for the generic summary
	summaryComponent?: (type: string) => Component | null;
	readonly?: boolean;
	initialView?: AutomationCanvasInitialView;
	// A run laid over the graph, read-only: the cards it reached are lit and the edges it went along marked
	run?: IAutomationCanvasRun | null;
}

export interface IAutomationCanvasRun {
	overlay: IAutomationRunOverlay;
	// The run is over: a card it waited on is where it stopped, not where it waits
	ended: boolean;
}

export interface IAutomationCanvasColors {
	background: string;
	edges: Record<AutomationEdgeTone, string>;
	issues: Record<AutomationIssueSeverity, string>;
	// The edges a run went along
	run: string;
}

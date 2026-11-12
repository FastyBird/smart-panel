import type { IAutomationGraph, IAutomationGraphIssue } from '../../store/automations.store.types';
import type { IAutomationNodeType } from '../../store/node-types.store.types';

export interface IAutomationIssuesListProps {
	issues: IAutomationGraphIssue[];
	// The graph and the catalogue the issues are about, to name the node of each one
	graph: IAutomationGraph;
	nodeTypes: IAutomationNodeType[];
}

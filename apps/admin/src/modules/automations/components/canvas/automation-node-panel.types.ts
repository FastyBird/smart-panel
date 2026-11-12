import type { IAutomationGraphIssue, IAutomationGraphNode } from '../../store/automations.store.types';
import type { IAutomationNodeType } from '../../store/node-types.store.types';

export interface IAutomationNodePanelProps {
	node: IAutomationGraphNode;
	// Null for a card that is not offered any more
	nodeType: IAutomationNodeType | null;
	// The issues the backend reported for this node
	issues?: IAutomationGraphIssue[];
	disabled?: boolean;
}

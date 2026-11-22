import type { Component } from 'vue';

import type { Domain } from '../../../../common/components/domain-icon.types';
import type { IAutomationGraph, IAutomationGraphIssue, IAutomationGraphNode } from '../../store/automations.store.types';
import type { IAutomationNodeType } from '../../store/node-types.store.types';

export interface IAutomationStepListProps {
	graph: IAutomationGraph;
	nodeTypes: IAutomationNodeType[];
	issues?: IAutomationGraphIssue[];
	/** The card an automation element brings for a node type, as on the canvas */
	summaryComponent?: (type: string) => Component | null;
	/** The domain of the devices a block works with, shown as its domain icon */
	nodeDomain?: (node: Pick<IAutomationGraphNode, 'config'>) => Domain | undefined;
}

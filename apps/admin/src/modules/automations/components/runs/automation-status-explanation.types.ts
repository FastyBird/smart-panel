import type { AutomationStatus } from '../../automations.constants';
import type { IAutomationGraph } from '../../store/automations.store.types';
import type { IAutomationNodeType } from '../../store/node-types.store.types';
import type { IAutomationRuntime } from '../../store/runs.store.types';

export interface IAutomationStatusExplanationProps {
	status: AutomationStatus;
	// What the engine says about the automation; null while it is not read, or when it cannot be
	runtime: IAutomationRuntime | null;
	graph: IAutomationGraph;
	nodeTypes: IAutomationNodeType[];
}

import type { IAutomationGraph } from '../../store/automations.store.types';
import type { IAutomationNodeType } from '../../store/node-types.store.types';
import type { IAutomationRun } from '../../store/runs.store.types';

export interface IAutomationRunHistoryProps {
	runs: IAutomationRun[];
	// The run laid over the canvas
	selectedRunId?: string | null;
	loading?: boolean;
	failed?: boolean;
	// The graph and the catalogue, to name the trigger each run started at
	graph: IAutomationGraph;
	nodeTypes: IAutomationNodeType[];
}

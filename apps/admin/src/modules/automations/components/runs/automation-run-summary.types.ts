import type { IAutomationShownRun } from '../../composables/types';
import type { IAutomationGraph } from '../../store/automations.store.types';
import type { IAutomationNodeType } from '../../store/node-types.store.types';

export interface IAutomationRunSummaryProps {
	shown: IAutomationShownRun;
	graph: IAutomationGraph;
	nodeTypes: IAutomationNodeType[];
	// The revision of the automation as it is now; a run of another one walked another flow
	revision: number;
	// The flow drawn differs from the one the backend runs
	unsaved?: boolean;
}

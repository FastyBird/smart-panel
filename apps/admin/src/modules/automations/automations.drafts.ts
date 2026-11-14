import type { AutomationMode } from './automations.constants';
import { cloneGraph } from './automations.graph';
import type { IAutomationGraph } from './store/automations.store.types';

/**
 * What a new automation is created from when it does not start from a blank canvas: the name and mode its form
 * starts with and the flow its editor opens with.
 */
export interface IAutomationDraft {
	name: string;
	mode: AutomationMode;
	graph: IAutomationGraph;
}

// Held in memory only, by the id the new automation will get. A reload loses a draft that was not saved yet,
// and the add form and the editor then start the way they always do.
const drafts = new Map<string, IAutomationDraft>();

const copy = (draft: IAutomationDraft): IAutomationDraft => ({ name: draft.name, mode: draft.mode, graph: cloneGraph(draft.graph) });

export const stashAutomationDraft = (id: string, draft: IAutomationDraft): void => {
	drafts.set(id, copy(draft));
};

export const peekAutomationDraft = (id: string): IAutomationDraft | null => {
	const draft = drafts.get(id);

	return draft ? copy(draft) : null;
};

// The draft is handed over once: the editor that takes it holds it as its unsaved working copy
export const takeAutomationDraft = (id: string): IAutomationDraft | null => {
	const draft = peekAutomationDraft(id);

	drafts.delete(id);

	return draft;
};

export const discardAutomationDraft = (id: string): void => {
	drafts.delete(id);
};

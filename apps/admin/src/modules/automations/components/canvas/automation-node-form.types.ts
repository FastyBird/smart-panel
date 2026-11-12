import type { IAutomationGraphIssue } from '../../store/automations.store.types';
import type { IAutomationNodeType } from '../../store/node-types.store.types';

/*
 * What every form of a card is given and what it answers with, whether it is the generic form or the form
 * an admin element brings for its card (`automationNodeForm`, resolved by `useAutomationNodePlugins`):
 *   emits `update:config` (config: Record<string, unknown>, field: string)
 *   emits `update:invalid` (invalid: boolean) while text typed into it does not parse and so has not reached
 *   the configuration; the editor does not save until it does
 */
export interface IAutomationNodeFormProps {
	nodeType: IAutomationNodeType;
	config: Record<string, unknown>;
	// What the backend refused, by the configuration key it is about
	fieldErrors?: Record<string, string[]>;
	// Every issue reported for the node, with the full path of its field (`writes.0.value`), for a form
	// that shows a problem next to the part of a field it is about
	issues?: IAutomationGraphIssue[];
	disabled?: boolean;
}

export const automationNodeFormEmits = {
	// `field` names what was edited, so a run of keystrokes in one field can be undone as one step
	'update:config': (config: Record<string, unknown>, field: string): boolean => typeof config === 'object' && typeof field === 'string',
	// Only a form that can hold text which does not parse yet emits it; the built-in forms commit every
	// value through inputs that only ever hold a valid one (a number, a time, a choice, plain text)
	'update:invalid': (invalid: boolean): boolean => typeof invalid === 'boolean',
};

/*
 * What the summary of a card is given (`automationNodeCard`): the one line shown on the canvas under the
 * name of the card.
 */
export interface IAutomationNodeSummaryProps {
	nodeType: IAutomationNodeType;
	config: Record<string, unknown>;
}

import type { IAutomationNodeType } from '../../store/node-types.store.types';

/*
 * What every form of a card is given and what it answers with, whether it is the generic form or - from
 * AU-11 on - the form an admin element brings for its card (`automationNodeForm`):
 *   emits `update:config` (config: Record<string, unknown>, field: string)
 *   emits `update:invalid` (invalid: boolean) while text typed into it does not parse and so has not reached
 *   the configuration; the editor does not save until it does
 */
export interface IAutomationNodeFormProps {
	nodeType: IAutomationNodeType;
	config: Record<string, unknown>;
	// What the backend refused, by the configuration key it is about
	fieldErrors?: Record<string, string[]>;
	disabled?: boolean;
}

import type { IAutomationNodeType } from '../../store/node-types.store.types';

/*
 * What every form of a card is given and what it answers with, whether it is the generic form or - from
 * AU-11 on - the form an admin element brings for its card (`automationNodeForm`):
 *   emits `update:config` (config: Record<string, unknown>, field: string)
 */
export interface IAutomationNodeFormProps {
	nodeType: IAutomationNodeType;
	config: Record<string, unknown>;
	// What the backend refused, by the configuration key it is about
	fieldErrors?: Record<string, string[]>;
	disabled?: boolean;
}

import type { AutomationMode, FormResultType } from '../../automations.constants';
import type { IAutomation } from '../../store/automations.store.types';

export interface IAutomationAddFormProps {
	id: IAutomation['id'];
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
	// What the form starts with when the automation is created from a template or a Buddy suggestion
	initial?: { name: string; mode: AutomationMode; spaceId?: string | null; fromSuggestion?: boolean } | null;
}

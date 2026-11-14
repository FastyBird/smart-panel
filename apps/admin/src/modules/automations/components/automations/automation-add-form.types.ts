import type { AutomationMode, FormResultType } from '../../automations.constants';
import type { IAutomation } from '../../store/automations.store.types';

export interface IAutomationAddFormProps {
	id: IAutomation['id'];
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
	// What the form starts with when the automation is created from a template
	initial?: { name: string; mode: AutomationMode } | null;
}

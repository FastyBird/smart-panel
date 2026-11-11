import type { FormResultType } from '../../automations.constants';
import type { IAutomation } from '../../store/automations.store.types';

export interface IAutomationEditFormProps {
	automation: IAutomation;
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
}

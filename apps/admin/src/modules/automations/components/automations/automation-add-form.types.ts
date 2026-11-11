import type { FormResultType } from '../../automations.constants';
import type { IAutomation } from '../../store/automations.store.types';

export interface IAutomationAddFormProps {
	id: IAutomation['id'];
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
}

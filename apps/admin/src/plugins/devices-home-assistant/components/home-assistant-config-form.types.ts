import type { FormResultType, IConfigFormFieldError, LayoutType } from '../../../modules/config';
import type { IHomeAssistantConfig } from '../store/config.store.types';

export interface IHomeAssistantConfigFormProps {
	config: IHomeAssistantConfig;
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
	remoteFormErrors?: IConfigFormFieldError[];
	layout?: LayoutType;
}

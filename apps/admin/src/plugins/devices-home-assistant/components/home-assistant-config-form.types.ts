import type { FormResultType, LayoutType } from '../../../modules/config';
import type { IConfigPlugin } from '../../../modules/config/store/config-plugins.store.types';

export interface IConfigFormFieldError {
	field: string;
	message: string;
}

export interface IHomeAssistantConfigFormProps {
	config: IConfigPlugin;
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
	remoteFormErrors?: IConfigFormFieldError[];
	layout?: LayoutType;
}

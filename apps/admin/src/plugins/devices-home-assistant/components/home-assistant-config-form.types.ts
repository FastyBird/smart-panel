import type { IConfigFormFieldError, IPluginConfigEditFormProps, LayoutType } from '../../../modules/config';

export interface IHomeAssistantConfigFormProps extends IPluginConfigEditFormProps {
	remoteFormErrors?: IConfigFormFieldError[];
	layout?: LayoutType;
}

import type { IConfigFormFieldError, IPluginConfigEditFormProps, LayoutType } from '../../../modules/config';

export interface IProtectConfigFormProps extends IPluginConfigEditFormProps {
	remoteFormErrors?: IConfigFormFieldError[];
	layout?: LayoutType;
}

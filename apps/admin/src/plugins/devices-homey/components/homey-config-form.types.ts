import type { IConfigFormFieldError, IPluginConfigEditFormProps, LayoutType } from '../../../modules/config';

export interface IHomeyConfigFormProps extends IPluginConfigEditFormProps {
	remoteFormErrors?: IConfigFormFieldError[];
	layout?: LayoutType;
}

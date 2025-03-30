import type { FormResultType, LayoutType } from '../config.constants';
import type { IConfigLanguage } from '../store';

export type ConfigLanguageFormProps = {
	config: IConfigLanguage;
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
	layout?: LayoutType;
};

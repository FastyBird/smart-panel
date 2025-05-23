import type { FormResultType, LayoutType } from '../config.constants';
import type { IConfigLanguage } from '../store/config-language.store.types';

export type IConfigLanguageFormProps = {
	config: IConfigLanguage;
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
	layout?: LayoutType;
};

import type { FormResultType } from '../../../modules/config';
import type { IConfigPlugin } from '../../../modules/config/store/config-plugins.store.types';

export interface IHomeAssistantConfigFormProps {
	config: IConfigPlugin;
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
}

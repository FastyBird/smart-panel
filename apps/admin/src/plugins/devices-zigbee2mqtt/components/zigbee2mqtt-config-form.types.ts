import type { FormResultType, IConfigFormFieldError, LayoutType } from '../../../modules/config';
import type { IConfigPlugin } from '../../../modules/config/store/config-plugins.store.types';

export interface IZigbee2mqttConfigFormProps {
	config: IConfigPlugin;
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
	remoteFormErrors?: IConfigFormFieldError[];
	layout?: LayoutType;
}

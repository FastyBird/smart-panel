import type { FormResultType, LayoutType } from '../config.constants';
import type { IConfigDisplay } from '../store';

export type ConfigDisplayFormProps = {
	config: IConfigDisplay;
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
	layout?: LayoutType;
};

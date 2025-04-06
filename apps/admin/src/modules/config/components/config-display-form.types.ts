import type { FormResultType, LayoutType } from '../config.constants';
import type { IConfigDisplay } from '../store/config-display.store.types';

export type IConfigDisplayFormProps = {
	config: IConfigDisplay;
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
	layout?: LayoutType;
};

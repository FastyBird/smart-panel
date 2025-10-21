import type { FormResultType, LayoutType } from '../config.constants';
import type { IConfigSystem } from '../store/config-system.store.types';

export type IConfigSystemFormProps = {
	config: IConfigSystem;
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
	layout?: LayoutType;
};

import type { FormResultType, LayoutType } from '../../config';
import type { IConfigModule } from '../../config/store/config-modules.store.types';

export interface IInfluxDbConfigFormProps {
	config: IConfigModule;
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
	layout?: LayoutType;
}

import type { IPluginElement } from '../../../common';
import type { FormResultType } from '../../../modules/devices';
import type { IThirdPartyDevice } from '../store/devices.store.types';

export interface IThirdPartyDeviceAddFormProps {
	id: IThirdPartyDevice['id'];
	type: IPluginElement['type'];
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
}

import type { IPluginElement } from '../../../common';
import type { FormResultType } from '../../../modules/devices';
import type { IWledDevice } from '../store/devices.store.types';

export interface IWledDeviceAddFormProps {
	id: IWledDevice['id'];
	type: IPluginElement['type'];
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
}

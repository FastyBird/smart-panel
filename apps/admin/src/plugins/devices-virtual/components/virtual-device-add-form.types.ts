import type { IPluginElement } from '../../../common';
import type { FormResultType } from '../../../modules/devices';
import type { IVirtualDevice } from '../store/devices.store.types';

export interface IVirtualDeviceAddFormProps {
	id: IVirtualDevice['id'];
	type: IPluginElement['type'];
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
}

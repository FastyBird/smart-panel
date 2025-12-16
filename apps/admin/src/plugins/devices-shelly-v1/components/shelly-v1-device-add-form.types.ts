import type { IPluginElement } from '../../../common';
import type { FormResultType } from '../../../modules/devices';
import type { IShellyV1Device } from '../store/devices.store.types';

export interface IShellyV1DeviceAddFormProps {
	id: IShellyV1Device['id'];
	type: IPluginElement['type'];
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
}

import type { IPluginElement } from '../../../common';
import type { FormResultType } from '../../../modules/devices';
import type { IShellyNgDevice } from '../store/devices.store.types';

export interface IShellyNgDeviceAddFormProps {
	id: IShellyNgDevice['id'];
	type: IPluginElement['type'];
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
}

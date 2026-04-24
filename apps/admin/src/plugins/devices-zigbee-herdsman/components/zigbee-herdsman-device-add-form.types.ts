import type { IPluginElement } from '../../../common';
import type { FormResultType } from '../../../modules/devices';
import type { IZigbeeHerdsmanDevice } from '../store/devices.store.types';

export interface IZigbeeHerdsmanDeviceAddFormProps {
	id: IZigbeeHerdsmanDevice['id'];
	type: IPluginElement['type'];
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
}

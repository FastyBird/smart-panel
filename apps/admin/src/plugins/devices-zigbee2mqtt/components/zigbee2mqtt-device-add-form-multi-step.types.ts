import type { IPluginElement } from '../../../common';
import type { FormResultType } from '../../../modules/devices';
import type { IZigbee2mqttDevice } from '../store/devices.store.types';

export interface IZigbee2mqttDeviceAddFormMultiStepProps {
	id: IZigbee2mqttDevice['id'];
	type: IPluginElement['type'];
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
}

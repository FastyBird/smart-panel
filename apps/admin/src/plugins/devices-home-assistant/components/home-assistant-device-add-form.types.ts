import type { IPluginElement } from '../../../common';
import type { FormResultType } from '../../../modules/devices';
import type { IHomeAssistantDevice } from '../store/devices.store.types';

export interface IHomeAssistantDeviceAddFormProps {
	id: IHomeAssistantDevice['id'];
	type: IPluginElement['type'];
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
}

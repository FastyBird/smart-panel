import type { FormResultType } from '../../../modules/devices';
import type { IHomeAssistantDevice } from '../store/devices.store.types';

export interface IHomeAssistantDeviceAddFormProps {
	id: IHomeAssistantDevice['id'];
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
}

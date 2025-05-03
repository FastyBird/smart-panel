import type { FormResultType, IDevice } from '../../../modules/devices';

export interface IHomeAssistantDeviceEditFormProps {
	device: IDevice;
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
}

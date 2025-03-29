import type { FormResultType, IDevice } from '../../../modules/devices-module';

export interface IThirdPartyDeviceEditFormProps {
	device: IDevice;
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
}

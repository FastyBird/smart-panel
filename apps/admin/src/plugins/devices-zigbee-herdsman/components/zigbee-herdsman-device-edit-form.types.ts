import type { FormResultType, IDevice } from '../../../modules/devices';

export interface IZigbeeHerdsmanDeviceEditFormProps {
	device: IDevice;
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
}

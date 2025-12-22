import type { FormResultType, IDevice } from '../../../modules/devices';

export interface IZigbee2mqttDeviceEditFormProps {
	device: IDevice;
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
}

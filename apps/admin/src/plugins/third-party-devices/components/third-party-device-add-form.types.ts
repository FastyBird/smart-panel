import type { FormResultType } from '../../../modules/devices-module';
import type { IThirdPartyDevice } from '../store';

export interface IThirdPartyDeviceAddFormProps {
	id: IThirdPartyDevice['id'];
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
}

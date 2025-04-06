import type { FormResultType } from '../../../modules/devices';
import type { IThirdPartyDevice } from '../store/devices.store.types';

export interface IThirdPartyDeviceAddFormProps {
	id: IThirdPartyDevice['id'];
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
}

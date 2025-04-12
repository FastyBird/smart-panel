import { type FormResultType, type IPage } from '../../../modules/dashboard';

export interface IDeviceDetailPageAddFormProps {
	id: IPage['id'];
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
}

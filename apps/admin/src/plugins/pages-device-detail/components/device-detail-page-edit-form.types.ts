import { type FormResultType, type IPage } from '../../../modules/dashboard';

export interface IDeviceDetailPageEditFormProps {
	page: IPage;
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
}

import type { FormResultType } from '../../devices.constants';
import type { IChannel, IDevice } from '../../store';

export interface IChannelAddFormProps {
	id: IChannel['id'];
	device?: IDevice;
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
}

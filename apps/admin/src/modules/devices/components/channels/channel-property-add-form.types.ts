import type { FormResultType } from '../../devices.constants';
import type { IChannel, IChannelProperty } from '../../store';

export interface IChannelPropertyAddFormProps {
	id: IChannelProperty['id'];
	channel?: IChannel;
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
}

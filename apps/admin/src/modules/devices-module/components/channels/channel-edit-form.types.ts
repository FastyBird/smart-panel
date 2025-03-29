import type { FormResultType } from '../../devices.constants';
import type { IChannel } from '../../store';

export interface IChannelEditFormProps {
	channel: IChannel;
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
}

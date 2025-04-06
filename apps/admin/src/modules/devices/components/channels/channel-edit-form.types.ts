import type { FormResultType } from '../../devices.constants';
import type { IChannel } from '../../store/channels.store.types';

export interface IChannelEditFormProps {
	channel: IChannel;
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
}

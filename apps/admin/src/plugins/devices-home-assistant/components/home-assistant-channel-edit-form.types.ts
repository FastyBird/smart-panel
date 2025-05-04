import type { FormResultType, IChannel } from '../../../modules/devices';

export interface IHomeAssistantChannelEditFormProps {
	channel: IChannel;
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
}

import type { FormResultType, IChannel, IChannelProperty } from '../../../modules/devices';

export interface IHomeAssistantChannelPropertyAddFormProps {
	id: IChannelProperty['id'];
	type: string;
	channel?: IChannel;
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
}

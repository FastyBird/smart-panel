import type { FormResultType } from '../../devices.constants';
import type { IChannelProperty } from '../../store/channels.properties.store.types';
import type { IChannel } from '../../store/channels.store.types';

export interface IChannelPropertyAddFormProps {
	id: IChannelProperty['id'];
	channel?: IChannel;
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
}

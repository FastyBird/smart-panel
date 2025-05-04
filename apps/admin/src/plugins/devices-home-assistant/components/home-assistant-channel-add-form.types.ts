import type { FormResultType, IDevice } from '../../../modules/devices';
import type { IHomeAssistantChannel } from '../store/channels.store.types';

export interface IHomeAssistantChannelAddFormProps {
	id: IHomeAssistantChannel['id'];
	type: string;
	device?: IDevice;
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
}

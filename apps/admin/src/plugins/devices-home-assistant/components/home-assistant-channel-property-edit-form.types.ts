import type { FormResultType, IChannelProperty } from '../../../modules/devices';

export interface IHomeAssistantChannelPropertyEditFormProps {
	property: IChannelProperty;
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
}

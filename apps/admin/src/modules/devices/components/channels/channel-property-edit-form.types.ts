import type { FormResultType } from '../../devices.constants';
import type { IChannelProperty } from '../../store/channels.properties.store.types';

export interface IChannelPropertyEditFormProps {
	property: IChannelProperty;
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
}

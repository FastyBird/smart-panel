import type { FormResultType } from '../../devices.constants';
import type { IChannelProperty } from '../../store/channels.properties.store.types';

export interface IChannelPropertyEditFormProps {
	property: IChannelProperty;
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
}

export const channelPropertyEditFormEmits = {
	'update:remote-form-submit': (remoteFormSubmit: boolean): boolean => typeof remoteFormSubmit === 'boolean',
	'update:remote-form-result': (remoteFormResult: FormResultType): boolean => typeof remoteFormResult === 'string',
	'update:remote-form-reset': (remoteFormReset: boolean): boolean => typeof remoteFormReset === 'boolean',
	'update:remote-form-changed': (formChanged: boolean): boolean => typeof formChanged === 'boolean',
};

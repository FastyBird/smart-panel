import type { FormResultType } from '../../devices.constants';
import type { IChannel } from '../../store/channels.store.types';

export interface IChannelEditFormProps {
	channel: IChannel;
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
}

export const channelEditFormEmits = {
	'update:remote-form-submit': (remoteFormSubmit: boolean): boolean => typeof remoteFormSubmit === 'boolean',
	'update:remote-form-result': (remoteFormResult: FormResultType): boolean => typeof remoteFormResult === 'string',
	'update:remote-form-reset': (remoteFormReset: boolean): boolean => typeof remoteFormReset === 'boolean',
	'update:remote-form-changed': (formChanged: boolean): boolean => typeof formChanged === 'boolean',
};

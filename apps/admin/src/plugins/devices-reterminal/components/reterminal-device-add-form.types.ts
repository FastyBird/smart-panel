import type { IPluginElement } from '../../../common';
import type { FormResultType } from '../../../modules/devices';
import type { IReTerminalDevice } from '../store/devices.store.types';

export interface IReTerminalDeviceAddFormProps {
	id: IReTerminalDevice['id'];
	type: IPluginElement['type'];
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
}
